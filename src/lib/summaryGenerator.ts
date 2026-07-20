import type { SlideConfig, FormulaConfig } from "@/types";
import type { ReportData, PlatformData, ProcessedRow } from "./dataUtils";
import { computeChange, groupRowsBy } from "./dataUtils";

function fmtNum(value: number | null, decimals = 0): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(value: number | null): string {
  if (value === null) return "-";
  return value.toFixed(1) + "%";
}

function changeText(
  current: number | null,
  previous: number | null,
  label: string,
): string | null {
  const change = computeChange(current, previous);
  if (change.percent === null) return null;
  const dir =
    change.direction === "up"
      ? "increased"
      : change.direction === "down"
        ? "decreased"
        : "unchanged";
  return `${label} ${dir} by ${fmtPct(Math.abs(change.percent))}`;
}

/**
 * Generate auto summary lines for a slide based on its template and data
 */
export function generateSummary(
  slide: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
): string[] {
  const lines: string[] = [];

  switch (slide.template) {
    case "overall":
      lines.push(...generateOverallSummary(slide, data, formulas));
      break;
    case "single_table":
    case "table_charts":
      lines.push(...generatePlatformSummary(slide, data, formulas));
      break;
    case "table_creatives":
      lines.push(...generateCreativeSummary(slide, data, formulas));
      break;
  }

  return lines;
}

function generateOverallSummary(
  slide: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
): string[] {
  const lines: string[] = [];
  const totals = { ...data.overall.totals, ...data.overall.metrics };
  const prevTotals = data.comparison
    ? { ...data.comparison.overall.totals, ...data.comparison.overall.metrics }
    : null;

  // Total spend and impressions
  if (totals.spend !== null) {
    lines.push(
      `Total spend: ฿${fmtNum(totals.spend)} with ${fmtNum(totals.impressions)} impressions.`,
    );
  }

  // Conversions + CPA if available
  if (totals.conversions !== null && totals.conversions > 0) {
    const cpa =
      totals.spend !== null ? totals.spend / totals.conversions : null;
    lines.push(
      `Total conversions: ${fmtNum(totals.conversions)}` +
        (cpa !== null ? ` at ฿${fmtNum(cpa, 2)} per conversion.` : "."),
    );
  }

  // Top performing platform by spend
  if (data.platforms.length > 1) {
    const grouped = groupRowsBy(
      data.platforms.flatMap((p) => p.rows),
      slide.table.groupBy,
      formulas,
    );

    if (grouped.length > 0) {
      // Top by spend
      const topBySpend = [...grouped].sort(
        (a, b) => (b.totals.spend ?? 0) - (a.totals.spend ?? 0),
      )[0];

      if (topBySpend && topBySpend.totals.spend) {
        const totalSpend = totals.spend ?? 1;
        const pct = ((topBySpend.totals.spend / totalSpend) * 100).toFixed(1);
        lines.push(
          `Highest spend: ${topBySpend.group} at ฿${fmtNum(topBySpend.totals.spend)} (${pct}% of total).`,
        );
      }

      // Top by conversions
      const topByConv = [...grouped].sort(
        (a, b) => (b.totals.conversions ?? 0) - (a.totals.conversions ?? 0),
      )[0];

      if (
        topByConv &&
        topByConv.totals.conversions &&
        topByConv.totals.conversions > 0
      ) {
        const totalConv = totals.conversions ?? 1;
        const pct = ((topByConv.totals.conversions / totalConv) * 100).toFixed(
          1,
        );
        lines.push(
          `Top conversion channel: ${topByConv.group} with ${fmtNum(topByConv.totals.conversions)} conversions (${pct}%).`,
        );
      }
    }
  }

  // Key changes vs previous period
  if (prevTotals) {
    const changes = [
      changeText(totals.impressions, prevTotals.impressions, "Impressions"),
      changeText(totals.spend, prevTotals.spend, "Spend"),
      changeText(totals.clicks, prevTotals.clicks, "Clicks"),
    ].filter(Boolean) as string[];

    if (changes.length > 0) {
      lines.push("vs. previous period: " + changes.join(", ") + ".");
    }
  }

  return lines;
}

function generatePlatformSummary(
  slide: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
): string[] {
  const lines: string[] = [];

  const pd = slide.platformFilter
    ? data.platforms.find((p) => p.platform === slide.platformFilter)
    : null;

  const totals = pd
    ? { ...pd.totals, ...pd.metrics }
    : { ...data.overall.totals, ...data.overall.metrics };

  const prevPd =
    slide.platformFilter && data.comparison
      ? data.comparison.platforms.find(
          (p) => p.platform === slide.platformFilter,
        )
      : null;

  const prevTotals = prevPd
    ? { ...prevPd.totals, ...prevPd.metrics }
    : data.comparison
      ? {
          ...data.comparison.overall.totals,
          ...data.comparison.overall.metrics,
        }
      : null;

  const platformName = slide.platformFilter ?? "All platforms";

  // Reach and impressions overview
  if (totals.reach !== null) {
    lines.push(
      `${platformName}: ${fmtNum(totals.reach)} reach, ${fmtNum(totals.impressions)} impressions.`,
    );
  } else if (totals.impressions !== null) {
    lines.push(
      `${platformName}: ${fmtNum(totals.impressions)} impressions, ${fmtNum(totals.clicks)} clicks.`,
    );
  }

  // Spend + CTR/CPC
  if (totals.spend !== null) {
    const parts = [`Spend: ฿${fmtNum(totals.spend)}`];
    if (totals.ctr !== null) parts.push(`CTR: ${fmtPct(totals.ctr)}`);
    if (totals.cpc !== null) parts.push(`CPC: ฿${fmtNum(totals.cpc, 2)}`);
    if (totals.cpm !== null) parts.push(`CPM: ฿${fmtNum(totals.cpm, 2)}`);
    lines.push(parts.join(" | ") + ".");
  }

  // Top group
  const rows = pd ? pd.rows : data.platforms.flatMap((p) => p.rows);
  const grouped = groupRowsBy(rows, slide.table.groupBy, formulas);

  if (grouped.length > 1) {
    const topBySpend = [...grouped].sort(
      (a, b) => (b.totals.spend ?? 0) - (a.totals.spend ?? 0),
    )[0];

    if (topBySpend && topBySpend.totals.spend) {
      lines.push(
        `Top ${slide.table.groupBy}: ${topBySpend.group} (spend: ฿${fmtNum(topBySpend.totals.spend)}, clicks: ${fmtNum(topBySpend.totals.clicks)}).`,
      );
    }
  }

  // Change vs previous
  if (prevTotals) {
    const changes = [
      changeText(totals.impressions, prevTotals.impressions, "Impressions"),
      changeText(totals.spend, prevTotals.spend, "Spend"),
    ].filter(Boolean) as string[];

    if (changes.length > 0) {
      lines.push("vs. previous period: " + changes.join(", ") + ".");
    }
  }

  return lines;
}

function generateCreativeSummary(
  slide: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
): string[] {
  const lines: string[] = [];

  const pd = slide.platformFilter
    ? data.platforms.find((p) => p.platform === slide.platformFilter)
    : null;

  const rows = pd ? pd.rows : data.platforms.flatMap((p) => p.rows);
  const grouped = groupRowsBy(rows, slide.table.groupBy, formulas);

  if (grouped.length === 0) return lines;

  // Top creative by spend
  const topBySpend = [...grouped].sort(
    (a, b) => (b.totals.spend ?? 0) - (a.totals.spend ?? 0),
  )[0];

  if (topBySpend) {
    lines.push(
      `Top creative by spend: ${topBySpend.group} at ฿${fmtNum(topBySpend.totals.spend)}.`,
    );
  }

  // Top creative by clicks
  const topByClicks = [...grouped].sort(
    (a, b) => (b.totals.clicks ?? 0) - (a.totals.clicks ?? 0),
  )[0];

  if (topByClicks && topByClicks.group !== topBySpend?.group) {
    lines.push(
      `Top by clicks: ${topByClicks.group} with ${fmtNum(topByClicks.totals.clicks)} clicks.`,
    );
  }

  // Best CPC
  const withCpc = grouped
    .map((g) => ({
      ...g,
      cpc:
        g.totals.spend && g.totals.clicks
          ? g.totals.spend / g.totals.clicks
          : null,
    }))
    .filter((g) => g.cpc !== null && g.totals.clicks && g.totals.clicks > 10)
    .sort((a, b) => (a.cpc ?? 99999) - (b.cpc ?? 99999));

  if (withCpc.length > 0) {
    lines.push(
      `Best CPC: ${withCpc[0].group} at ฿${fmtNum(withCpc[0].cpc, 2)}.`,
    );
  }

  return lines;
}
