import { evaluateFormula } from "./formulas";
import type { FormulaConfig } from "@/types";

// ── Processed row: mapped column keys → numeric values ──
export type ProcessedRow = {
  platform: string;
  rawRow: Record<string, string | number | null>;
  values: Record<string, number | null>;
};

// ── Per-platform aggregated data ──
export type PlatformData = {
  platform: string;
  sheetName: string;
  rows: ProcessedRow[];
  totals: Record<string, number | null>;
  metrics: Record<string, number | null>;
};

// ── Chart/demographic data ──
export type ChartDataRow = {
  category: string; // the category value (e.g. "Male", "18-24")
  values: Record<string, number | null>; // metric key → value
};

export type ChartDataSet = {
  platform: string;
  categoryKey: string; // e.g. "gender", "age"
  rows: ChartDataRow[];
};

// ── Full processed report data ──
export type ReportData = {
  platforms: PlatformData[];
  overall: {
    totals: Record<string, number | null>;
    metrics: Record<string, number | null>;
  };
  comparison: {
    platforms: PlatformData[];
    overall: {
      totals: Record<string, number | null>;
      metrics: Record<string, number | null>;
    };
  } | null;
  chartData: ChartDataSet[]; // demographic breakdowns per platform
  dateRange: import("@/types").DateRange;
};

/**
 * Compute % change between current and previous values
 */
export function computeChange(
  current: number | null,
  previous: number | null,
): {
  value: number | null;
  percent: number | null;
  direction: "up" | "down" | "flat";
} {
  if (current === null || previous === null || previous === 0) {
    return { value: null, percent: null, direction: "flat" };
  }

  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;

  return {
    value: diff,
    percent: pct,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

/**
 * Group rows by a column key (e.g. campaign, adgroup, platform)
 */
export function groupRowsBy(
  rows: ProcessedRow[],
  groupKey: string,
  formulas: FormulaConfig[],
): {
  group: string;
  totals: Record<string, number | null>;
  metrics: Record<string, number | null>;
  rowCount: number;
}[] {
  const groups: Record<string, ProcessedRow[]> = {};

  for (const row of rows) {
    const key = String(row.rawRow[groupKey] ?? row.values[groupKey] ?? "Other");
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  return Object.entries(groups).map(([group, groupRows]) => {
    const agg = aggregateRows(groupRows, formulas);
    return {
      group,
      totals: agg.totals,
      metrics: agg.metrics,
      rowCount: groupRows.length,
    };
  });
}

/**
 * Aggregate rows: sum raw values, then compute derived metrics
 */
export function aggregateRows(
  rows: ProcessedRow[],
  formulas: FormulaConfig[],
): {
  totals: Record<string, number | null>;
  metrics: Record<string, number | null>;
} {
  if (rows.length === 0) {
    return { totals: {}, metrics: {} };
  }

  const totals: Record<string, number> = {};
  for (const row of rows) {
    for (const [key, val] of Object.entries(row.values)) {
      if (val !== null) {
        totals[key] = (totals[key] ?? 0) + val;
      }
    }
  }

  const totalsNullable: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(totals)) {
    totalsNullable[k] = v;
  }

  const metrics: Record<string, number | null> = {};
  for (const formula of formulas) {
    metrics[formula.key] = evaluateFormula(formula.formula, totalsNullable);
  }

  return { totals: totalsNullable, metrics };
}
