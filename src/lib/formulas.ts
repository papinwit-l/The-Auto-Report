import { BUILT_IN_METRICS } from "@/types";
import type { FormulaConfig } from "@/types";

/**
 * Get default formula configs from built-in metrics
 */
export function getBuiltInFormulas(): FormulaConfig[] {
  return Object.entries(BUILT_IN_METRICS).map(([key, meta]) => ({
    id: key,
    key,
    label: meta.label,
    formula: meta.formula,
    requires: meta.requires,
    isBuiltIn: true,
  }));
}

/**
 * Evaluate a formula string given a set of variable values.
 * Supports basic math: +, -, *, /
 * Variables are replaced by name.
 *
 * Returns null if any required variable is missing or result is NaN/Infinity.
 */
export function evaluateFormula(
  formula: string,
  values: Record<string, number | null>
): number | null {
  let expression = formula;

  // Replace variable names with values (longest match first to avoid partial replacement)
  const varNames = Object.keys(values).sort((a, b) => b.length - a.length);

  for (const varName of varNames) {
    const val = values[varName];
    if (val === null || val === undefined) return null;
    // Use word boundary replacement
    expression = expression.replace(
      new RegExp(`\\b${varName}\\b`, "g"),
      String(val)
    );
  }

  try {
    // Only allow numbers, basic operators, parens, spaces, dots
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return null;
    }

    const result = new Function(`"use strict"; return (${expression})`)();

    if (typeof result !== "number" || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Check if all required variables are available in the column map
 */
export function canComputeFormula(
  formula: FormulaConfig,
  mappedColumns: string[]
): boolean {
  return formula.requires.every((req) => mappedColumns.includes(req));
}

/**
 * Compute all applicable formulas for a row of data
 */
export function computeMetrics(
  formulas: FormulaConfig[],
  rowValues: Record<string, number | null>
): Record<string, number | null> {
  const results: Record<string, number | null> = {};

  for (const formula of formulas) {
    results[formula.key] = evaluateFormula(formula.formula, rowValues);
  }

  return results;
}

/**
 * Aggregate raw values by summing, then compute derived metrics
 */
export function aggregateAndCompute(
  rows: Record<string, number | null>[],
  formulas: FormulaConfig[]
): Record<string, number | null> {
  if (rows.length === 0) return {};

  // Sum all raw values
  const totals: Record<string, number> = {};
  const keys = Object.keys(rows[0]);

  for (const key of keys) {
    totals[key] = 0;
    for (const row of rows) {
      totals[key] += row[key] ?? 0;
    }
  }

  // Compute derived metrics from totals
  const totalRecord: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(totals)) {
    totalRecord[k] = v;
  }

  const metrics = computeMetrics(formulas, totalRecord);

  return { ...totalRecord, ...metrics };
}
