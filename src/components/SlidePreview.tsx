"use client";

import type { SlideConfig, FormulaConfig } from "@/types";
import type { ReportData, PlatformData, ChartDataSet } from "@/lib/dataUtils";
import { computeChange, groupRowsBy } from "@/lib/dataUtils";

type Props = {
  slide: SlideConfig;
  data: ReportData | null;
  formulas: FormulaConfig[];
  isActive: boolean;
  onClick: () => void;
};

function formatMetric(value: number | null): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#4f46e5",
];

// Simple SVG donut chart
function MiniDonut({
  data,
  size = 80,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const strokeWidth = size * 0.18;
  const circumference = 2 * Math.PI * r;

  // Pre-compute each segment's dash and offset
  const segments = data.reduce<
    { dash: number; offset: number; color: string }[]
  >((acc, d) => {
    const prevOffset =
      acc.length > 0
        ? acc[acc.length - 1].offset + acc[acc.length - 1].dash
        : 0;
    acc.push({
      dash: (d.value / total) * circumference,
      offset: prevOffset,
      color: d.color,
    });
    return acc;
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

export default function SlidePreview({
  slide,
  data,
  formulas,
  isActive,
  onClick,
}: Props) {
  // Get platform-specific or overall data
  const platformData: PlatformData | null = slide.platformFilter
    ? (data?.platforms.find((p) => p.platform === slide.platformFilter) ?? null)
    : null;

  const comparisonPlatformData: PlatformData | null = slide.platformFilter
    ? (data?.comparison?.platforms.find(
        (p) => p.platform === slide.platformFilter,
      ) ?? null)
    : null;

  const currentTotals = platformData
    ? { ...platformData.totals, ...platformData.metrics }
    : data
      ? { ...data.overall.totals, ...data.overall.metrics }
      : {};

  const prevTotals = comparisonPlatformData
    ? { ...comparisonPlatformData.totals, ...comparisonPlatformData.metrics }
    : data?.comparison
      ? {
          ...data.comparison.overall.totals,
          ...data.comparison.overall.metrics,
        }
      : null;

  // Group rows for table
  const rows = platformData
    ? platformData.rows
    : (data?.platforms.flatMap((p) => p.rows) ?? []);

  const grouped = groupRowsBy(rows, slide.table.groupBy, formulas);

  // Chart data
  const hasCharts = slide.charts && slide.charts.length > 0 && data?.chartData;
  const tableWidth = hasCharts ? "60%" : "100%";

  return (
    <button
      onClick={onClick}
      className={`block w-full text-left transition-all ${
        isActive ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-zinc-700"
      }`}
    >
      {/* 16:9 container */}
      <div
        className="relative bg-white text-zinc-900 rounded-lg overflow-hidden"
        style={{ paddingBottom: "56.25%" }}
      >
        <div
          className="absolute inset-0 p-5 flex flex-col"
          style={{ fontSize: "0.55rem" }}
        >
          {/* Title bar */}
          <div className="mb-3">
            <h3 className="text-sm font-bold text-zinc-800">{slide.title}</h3>
            {slide.platformFilter && (
              <p className="text-zinc-500" style={{ fontSize: "0.5rem" }}>
                {slide.platformFilter}
              </p>
            )}
          </div>

          {/* KPI Cards */}
          {slide.kpiCards.length > 0 && (
            <div className="flex gap-2 mb-3">
              {slide.kpiCards.map((kpi) => {
                const value = currentTotals[kpi.metric] ?? null;
                const prevValue = prevTotals?.[kpi.metric] ?? null;
                const change = kpi.showChange
                  ? computeChange(value, prevValue)
                  : null;

                return (
                  <div
                    key={kpi.metric}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded px-2 py-1.5"
                  >
                    <p
                      className="text-zinc-500 uppercase tracking-wider"
                      style={{ fontSize: "0.4rem" }}
                    >
                      {kpi.label}
                    </p>
                    <p
                      className="font-bold text-zinc-800"
                      style={{ fontSize: "0.7rem" }}
                    >
                      {kpi.format === "currency" && "฿"}
                      {formatMetric(value)}
                    </p>
                    {change && change.percent !== null && (
                      <p
                        className={`${
                          change.direction === "up"
                            ? "text-emerald-600"
                            : change.direction === "down"
                              ? "text-red-500"
                              : "text-zinc-400"
                        }`}
                        style={{ fontSize: "0.4rem" }}
                      >
                        {change.direction === "up"
                          ? "↑"
                          : change.direction === "down"
                            ? "↓"
                            : "→"}{" "}
                        {Math.abs(change.percent).toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Content area: table + charts side by side */}
          <div className="flex-1 flex gap-3 overflow-hidden">
            {/* Table */}
            {grouped.length > 0 && (
              <div style={{ width: tableWidth }} className="overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300">
                      <th
                        className="text-left py-0.5 px-1 text-zinc-500 font-medium"
                        style={{ fontSize: "0.45rem" }}
                      >
                        {slide.table.groupBy}
                      </th>
                      {slide.table.columns.map((col) => (
                        <th
                          key={col}
                          className="text-right py-0.5 px-1 text-zinc-500 font-medium"
                          style={{ fontSize: "0.45rem" }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.slice(0, 8).map((row) => (
                      <tr key={row.group} className="border-b border-zinc-100">
                        <td
                          className="py-0.5 px-1 truncate max-w-[120px]"
                          style={{ fontSize: "0.45rem" }}
                        >
                          {row.group}
                        </td>
                        {slide.table.columns.map((col) => (
                          <td
                            key={col}
                            className="text-right py-0.5 px-1"
                            style={{ fontSize: "0.45rem" }}
                          >
                            {formatMetric(
                              row.totals[col] ?? row.metrics[col] ?? null,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {slide.table.showTotal && (
                      <tr className="border-t-2 border-zinc-300 font-bold">
                        <td
                          className="py-0.5 px-1"
                          style={{ fontSize: "0.45rem" }}
                        >
                          Total
                        </td>
                        {slide.table.columns.map((col) => (
                          <td
                            key={col}
                            className="text-right py-0.5 px-1"
                            style={{ fontSize: "0.45rem" }}
                          >
                            {formatMetric(currentTotals[col] ?? null)}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
                {grouped.length > 8 && (
                  <p
                    className="text-zinc-400 mt-1"
                    style={{ fontSize: "0.4rem" }}
                  >
                    +{grouped.length - 8} more rows
                  </p>
                )}
              </div>
            )}

            {/* Charts */}
            {hasCharts && (
              <div style={{ width: "40%" }} className="flex flex-col gap-2">
                {slide.charts!.map((chart, i) => {
                  const chartDataSet = data?.chartData?.find(
                    (cd) =>
                      cd.platform === slide.platformFilter &&
                      cd.categoryKey === chart.groupBy,
                  );

                  if (!chartDataSet || chartDataSet.rows.length === 0) {
                    return (
                      <div
                        key={i}
                        className="flex-1 flex items-center justify-center text-zinc-400 border border-dashed border-zinc-200 rounded"
                        style={{ fontSize: "0.4rem" }}
                      >
                        No chart data
                      </div>
                    );
                  }

                  const donutData = chartDataSet.rows.map((r, ri) => ({
                    label: r.category,
                    value: (r.values[chart.metric] as number) ?? 0,
                    color: CHART_COLORS[ri % CHART_COLORS.length],
                  }));

                  const total = donutData.reduce((s, d) => s + d.value, 0);

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <p
                        className="font-medium text-zinc-700 mb-1"
                        style={{ fontSize: "0.45rem" }}
                      >
                        {chart.title || `By ${chart.groupBy}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <MiniDonut data={donutData} size={60} />
                        <div className="space-y-0.5">
                          {donutData.slice(0, 5).map((d, di) => (
                            <div key={di} className="flex items-center gap-1">
                              <div
                                className="rounded-full"
                                style={{
                                  width: 4,
                                  height: 4,
                                  backgroundColor: d.color,
                                }}
                              />
                              <span
                                style={{ fontSize: "0.35rem" }}
                                className="text-zinc-600"
                              >
                                {d.label} (
                                {total > 0
                                  ? ((d.value / total) * 100).toFixed(0)
                                  : 0}
                                %)
                              </span>
                            </div>
                          ))}
                          {donutData.length > 5 && (
                            <span
                              style={{ fontSize: "0.35rem" }}
                              className="text-zinc-400"
                            >
                              +{donutData.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* No data state */}
          {!data && (
            <div className="flex-1 flex items-center justify-center text-zinc-400">
              <p style={{ fontSize: "0.6rem" }}>
                Set a date range and fetch data to preview
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
