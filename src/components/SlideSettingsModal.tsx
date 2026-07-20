"use client";

import { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import type { SlideConfig, FormulaConfig } from "@/types";
import type { ReportData } from "@/lib/dataUtils";
import { generateSummary } from "@/lib/summaryGenerator";

export type SlideDisplaySettings = {
  maxTableRows: number;
  tableFontSize: number;
  titleFontSize: number;
  summaryPosition: "bottom" | "hidden";
};

export const DEFAULT_DISPLAY_SETTINGS: SlideDisplaySettings = {
  maxTableRows: 12,
  tableFontSize: 7,
  titleFontSize: 20,
  summaryPosition: "bottom",
};

type Props = {
  slide: SlideConfig;
  reportData: ReportData | null;
  formulas: FormulaConfig[];
  onSave: (updated: SlideConfig) => void;
  onClose: () => void;
};

export default function SlideSettingsModal({
  slide,
  reportData,
  formulas,
  onSave,
  onClose,
}: Props) {
  const settings: SlideDisplaySettings = {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...(slide.displaySettings ?? {}),
  };

  const [maxTableRows, setMaxTableRows] = useState(settings.maxTableRows);
  const [tableFontSize, setTableFontSize] = useState(settings.tableFontSize);
  const [titleFontSize, setTitleFontSize] = useState(settings.titleFontSize);
  const [summaryPosition, setSummaryPosition] = useState(
    settings.summaryPosition,
  );
  const [showTotal, setShowTotal] = useState(slide.table.showTotal);
  const [summary, setSummary] = useState(slide.summary.join("\n"));

  const handleRegenerate = () => {
    if (!reportData) return;
    const lines = generateSummary(slide, reportData, formulas);
    setSummary(lines.join("\n"));
  };

  const handleSave = () => {
    onSave({
      ...slide,
      table: { ...slide.table, showTotal },
      summary: summary.split("\n").filter((l) => l.trim()),
      displaySettings: {
        maxTableRows,
        tableFontSize,
        titleFontSize,
        summaryPosition,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div>
            <h2 className="text-base font-medium">Slide Settings</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{slide.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ── Table Display ── */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Table Display
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Max rows
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxTableRows}
                  onChange={(e) => setMaxTableRows(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Font size (pt)
                </label>
                <input
                  type="number"
                  min={5}
                  max={14}
                  value={tableFontSize}
                  onChange={(e) => setTableFontSize(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showTotal}
                onChange={(e) => setShowTotal(e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-sm text-zinc-400">Show total row</span>
            </label>
          </section>

          {/* ── Layout ── */}
          <section>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Layout</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Title font size (pt)
                </label>
                <input
                  type="number"
                  min={12}
                  max={36}
                  value={titleFontSize}
                  onChange={(e) => setTitleFontSize(Number(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Summary
                </label>
                <select
                  value={summaryPosition}
                  onChange={(e) =>
                    setSummaryPosition(e.target.value as "bottom" | "hidden")
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="bottom">Show at bottom</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </section>

          {/* ── Summary ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-300">Summary</h3>
              <button
                onClick={handleRegenerate}
                disabled={!reportData}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={11} />
                Regenerate
              </button>
            </div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 resize-none"
              placeholder="Auto-generated summary will appear here after fetching data..."
            />
            <p className="text-xs text-zinc-600 mt-1">
              One bullet point per line. Edit freely or click Regenerate.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-900">
          <button
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
