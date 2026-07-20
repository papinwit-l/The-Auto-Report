import pptxgen from "pptxgenjs";
import sharp from "sharp";
import type { SlideConfig, FormulaConfig } from "@/types";
import type {
  ReportData,
  PlatformData,
  ProcessedRow,
  ChartDataSet,
} from "./dataUtils";
import { computeChange, groupRowsBy } from "./dataUtils";

type PptxOptions = {
  logo?: {
    data: string;
    w?: number;
    h?: number;
    x?: number;
    y?: number;
  };
};

const SHAPE_ROUNDED_RECT: pptxgen.SHAPE_NAME = "roundRect";

const C = {
  zinc50: "FAFAFA",
  zinc100: "F4F4F5",
  zinc200: "E4E4E7",
  zinc300: "D4D4D8",
  zinc400: "A1A1AA",
  zinc500: "71717A",
  zinc600: "52525B",
  zinc800: "27272A",
  zinc900: "18181B",
  white: "FFFFFF",
  emerald600: "059669",
  red500: "EF4444",
  chart: [
    "#2563EB",
    "#7C3AED",
    "#059669",
    "#D97706",
    "#DC2626",
    "#0891B2",
    "#DB2777",
    "#4F46E5",
  ],
};

// ── Display settings defaults ──
function ds(config: SlideConfig) {
  return {
    maxTableRows: config.displaySettings?.maxTableRows ?? 12,
    tableFontSize: config.displaySettings?.tableFontSize ?? 7,
    titleFontSize: config.displaySettings?.titleFontSize ?? 20,
    summaryPosition: config.displaySettings?.summaryPosition ?? "bottom",
  };
}

// ── Helpers ──
function fmtCompact(value: number | null): string {
  if (value === null) return "-";
  if (Math.abs(value) >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toLocaleString("en", { maximumFractionDigits: 2 });
}

function changeArrow(dir: "up" | "down" | "flat"): string {
  return dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
}

function changeColor(dir: "up" | "down" | "flat"): string {
  return dir === "up" ? C.emerald600 : dir === "down" ? C.red500 : C.zinc400;
}

// ── SVG donut chart generator ──
function generateDonutSVG(
  data: { label: string; value: number; color: string }[],
  title: string,
  width: number = 600,
  height: number = 400,
): string {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return "";

  const cx = width * 0.32;
  const cy = height * 0.5;
  const r = Math.min(width * 0.28, height * 0.32);
  const strokeWidth = r * 0.5;
  const circumference = 2 * Math.PI * r;

  const segments: { dash: number; offset: number; color: string }[] = [];
  let runningOffset = 0;
  for (const d of data) {
    const dash = (d.value / total) * circumference;
    segments.push({ dash, offset: runningOffset, color: d.color });
    runningOffset += dash;
  }

  const circles = segments
    .map(
      (seg) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${seg.color}" stroke-width="${strokeWidth}"
          stroke-dasharray="${seg.dash} ${circumference - seg.dash}"
          stroke-dashoffset="${-seg.offset}"
          transform="rotate(-90 ${cx} ${cy})" />`,
    )
    .join("\n");

  const legendX = width * 0.62;
  const legendStartY = height * 0.15;
  const legendItems = data
    .map((d, i) => {
      const y = legendStartY + i * 30;
      const pct = ((d.value / total) * 100).toFixed(1);
      return `
        <circle cx="${legendX + 6}" cy="${y + 6}" r="5" fill="${d.color}" />
        <text x="${legendX + 18}" y="${y + 10}" font-family="Calibri, Arial, sans-serif"
          font-size="13" fill="#52525B">${d.label} (${pct}%)</text>
      `;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}">
    <text x="${width / 2}" y="24" text-anchor="middle" font-family="Calibri, Arial, sans-serif"
      font-size="15" font-weight="600" fill="#27272A">${title}</text>
    ${circles}
    ${legendItems}
  </svg>`;
}

async function svgToPngBase64(svgString: string): Promise<string> {
  const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

// ── Data helpers ──
function getCurrentTotals(data: ReportData, platformFilter?: string) {
  const pd = platformFilter
    ? data.platforms.find((p) => p.platform === platformFilter)
    : null;
  return pd
    ? { ...pd.totals, ...pd.metrics }
    : { ...data.overall.totals, ...data.overall.metrics };
}

function getPrevTotals(data: ReportData, platformFilter?: string) {
  if (!data.comparison) return null;
  const pd = platformFilter
    ? data.comparison.platforms.find((p) => p.platform === platformFilter)
    : null;
  return pd
    ? { ...pd.totals, ...pd.metrics }
    : { ...data.comparison.overall.totals, ...data.comparison.overall.metrics };
}

function getRows(data: ReportData, platformFilter?: string): ProcessedRow[] {
  const pd = platformFilter
    ? data.platforms.find((p) => p.platform === platformFilter)
    : null;
  return pd ? pd.rows : data.platforms.flatMap((p) => p.rows);
}

// ── Main export ──
export async function generatePptx(
  slides: SlideConfig[],
  data: ReportData,
  formulas: FormulaConfig[],
  projectName: string,
  options: PptxOptions = {},
): Promise<Buffer> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Auto Report";
  pres.title = projectName;

  for (const slideConfig of slides) {
    const pptSlide = pres.addSlide();
    pptSlide.background = { color: C.white };

    if (options.logo) {
      pptSlide.addImage({
        data: options.logo.data,
        x: options.logo.x ?? 8.5,
        y: options.logo.y ?? 0.15,
        w: options.logo.w ?? 0.7,
        h: options.logo.h ?? 0.4,
      });
    }

    switch (slideConfig.template) {
      case "overall":
      case "single_table":
      case "table_creatives":
        await buildStandardSlide(pres, pptSlide, slideConfig, data, formulas);
        break;
      case "table_charts":
        await buildTableChartsSlide(
          pres,
          pptSlide,
          slideConfig,
          data,
          formulas,
        );
        break;
    }
  }

  const output = await pres.write({ outputType: "nodebuffer" });
  return output as Buffer;
}

// ── KPI cards ──
function addKpiCards(
  pres: pptxgen,
  slide: pptxgen.Slide,
  kpis: SlideConfig["kpiCards"],
  currentVals: Record<string, number | null>,
  prevVals: Record<string, number | null> | null,
  startY: number,
): number {
  if (kpis.length === 0) return startY;

  const cardW = Math.min(2, (9 - (kpis.length - 1) * 0.12) / kpis.length);
  const gap = 0.12;
  const padX = 0.1;
  const cardH = 0.85;

  kpis.forEach((kpi, i) => {
    const x = 0.5 + i * (cardW + gap);
    const textX = x + padX;
    const textW = cardW - padX * 2;

    const value = currentVals[kpi.metric] ?? null;
    const prevValue = prevVals?.[kpi.metric] ?? null;
    const change = kpi.showChange ? computeChange(value, prevValue) : null;

    slide.addShape(SHAPE_ROUNDED_RECT, {
      x,
      y: startY,
      w: cardW,
      h: cardH,
      fill: { color: C.zinc50 },
      line: { color: C.zinc200, width: 0.5 },
      rectRadius: 0.06,
    });

    slide.addText(kpi.label.toUpperCase(), {
      x: textX,
      y: startY + 0.06,
      w: textW,
      h: 0.18,
      fontSize: 7,
      fontFace: "Calibri",
      color: C.zinc500,
      align: "left",
    });

    slide.addText((kpi.format === "currency" ? "฿" : "") + fmtCompact(value), {
      x: textX,
      y: startY + 0.22,
      w: textW,
      h: 0.32,
      fontSize: 12,
      fontFace: "Calibri",
      bold: true,
      color: C.zinc800,
      align: "left",
    });

    if (change && change.percent !== null) {
      slide.addText(
        `${changeArrow(change.direction)} ${Math.abs(change.percent).toFixed(1)}%`,
        {
          x: textX,
          y: startY + 0.55,
          w: textW,
          h: 0.18,
          fontSize: 7,
          fontFace: "Calibri",
          color: changeColor(change.direction),
          align: "left",
        },
      );
    }
  });

  return startY + cardH + 0.15;
}

// ── Standard slide ──
async function buildStandardSlide(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
) {
  const { titleFontSize, summaryPosition } = ds(config);

  slide.addText(config.title, {
    x: 0.5,
    y: 0.25,
    w: 9,
    h: 0.4,
    fontSize: titleFontSize,
    fontFace: "Calibri",
    bold: true,
    color: C.zinc800,
    margin: 0,
  });

  if (config.platformFilter) {
    slide.addText(config.platformFilter, {
      x: 0.5,
      y: 0.6,
      w: 9,
      h: 0.2,
      fontSize: 9,
      fontFace: "Calibri",
      color: C.zinc500,
      margin: 0,
    });
  }

  const contentY = config.platformFilter ? 0.85 : 0.7;
  const currentVals = getCurrentTotals(data, config.platformFilter);
  const prevVals = getPrevTotals(data, config.platformFilter);
  let tableY = addKpiCards(
    pres,
    slide,
    config.kpiCards,
    currentVals,
    prevVals,
    contentY,
  );
  tableY += 0.1;

  const rows = getRows(data, config.platformFilter);
  addDataTable(pres, slide, config, rows, data, formulas, tableY);

  if (summaryPosition !== "hidden") {
    addSummary(slide, config.summary);
  }
}

// ── Table + charts slide ──
async function buildTableChartsSlide(
  pres: pptxgen,
  slide: pptxgen.Slide,
  config: SlideConfig,
  data: ReportData,
  formulas: FormulaConfig[],
) {
  const { titleFontSize, summaryPosition } = ds(config);

  slide.addText(config.title, {
    x: 0.5,
    y: 0.25,
    w: 9,
    h: 0.4,
    fontSize: titleFontSize,
    fontFace: "Calibri",
    bold: true,
    color: C.zinc800,
    margin: 0,
  });

  if (config.platformFilter) {
    slide.addText(config.platformFilter, {
      x: 0.5,
      y: 0.6,
      w: 9,
      h: 0.2,
      fontSize: 9,
      fontFace: "Calibri",
      color: C.zinc500,
      margin: 0,
    });
  }

  const contentY = config.platformFilter ? 0.85 : 0.7;
  const currentVals = getCurrentTotals(data, config.platformFilter);
  const prevVals = getPrevTotals(data, config.platformFilter);
  let tableY = addKpiCards(
    pres,
    slide,
    config.kpiCards,
    currentVals,
    prevVals,
    contentY,
  );
  tableY += 0.1;

  const rows = getRows(data, config.platformFilter);
  addDataTable(pres, slide, config, rows, data, formulas, tableY, 0.5, 5.5);

  if (config.charts && config.charts.length > 0 && data.chartData) {
    const availableH = 5.1 - tableY;
    const chartCount = config.charts.length;
    const chartH = Math.min(2.4, availableH / chartCount);

    for (let i = 0; i < config.charts.length; i++) {
      const chart = config.charts[i];
      const chartY = tableY + i * (chartH + 0.1);

      const chartDataSet = data.chartData.find(
        (cd) =>
          cd.platform === config.platformFilter &&
          cd.categoryKey === chart.groupBy,
      );

      if (!chartDataSet || chartDataSet.rows.length === 0) continue;

      const donutData = chartDataSet.rows.map((r, ri) => ({
        label: r.category,
        value: (r.values[chart.metric] as number) ?? 0,
        color: C.chart[ri % C.chart.length],
      }));

      const chartTitle = chart.title || `By ${chart.groupBy}`;
      const svgString = generateDonutSVG(donutData, chartTitle, 600, 400);
      if (!svgString) continue;

      const pngBase64 = await svgToPngBase64(svgString);

      slide.addImage({
        data: pngBase64,
        x: 6.2,
        y: chartY,
        w: 3.3,
        h: chartH,
      });
    }
  }

  if (summaryPosition !== "hidden") {
    addSummary(slide, config.summary);
  }
}

// ── Data table ──
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
  const { maxTableRows, tableFontSize } = ds(config);
  const grouped = groupRowsBy(rows, config.table.groupBy, formulas);
  const cols = config.table.columns;
  const colW = [tableW * 0.3, ...cols.map(() => (tableW * 0.7) / cols.length)];

  const headerRow: pptxgen.TableCell[] = [
    {
      text:
        config.table.groupBy.charAt(0).toUpperCase() +
        config.table.groupBy.slice(1),
      options: {
        fontSize: tableFontSize,
        fontFace: "Calibri",
        color: C.zinc500,
        fill: { color: C.white },
        bold: false,
        align: "left",
        valign: "middle",
        border: [
          { type: "none" },
          { type: "none" },
          { pt: 1.5, color: C.zinc300 },
          { type: "none" },
        ],
      },
    },
    ...cols.map((col) => ({
      text: col,
      options: {
        fontSize: tableFontSize,
        fontFace: "Calibri",
        color: C.zinc500,
        fill: { color: C.white },
        bold: false,
        align: "right" as const,
        valign: "middle" as const,
        border: [
          { type: "none" as const },
          { type: "none" as const },
          { pt: 1.5, color: C.zinc300 },
          { type: "none" as const },
        ],
      },
    })),
  ];

  const dataRows: pptxgen.TableCell[][] = grouped
    .slice(0, maxTableRows)
    .map((row, idx) => {
      const bgColor = idx % 2 === 0 ? C.white : C.zinc50;
      const rowBorder = [
        { type: "none" as const },
        { type: "none" as const },
        { pt: 0.5, color: C.zinc100 },
        { type: "none" as const },
      ];

      return [
        {
          text: row.group,
          options: {
            fontSize: tableFontSize,
            fontFace: "Calibri",
            color: C.zinc800,
            fill: { color: bgColor },
            align: "left",
            valign: "middle",
            border: rowBorder,
          },
        },
        ...cols.map((col) => ({
          text: fmtCompact(row.totals[col] ?? row.metrics[col] ?? null),
          options: {
            fontSize: tableFontSize,
            fontFace: "Calibri",
            color: C.zinc800,
            fill: { color: bgColor },
            align: "right" as const,
            valign: "middle" as const,
            border: rowBorder,
          },
        })),
      ];
    });

  if (config.table.showTotal) {
    const totals = getCurrentTotals(data, config.platformFilter);
    const totalBorder = [
      { pt: 2, color: C.zinc300 },
      { type: "none" as const },
      { type: "none" as const },
      { type: "none" as const },
    ];

    dataRows.push([
      {
        text: "Total",
        options: {
          bold: true,
          fontSize: tableFontSize,
          fontFace: "Calibri",
          color: C.zinc800,
          fill: { color: C.white },
          align: "left",
          valign: "middle",
          border: totalBorder,
        },
      },
      ...cols.map((col) => ({
        text: fmtCompact(totals[col] ?? null),
        options: {
          bold: true,
          fontSize: tableFontSize,
          fontFace: "Calibri",
          color: C.zinc800,
          fill: { color: C.white },
          align: "right" as const,
          valign: "middle" as const,
          border: totalBorder,
        },
      })),
    ]);
  }

  slide.addTable([headerRow, ...dataRows], {
    x: startX,
    y: startY,
    w: tableW,
    colW,
    rowH: 0.23,
    margin: [2, 6, 2, 6],
  });
}

// ── Summary ──
function addSummary(
  slide: pptxgen.Slide,
  summary: string[],
  startY: number = 4.6,
) {
  if (summary.length === 0) return;

  slide.addText("Summary", {
    x: 0.5,
    y: startY,
    w: 9,
    h: 0.2,
    fontSize: 8,
    fontFace: "Calibri",
    bold: true,
    color: C.zinc800,
  });

  const text = summary.map((line) => `•  ${line}`).join("\n");

  slide.addText(text, {
    x: 0.5,
    y: startY + 0.2,
    w: 9,
    h: 0.8,
    fontSize: 7,
    fontFace: "Calibri",
    color: C.zinc500,
    lineSpacingMultiple: 1.3,
    valign: "top",
  });
}
