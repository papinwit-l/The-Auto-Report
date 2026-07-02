// ── Column mapping types ──
export const COLUMN_TYPES = {
  campaign: "Campaign Name",
  adgroup: "Ad Group",
  platform: "Platform",
  date: "Date",
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
  conversions: "Conversions",
  revenue: "Revenue",
  reach: "Reach",
  video_views: "Video Views",
  engagements: "Engagements",
  followers: "Followers Gained",
} as const;

export type ColumnTypeKey = keyof typeof COLUMN_TYPES;

// ── Built-in formulas ──
export const BUILT_IN_METRICS: Record<
  string,
  { label: string; formula: string; requires: string[] }
> = {
  ctr: {
    label: "CTR (%)",
    formula: "clicks / impressions * 100",
    requires: ["clicks", "impressions"],
  },
  cpc: {
    label: "CPC",
    formula: "spend / clicks",
    requires: ["spend", "clicks"],
  },
  cpm: {
    label: "CPM",
    formula: "spend / impressions * 1000",
    requires: ["spend", "impressions"],
  },
  cpr: {
    label: "CPR",
    formula: "spend / reach * 1000",
    requires: ["spend", "reach"],
  },
  cpa: {
    label: "CPA",
    formula: "spend / conversions",
    requires: ["spend", "conversions"],
  },
  roas: {
    label: "ROAS",
    formula: "revenue / spend",
    requires: ["revenue", "spend"],
  },
  cvr: {
    label: "CVR (%)",
    formula: "conversions / clicks * 100",
    requires: ["conversions", "clicks"],
  },
};

// ── Date formats ──
export type DateFormatOption =
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "YYYY/MM/DD"
  | "serial"
  | "auto";

// ── Chart category types (for demographic/breakdown tabs) ──
export const CHART_CATEGORY_TYPES = {
  age: "Age",
  gender: "Gender",
  device: "Device",
  location: "Location",
  placement: "Placement",
} as const;

export type ChartCategoryKey = keyof typeof CHART_CATEGORY_TYPES;

// ── Platform tab mapping ──
export type PlatformTabMapping = {
  sheetName: string;
  platformLabel: string;
  dateColumn: string;
  dateFormat: DateFormatOption;
  columnMap: Record<string, string>; // columnTypeKey → actual sheet column header
  // Chart/demo tab (optional)
  chartSheetName?: string; // e.g. "FB Demo"
  chartColumnMap?: Record<string, string>; // category + metric keys → sheet column headers
};

// ── Formula config ──
export type FormulaConfig = {
  id: string;
  key: string;
  label: string;
  formula: string;
  requires: string[];
  isBuiltIn: boolean;
};

// ── Project mapping template (saved to disk) ──
export type ProjectMapping = {
  id: string;
  name: string;
  spreadsheetId: string;
  platforms: PlatformTabMapping[];
  formulas: FormulaConfig[];
  customColumns: Record<string, string>; // key → label, e.g. { leads: "Leads", link_clicks: "Link Clicks" }
  createdAt: string;
  updatedAt: string;
};

// ── Date range ──
export type DateRange = {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
} | null; // null = "All data"

// ── Slide types ──
export type SlideTemplate =
  | "overall"
  | "single_table"
  | "table_charts"
  | "table_creatives";

export type KpiCardConfig = {
  metric: string;
  label: string;
  format: "number" | "currency" | "percent";
  showChange: boolean;
  section: "awareness" | "conversions";
};

export type TableConfig = {
  groupBy: string;
  columns: string[];
  showTotal: boolean;
};

export type ChartConfig = {
  type: "donut";
  title: string;
  groupBy: string; // chart category key: age, gender, device, etc.
  metric: string; // which metric to chart: impressions, spend, clicks, etc.
};

export type SlideConfig = {
  id: string;
  template: SlideTemplate;
  title: string;
  platformFilter?: string;
  kpiCards: KpiCardConfig[];
  table: TableConfig;
  charts?: ChartConfig[];
  summary: string[];
};

export type SlideTemplateFile = {
  id: string;
  name: string;
  slides: SlideConfig[];
  createdAt: string;
  updatedAt: string;
};

// ── Summary rules ──
export const SUMMARY_RULES = {
  overall: [
    "Overall: CPL {cpl} THB with {conversions} conversions",
    "Highest conversion channel: {topChannel} with {channelConversions} conversions ({channelConvPct}% of total)",
  ],
  platform_detail: [
    "Overall reach: {reach} reaches",
    "Average {mainMetric}: {mainMetricValue} THB (per 1000 reaches)",
    "Top {groupBy}: {topGroup} (with {topGroupValue} {mainMetricLabel})",
  ],
  creative: [
    "Top creative: {topCreativeName} (with {topCreativeValue} {mainMetricLabel})",
  ],
};

// ── Sheet data ──
export type SheetTabInfo = {
  name: string;
  index: number;
};

export type RawSheetData = {
  headers: string[];
  rows: (string | number | null)[][];
};
