import { fetchSheetData } from "./googleSheets";
import {
  sanitizeNumber,
  parseDate,
  formatDateISO,
  getPreviousPeriod,
} from "./sanitize";
import { aggregateRows } from "./dataUtils";
import type { ProjectMapping, PlatformTabMapping, DateRange } from "@/types";
import { CHART_CATEGORY_TYPES } from "@/types";
import type {
  ProcessedRow,
  PlatformData,
  ReportData,
  ChartDataSet,
  ChartDataRow,
} from "./dataUtils";

// Re-export types and client-safe functions for convenience
export type {
  ProcessedRow,
  PlatformData,
  ReportData,
  ChartDataSet,
} from "./dataUtils";
export { computeChange, groupRowsBy } from "./dataUtils";

/**
 * Main pipeline: fetch → filter → map → aggregate → compute metrics
 */
export async function processReportData(
  mapping: ProjectMapping,
  dateRange: DateRange,
): Promise<ReportData> {
  const platforms: PlatformData[] = [];
  const comparisonPlatforms: PlatformData[] = [];

  const prevPeriod =
    dateRange && dateRange.start && dateRange.end
      ? getPreviousPeriod(dateRange.start, dateRange.end)
      : null;

  for (const platform of mapping.platforms) {
    const raw = await fetchSheetData(mapping.spreadsheetId, platform.sheetName);

    const currentRows = processRows(raw.headers, raw.rows, platform, dateRange);
    const currentAgg = aggregateRows(currentRows, mapping.formulas);
    platforms.push({
      platform: platform.platformLabel,
      sheetName: platform.sheetName,
      rows: currentRows,
      totals: currentAgg.totals,
      metrics: currentAgg.metrics,
    });

    if (prevPeriod) {
      const prevRows = processRows(raw.headers, raw.rows, platform, prevPeriod);
      const prevAgg = aggregateRows(prevRows, mapping.formulas);
      comparisonPlatforms.push({
        platform: platform.platformLabel,
        sheetName: platform.sheetName,
        rows: prevRows,
        totals: prevAgg.totals,
        metrics: prevAgg.metrics,
      });
    }
  }

  const overall = aggregateAcrossPlatforms(platforms, mapping);
  const comparisonOverall = prevPeriod
    ? aggregateAcrossPlatforms(comparisonPlatforms, mapping)
    : null;

  // Process chart/demo tab data
  const chartData: ChartDataSet[] = [];
  for (const platform of mapping.platforms) {
    if (!platform.chartSheetName || !platform.chartColumnMap) continue;

    const raw = await fetchSheetData(
      mapping.spreadsheetId,
      platform.chartSheetName,
    );
    const categoryKeys = Object.keys(platform.chartColumnMap).filter((k) =>
      Object.keys(CHART_CATEGORY_TYPES).includes(k),
    );

    for (const catKey of categoryKeys) {
      const chartRows = processChartRows(
        raw.headers,
        raw.rows,
        platform.chartColumnMap,
        catKey,
      );
      chartData.push({
        platform: platform.platformLabel,
        categoryKey: catKey,
        rows: chartRows,
      });
    }
  }

  return {
    platforms,
    overall,
    comparison: comparisonOverall
      ? { platforms: comparisonPlatforms, overall: comparisonOverall }
      : null,
    chartData,
    dateRange,
  };
}

function processRows(
  headers: string[],
  rows: (string | number | null)[][],
  platform: PlatformTabMapping,
  dateRange: DateRange,
): ProcessedRow[] {
  const dateColIdx = headers.indexOf(platform.dateColumn);
  const result: ProcessedRow[] = [];

  for (const row of rows) {
    if (dateRange && dateColIdx >= 0) {
      const cellDate = parseDate(row[dateColIdx], platform.dateFormat);
      if (!cellDate) continue;
      const dateStr = formatDateISO(cellDate);
      if (dateStr < dateRange.start || dateStr > dateRange.end) continue;
    }

    const values: Record<string, number | null> = {};
    const rawRow: Record<string, string | number | null> = {};

    for (const [typeKey, headerName] of Object.entries(platform.columnMap)) {
      const colIdx = headers.indexOf(headerName);
      if (colIdx >= 0) {
        const raw = row[colIdx];
        rawRow[typeKey] = raw;
        values[typeKey] = sanitizeNumber(raw);
      }
    }

    if (platform.columnMap.campaign) {
      const idx = headers.indexOf(platform.columnMap.campaign);
      if (idx >= 0) rawRow.campaign = row[idx];
    }
    if (platform.columnMap.adgroup) {
      const idx = headers.indexOf(platform.columnMap.adgroup);
      if (idx >= 0) rawRow.adgroup = row[idx];
    }

    result.push({ platform: platform.platformLabel, rawRow, values });
  }

  return result;
}

function aggregateAcrossPlatforms(
  platforms: PlatformData[],
  mapping: ProjectMapping,
) {
  const allRows = platforms.flatMap((p) => p.rows);
  return aggregateRows(allRows, mapping.formulas);
}

/**
 * Process chart/demo tab rows: group by category, aggregate metrics
 */
function processChartRows(
  headers: string[],
  rows: (string | number | null)[][],
  chartColumnMap: Record<string, string>,
  categoryKey: string,
): ChartDataRow[] {
  const catHeader = chartColumnMap[categoryKey];
  if (!catHeader) return [];

  const catColIdx = headers.indexOf(catHeader);
  if (catColIdx < 0) return [];

  // Get metric column indices
  const metricKeys = Object.keys(chartColumnMap).filter(
    (k) => !Object.keys(CHART_CATEGORY_TYPES).includes(k),
  );

  // Group by category value and sum metrics
  const groups: Record<string, Record<string, number>> = {};

  for (const row of rows) {
    const catValue = String(row[catColIdx] ?? "Unknown").trim();
    if (!catValue) continue;

    if (!groups[catValue]) {
      groups[catValue] = {};
      for (const mk of metricKeys) groups[catValue][mk] = 0;
    }

    for (const mk of metricKeys) {
      const colHeader = chartColumnMap[mk];
      if (!colHeader) continue;
      const colIdx = headers.indexOf(colHeader);
      if (colIdx < 0) continue;
      const val = sanitizeNumber(row[colIdx]);
      if (val !== null) groups[catValue][mk] += val;
    }
  }

  return Object.entries(groups).map(([category, vals]) => ({
    category,
    values: Object.fromEntries(
      Object.entries(vals).map(([k, v]) => [k, v as number | null]),
    ),
  }));
}
