"use client";

import { useState } from "react";
import {
  X,
  BarChart3,
  Table,
  PieChart,
  Image,
  Plus,
  Trash2,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import {
  CHART_CATEGORY_TYPES,
  type SlideConfig,
  type SlideTemplate,
  type KpiCardConfig,
  type ChartConfig,
  type ProjectMapping,
} from "@/types";

type Props = {
  template: ProjectMapping;
  editSlide?: SlideConfig;
  onAdd: (slide: SlideConfig) => void;
  onClose: () => void;
};

const SLIDE_TEMPLATES: {
  value: SlideTemplate;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "overall",
    label: "Overall Summary",
    description: "KPI cards + summary table across all platforms",
    icon: <BarChart3 size={20} />,
  },
  {
    value: "single_table",
    label: "Single Platform Table",
    description: "Detailed table for one platform with KPI cards",
    icon: <Table size={20} />,
  },
  {
    value: "table_charts",
    label: "Platform + Charts",
    description: "Table with donut charts from chart/demo data",
    icon: <PieChart size={20} />,
  },
  {
    value: "table_creatives",
    label: "Platform + Creatives",
    description: "Table grouped by creative with performance data",
    icon: <Image size={20} />,
  },
];

const DEFAULT_KPIS: KpiCardConfig[] = [
  {
    metric: "impressions",
    label: "Impressions",
    format: "number",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "reach",
    label: "Reach",
    format: "number",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "clicks",
    label: "Clicks",
    format: "number",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "ctr",
    label: "CTR",
    format: "percent",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "spend",
    label: "Spend",
    format: "currency",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "cpm",
    label: "CPM",
    format: "currency",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "cpc",
    label: "CPC",
    format: "currency",
    showChange: true,
    section: "awareness",
  },
  {
    metric: "conversions",
    label: "Conversions",
    format: "number",
    showChange: true,
    section: "conversions",
  },
  {
    metric: "cpa",
    label: "CPA",
    format: "currency",
    showChange: true,
    section: "conversions",
  },
  {
    metric: "revenue",
    label: "Revenue",
    format: "currency",
    showChange: true,
    section: "conversions",
  },
  {
    metric: "roas",
    label: "ROAS",
    format: "number",
    showChange: true,
    section: "conversions",
  },
];

export default function AddSlideDialog({
  template,
  editSlide,
  onAdd,
  onClose,
}: Props) {
  const isEdit = !!editSlide;
  const [selectedTemplate, setSelectedTemplate] =
    useState<SlideTemplate | null>(editSlide?.template ?? null);
  const [title, setTitle] = useState(editSlide?.title ?? "");
  const [platformFilter, setPlatformFilter] = useState(
    editSlide?.platformFilter ?? "",
  );
  const [selectedKpis, setSelectedKpis] = useState<KpiCardConfig[]>(
    editSlide?.kpiCards ?? [],
  );
  const [groupBy, setGroupBy] = useState(
    editSlide?.table.groupBy ?? "campaign",
  );
  const [tableColumns, setTableColumns] = useState<string[]>(
    editSlide?.table.columns ?? [
      "impressions",
      "clicks",
      "spend",
      "ctr",
      "cpc",
    ],
  );

  // Charts
  const [charts, setCharts] = useState<ChartConfig[]>(editSlide?.charts ?? []);

  const availableMetrics = [
    ...Object.keys(template.platforms[0]?.columnMap ?? {}).filter(
      (k) => k !== "campaign" && k !== "adgroup" && k !== "date",
    ),
    ...template.formulas.map((f) => f.key),
  ];

  // Get chart categories available for selected platform
  const selectedPlatform = template.platforms.find(
    (p) => p.platformLabel === platformFilter,
  );
  const hasChartTab = !!selectedPlatform?.chartSheetName;
  const chartCategories = selectedPlatform?.chartColumnMap
    ? Object.keys(selectedPlatform.chartColumnMap).filter((k) =>
        Object.keys(CHART_CATEGORY_TYPES).includes(k),
      )
    : [];
  const chartMetrics = selectedPlatform?.chartColumnMap
    ? Object.keys(selectedPlatform.chartColumnMap).filter(
        (k) => !Object.keys(CHART_CATEGORY_TYPES).includes(k),
      )
    : [];

  // Find first platform with a chart tab linked
  const platformWithChart = template.platforms.find((p) => p.chartSheetName);
  const firstPlatform = template.platforms[0]?.platformLabel ?? "";

  const handleSelectTemplate = (tmpl: SlideTemplate) => {
    setSelectedTemplate(tmpl);
    setCharts([]);

    switch (tmpl) {
      case "overall":
        setTitle("Overall Summary");
        setPlatformFilter("");
        setSelectedKpis(DEFAULT_KPIS.slice(0, 6));
        setGroupBy("platform");
        break;
      case "single_table":
        setTitle(template.platforms[0]?.platformLabel ?? "Platform Detail");
        setPlatformFilter(firstPlatform);
        setSelectedKpis(DEFAULT_KPIS.slice(0, 4));
        setGroupBy("campaign");
        break;
      case "table_charts":
        setTitle("Performance by Demographics");
        // Prefer a platform that has a chart/demo tab
        setPlatformFilter(platformWithChart?.platformLabel ?? firstPlatform);
        setSelectedKpis(DEFAULT_KPIS.slice(0, 4));
        setGroupBy("adgroup");
        break;
      case "table_creatives":
        setTitle("Creative Performance");
        setPlatformFilter(firstPlatform);
        setSelectedKpis([]);
        setGroupBy("campaign");
        break;
    }
  };

  const toggleKpi = (kpi: KpiCardConfig) => {
    setSelectedKpis((prev) => {
      const exists = prev.find((k) => k.metric === kpi.metric);
      if (exists) return prev.filter((k) => k.metric !== kpi.metric);
      return [...prev, kpi];
    });
  };

  const toggleTableColumn = (col: string) => {
    setTableColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const addChart = () => {
    setCharts((prev) => [
      ...prev,
      {
        type: "donut",
        title: "",
        groupBy: chartCategories[0] ?? "",
        metric: chartMetrics[0] ?? "impressions",
      },
    ]);
  };

  const updateChart = (index: number, updates: Partial<ChartConfig>) => {
    setCharts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    );
  };

  const removeChart = (index: number) => {
    setCharts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!selectedTemplate || !title.trim()) return;

    // Auto-generate chart titles if empty
    const finalCharts = charts.map((c) => ({
      ...c,
      title:
        c.title ||
        `By ${CHART_CATEGORY_TYPES[c.groupBy as keyof typeof CHART_CATEGORY_TYPES] ?? c.groupBy}`,
    }));

    const slide: SlideConfig = {
      id: editSlide?.id ?? uuid(),
      template: selectedTemplate,
      title,
      platformFilter: platformFilter || undefined,
      kpiCards: selectedKpis,
      table: {
        groupBy,
        columns: tableColumns,
        showTotal: true,
      },
      charts: finalCharts.length > 0 ? finalCharts : undefined,
      summary: [],
    };

    onAdd(slide);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-base font-medium">
            {selectedTemplate
              ? isEdit
                ? "Edit Slide"
                : "Configure Slide"
              : "Choose Slide Type"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Template selection */}
          {!selectedTemplate ? (
            <div className="grid grid-cols-2 gap-3">
              {SLIDE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.value}
                  onClick={() => handleSelectTemplate(tmpl.value)}
                  className="text-left border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group"
                >
                  <div className="text-zinc-500 group-hover:text-blue-400 transition-colors mb-2">
                    {tmpl.icon}
                  </div>
                  <p className="text-sm font-medium">{tmpl.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {tmpl.description}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ← Change slide type
              </button>

              {/* Title */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Slide title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Platform filter */}
              {selectedTemplate !== "overall" && (
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">
                    Platform
                  </label>
                  <select
                    value={platformFilter}
                    onChange={(e) => {
                      setPlatformFilter(e.target.value);
                      setCharts([]); // reset charts when platform changes
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">All platforms</option>
                    {template.platforms.map((p) => (
                      <option key={p.sheetName} value={p.platformLabel}>
                        {p.platformLabel}
                        {p.chartSheetName ? " 📊" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* KPI Cards */}
              {selectedTemplate !== "table_creatives" && (
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">
                    KPI cards
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_KPIS.filter(
                      (k) =>
                        availableMetrics.includes(k.metric) ||
                        k.metric === "impressions" ||
                        k.metric === "clicks" ||
                        k.metric === "spend",
                    ).map((kpi) => {
                      const isSelected = selectedKpis.some(
                        (k) => k.metric === kpi.metric,
                      );
                      return (
                        <button
                          key={kpi.metric}
                          onClick={() => toggleKpi(kpi)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            isSelected
                              ? "border-blue-500/50 bg-blue-950/30 text-blue-300"
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                          }`}
                        >
                          {kpi.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group by */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Group table by
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="campaign">Campaign</option>
                  <option value="adgroup">Ad Group</option>
                  <option value="platform">Platform</option>
                </select>
              </div>

              {/* Table columns */}
              <div>
                <label className="text-xs text-zinc-500 block mb-2">
                  Table columns
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableMetrics.map((col) => {
                    const isSelected = tableColumns.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleTableColumn(col)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Charts — available when a platform has a chart/demo tab */}
              <div>
                <label className="text-xs text-zinc-500 block mb-2">
                  Donut charts (from chart/demo tab)
                </label>

                {!platformFilter ? (
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>Select a platform above to add charts.</p>
                    {platformWithChart && (
                      <p className="text-amber-400/70">
                        Tip: {platformWithChart.platformLabel} has a chart tab
                        linked.
                      </p>
                    )}
                  </div>
                ) : !hasChartTab ? (
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      No chart/demo tab linked to{" "}
                      <span className="text-zinc-400">{platformFilter}</span>.
                    </p>
                    {platformWithChart ? (
                      <p className="text-amber-400/70">
                        Tip: Try switching to {platformWithChart.platformLabel}{" "}
                        which has a chart tab, or edit the template to link a
                        chart tab.
                      </p>
                    ) : (
                      <p className="text-amber-400/70">
                        To add charts: edit the template → Map Platforms step →
                        link a Chart/Demo tab to a platform.
                      </p>
                    )}
                  </div>
                ) : chartCategories.length === 0 ? (
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      Chart tab{" "}
                      <span className="text-zinc-400">
                        {selectedPlatform?.chartSheetName}
                      </span>{" "}
                      is linked but no category columns (age, gender, device,
                      etc.) are mapped.
                    </p>
                    <p className="text-amber-400/70">
                      Edit the template → Column Mapping step → map categories
                      under the chart data section.
                    </p>
                  </div>
                ) : chartMetrics.length === 0 ? (
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      Categories are mapped but no metric columns (impressions,
                      clicks, spend, etc.) are mapped for the chart tab.
                    </p>
                    <p className="text-amber-400/70">
                      Edit the template → Column Mapping step → map metrics
                      under the chart data section.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {charts.map((chart, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2"
                      >
                        <select
                          value={chart.groupBy}
                          onChange={(e) =>
                            updateChart(i, { groupBy: e.target.value })
                          }
                          className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          {chartCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {CHART_CATEGORY_TYPES[
                                cat as keyof typeof CHART_CATEGORY_TYPES
                              ] ?? cat}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-zinc-500">×</span>
                        <select
                          value={chart.metric}
                          onChange={(e) =>
                            updateChart(i, { metric: e.target.value })
                          }
                          className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          {chartMetrics.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={chart.title}
                          onChange={(e) =>
                            updateChart(i, { title: e.target.value })
                          }
                          placeholder="Title (auto)"
                          className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs focus:outline-none placeholder:text-zinc-500"
                        />
                        <button
                          onClick={() => removeChart(i)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addChart}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <Plus size={12} />
                      Add donut chart
                    </button>
                  </div>
                )}
              </div>

              {/* Add button */}
              <button
                onClick={handleAdd}
                disabled={!title.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isEdit ? "Update Slide" : "Add Slide"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
