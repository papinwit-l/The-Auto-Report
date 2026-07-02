import pptxgen from "pptxgenjs";
import type { SlideConfig, FormulaConfig } from "@/types";
import type { ReportData, PlatformData, ProcessedRow } from "./dataUtils";
import { computeChange, groupRowsBy } from "./dataUtils";

// PptxGenJS shape/chart string literals matching their type unions
const SHAPE_ROUNDED_RECT: pptxgen.SHAPE_NAME = "roundRect";
const CHART_DOUGHNUT: pptxgen.CHART_NAME = "doughnut";
const CHART_BAR: pptxgen.CHART_NAME = "bar";

// ── Color palette ──
const COLORS = {
  dark: "1E293B",
  body: "334155",
  muted: "64748B",
  light: "94A3B8",
  border: "E2E8F0",
  bg: "F8FAFC",
  white: "FFFFFF",
  blue: "2563EB",
  blueBg: "EFF6FF",
  green: "059669",
  red: "DC2626",
  chart: [
    "2563EB",
    "7C3AED",
    "059669",
    "D97706",
    "DC2626",
    "0891B2",
    "DB2777",
    "4F46E5",
  ],
};

// ── Helpers ──
function fmt(
  value: number | null,
  format: "number" | "currency" | "percent",
): string {
  if (value === null) return "-";
  switch (format) {
    case "currency":
      return (
        "฿" +
        value.toLocaleString("en", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    case "percent":
      return value.toFixed(2) + "%";
    default:
      return value.toLocaleString("en", { maximumFractionDigits: 0 });
  }
}

function fmtCompact(value: number | null): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString("en", { maximumFractionDigits: 2 });
}

function changeArrow(dir: "up" | "down" | "flat"): string {
  return dir === "up" ? "▲" : dir === "down" ? "▼" : "→";
}

function changeColor(dir: "up" | "down" | "flat"): string {
  return dir === "up"
    ? COLORS.green
    : dir === "down"
      ? COLORS.red
      : COLORS.muted;
}

// Fresh shadow factory (PptxGenJS mutates options in-place)
const makeShadow = () => ({
  type: "outer" as const,
  color: "000000",
  blur: 4,
  offset: 1,
  angle: 45,
  opacity: 0.08,
});

/**
 * Generate a .pptx Buffer from slides + report data
 */
export async function generatePptx(
  slides: SlideConfig[],
  data: ReportData,
  formulas: FormulaConfig[],
  projectName: string,
): Promise<Buffer> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Auto Report";
  pres.title = projectName;

  for (const slideConfig of slides) {
    const pptSlide = pres.addSlide();
    pptSlide.background = { color: COLORS.white };

    switch (slideConfig.template) {
      case "overall":
        buildOverallSlide(pres, pptSlide, slideConfig, data, formulas);
        break;
      case "single_table":
        buildTableSlide(pres, pptSlide, slideConfig, data, formulas);
        break;
      case "table_charts":
        buildTableChartsSlide(pres, pptSlide, slideConfig, data, formulas);
        break;
      case "table_creatives":
        buildTableSlide(pres, pptSlide, slideConfig, data, formulas);
        break;
    }
  }

  const output = await pres.write({ outputType: "nodebuffer" });
  return output as Buffer;
}

// ── Slide builders ──

function buildOverallSlide(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
) {
  // Title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.5,
    fontSize: 24,
    fontFace: "Calibri",
    bold: true,
    color: COLORS.dark,
    margin: 0,
  });

  // KPI cards row
  const kpis = config.kpiCards;
  if (kpis.length > 0) {
    const currentVals = { ...data.overall.totals, ...data.overall.metrics };
    const prevVals = data.comparison
      ? {
          ...data.comparison.overall.totals,
          ...data.comparison.overall.metrics,
        }
      : null;

    const cardW = Math.min(2, (9 - (kpis.length - 1) * 0.15) / kpis.length);
    const gap = 0.15;
    const startX = 0.5;

    kpis.forEach((kpi, i) => {
      const x = startX + i * (cardW + gap);
      const value = currentVals[kpi.metric] ?? null;
      const prevValue = prevVals?.[kpi.metric] ?? null;
      const change = kpi.showChange ? computeChange(value, prevValue) : null;

      // Card background
      slide.addShape(SHAPE_ROUNDED_RECT, {
        x,
        y: 1,
        w: cardW,
        h: 1,
        fill: { color: COLORS.bg },
        rectRadius: 0.08,
        shadow: makeShadow(),
      });

      // Label
      slide.addText(kpi.label, {
        x,
        y: 1.08,
        w: cardW,
        h: 0.25,
        fontSize: 9,
        fontFace: "Calibri",
        color: COLORS.muted,
        align: "center",
        margin: 0,
      });

      // Value
      slide.addText(fmtCompact(value), {
        x,
        y: 1.3,
        w: cardW,
        h: 0.35,
        fontSize: 18,
        fontFace: "Calibri",
        bold: true,
        color: COLORS.dark,
        align: "center",
        margin: 0,
      });

      // Change indicator
      if (change && change.percent !== null) {
        const dir = change.direction;
        slide.addText(
          `${changeArrow(dir)} ${Math.abs(change.percent).toFixed(1)}%`,
          {
            x,
            y: 1.65,
            w: cardW,
            h: 0.25,
            fontSize: 8,
            fontFace: "Calibri",
            color: changeColor(dir),
            align: "center",
            margin: 0,
          },
        );
      }
    });
  }

  // Table
  const rows = data.platforms.flatMap((p) => p.rows);
  addDataTable(pres, slide, config, rows, data, formulas, 2.2);
}

function buildTableSlide(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
) {
  // Title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.5,
    fontSize: 24,
    fontFace: "Calibri",
    bold: true,
    color: COLORS.dark,
    margin: 0,
  });

  // Filter rows by platform
  const platformData = config.platformFilter
    ? data.platforms.find((p) => p.platform === config.platformFilter)
    : null;
  const currentVals = platformData
    ? { ...platformData.totals, ...platformData.metrics }
    : { ...data.overall.totals, ...data.overall.metrics };

  const compPlatform =
    config.platformFilter && data.comparison
      ? data.comparison.platforms.find(
          (p) => p.platform === config.platformFilter,
        )
      : null;
  const prevVals = compPlatform
    ? { ...compPlatform.totals, ...compPlatform.metrics }
    : data.comparison
      ? {
          ...data.comparison.overall.totals,
          ...data.comparison.overall.metrics,
        }
      : null;

  // KPI cards
  const kpis = config.kpiCards;
  let tableY = 1;

  if (kpis.length > 0) {
    const cardW = Math.min(2, (9 - (kpis.length - 1) * 0.15) / kpis.length);
    const gap = 0.15;

    kpis.forEach((kpi, i) => {
      const x = 0.5 + i * (cardW + gap);
      const value = currentVals[kpi.metric] ?? null;
      const prevValue = prevVals?.[kpi.metric] ?? null;
      const change = kpi.showChange ? computeChange(value, prevValue) : null;

      slide.addShape(SHAPE_ROUNDED_RECT, {
        x,
        y: 0.95,
        w: cardW,
        h: 0.9,
        fill: { color: COLORS.bg },
        rectRadius: 0.08,
        shadow: makeShadow(),
      });

      slide.addText(kpi.label, {
        x,
        y: 1,
        w: cardW,
        h: 0.22,
        fontSize: 8,
        fontFace: "Calibri",
        color: COLORS.muted,
        align: "center",
        margin: 0,
      });

      slide.addText(fmtCompact(value), {
        x,
        y: 1.2,
        w: cardW,
        h: 0.3,
        fontSize: 16,
        fontFace: "Calibri",
        bold: true,
        color: COLORS.dark,
        align: "center",
        margin: 0,
      });

      if (change && change.percent !== null) {
        slide.addText(
          `${changeArrow(change.direction)} ${Math.abs(change.percent).toFixed(1)}%`,
          {
            x,
            y: 1.5,
            w: cardW,
            h: 0.22,
            fontSize: 8,
            fontFace: "Calibri",
            color: changeColor(change.direction),
            align: "center",
            margin: 0,
          },
        );
      }
    });

    tableY = 2.1;
  }

  // Table
  const rows = platformData
    ? platformData.rows
    : data.platforms.flatMap((p) => p.rows);
  addDataTable(pres, slide, config, rows, data, formulas, tableY);
}

function buildTableChartsSlide(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
) {
  // Title
  slide.addText(config.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.5,
    fontSize: 24,
    fontFace: "Calibri",
    bold: true,
    color: COLORS.dark,
    margin: 0,
  });

  const platformData = config.platformFilter
    ? data.platforms.find((p) => p.platform === config.platformFilter)
    : null;
  const rows = platformData
    ? platformData.rows
    : data.platforms.flatMap((p) => p.rows);

  // Left side: table (60% width)
  addDataTable(pres, slide, config, rows, data, formulas, 1, 0.5, 5.5);

  // Right side: donut charts from chart/demo data
  if (config.charts && config.charts.length > 0) {
    config.charts.forEach((chart, i) => {
      const chartY = 1 + i * 2.2;

      // Find matching chart data set
      const chartDataSet = data.chartData.find(
        (cd) =>
          cd.platform === config.platformFilter &&
          cd.categoryKey === chart.groupBy,
      );

      if (!chartDataSet || chartDataSet.rows.length === 0) return;

      const labels = chartDataSet.rows.map((r) => r.category);
      const values = chartDataSet.rows.map(
        (r) => (r.values[chart.metric] as number) ?? 0,
      );

      slide.addChart(CHART_DOUGHNUT, [{ name: chart.title, labels, values }], {
        x: 6.3,
        y: chartY,
        w: 3.2,
        h: 2,
        showTitle: true,
        title: chart.title,
        titleColor: COLORS.dark,
        titleFontSize: 10,
        showPercent: true,
        dataLabelColor: COLORS.dark,
        dataLabelFontSize: 8,
        chartColors: COLORS.chart.slice(0, labels.length),
        legendPos: "b",
        legendFontSize: 7,
        legendColor: COLORS.muted,
      });
    });
  }
}

// ── Shared: data table ──

function addDataTable(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  rows: ProcessedRow[],
  data: ReportData,
  formulas: FormulaConfig[],
  startY: number,
  startX: number = 0.5,
  tableW: number = 9,
) {
  const grouped = groupRowsBy(rows, config.table.groupBy, formulas);
  const cols = config.table.columns;
  const colCount = cols.length + 1; // +1 for group column
  const colW = [tableW * 0.3, ...cols.map(() => (tableW * 0.7) / cols.length)];

  // Header row
  const headerRow: pptxgen.TableCell[] = [
    {
      text:
        config.table.groupBy.charAt(0).toUpperCase() +
        config.table.groupBy.slice(1),
      options: {
        bold: true,
        fontSize: 9,
        fontFace: "Calibri",
        color: COLORS.white,
        fill: { color: COLORS.dark },
        align: "left",
        valign: "middle",
      },
    },
    ...cols.map((col) => ({
      text: col.toUpperCase(),
      options: {
        bold: true,
        fontSize: 9,
        fontFace: "Calibri",
        color: COLORS.white,
        fill: { color: COLORS.dark },
        align: "right" as const,
        valign: "middle" as const,
      },
    })),
  ];

  // Data rows
  const dataRows: pptxgen.TableCell[][] = grouped
    .slice(0, 12)
    .map((row, idx) => [
      {
        text: row.group,
        options: {
          fontSize: 9,
          fontFace: "Calibri",
          color: COLORS.body,
          fill: { color: idx % 2 === 0 ? COLORS.white : COLORS.bg },
          align: "left",
          valign: "middle",
        },
      },
      ...cols.map((col) => ({
        text: fmtCompact(row.totals[col] ?? row.metrics[col] ?? null),
        options: {
          fontSize: 9,
          fontFace: "Calibri",
          color: COLORS.body,
          fill: { color: idx % 2 === 0 ? COLORS.white : COLORS.bg },
          align: "right" as const,
          valign: "middle" as const,
        },
      })),
    ]);

  // Total row
  if (config.table.showTotal) {
    const platformData = config.platformFilter
      ? data.platforms.find((p) => p.platform === config.platformFilter)
      : null;
    const totals = platformData
      ? { ...platformData.totals, ...platformData.metrics }
      : { ...data.overall.totals, ...data.overall.metrics };

    dataRows.push([
      {
        text: "Total",
        options: {
          bold: true,
          fontSize: 9,
          fontFace: "Calibri",
          color: COLORS.dark,
          fill: { color: COLORS.border },
          align: "left",
          valign: "middle",
        },
      },
      ...cols.map((col) => ({
        text: fmtCompact(totals[col] ?? null),
        options: {
          bold: true,
          fontSize: 9,
          fontFace: "Calibri",
          color: COLORS.dark,
          fill: { color: COLORS.border },
          align: "right" as const,
          valign: "middle" as const,
        },
      })),
    ]);
  }

  slide.addTable([headerRow, ...dataRows], {
    x: startX,
    y: startY,
    w: tableW,
    colW,
    border: { pt: 0.5, color: COLORS.border },
    rowH: 0.28,
    margin: [2, 4, 2, 4],
  });
}
