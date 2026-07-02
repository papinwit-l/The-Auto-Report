"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  GripVertical,
  Pencil,
  Save,
  FolderOpen,
} from "lucide-react";
import type {
  ProjectMapping,
  SlideConfig,
  SlideTemplateFile,
  DateRange,
} from "@/types";
import type { ReportData } from "@/lib/dataUtils";
import AddSlideDialog from "@/components/AddSlideDialog";
import SlidePreview from "@/components/SlidePreview";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function SlideBuilderPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<ProjectMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<SlideConfig[]>([]);
  const [activeSlide, setActiveSlide] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideConfig | null>(null);

  // Date range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useAllData, setUseAllData] = useState(true);

  // Data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Exporting
  const [exporting, setExporting] = useState(false);

  // Slide templates
  const [showSaveSlideTemplate, setShowSaveSlideTemplate] = useState(false);
  const [slideTemplateName, setSlideTemplateName] = useState("");
  const [savingSlideTemplate, setSavingSlideTemplate] = useState(false);
  const [showLoadSlideTemplate, setShowLoadSlideTemplate] = useState(false);
  const [slideTemplates, setSlideTemplates] = useState<SlideTemplateFile[]>([]);

  // Load template
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => {
        const found = (d.templates as ProjectMapping[]).find(
          (t) => t.id === id,
        );
        setTemplate(found ?? null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch data from sheets
  const fetchData = useCallback(async () => {
    if (!template) return;
    setFetching(true);
    setFetchError("");

    const dateRange: DateRange =
      useAllData || !startDate || !endDate
        ? null
        : { start: startDate, end: endDate };

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, dateRange }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to process");

      setReportData(result.data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Fetch error");
    } finally {
      setFetching(false);
    }
  }, [template, startDate, endDate, useAllData]);

  // Add slide
  const addSlide = (slide: SlideConfig) => {
    if (editingSlide) {
      // Update existing slide
      setSlides((prev) => prev.map((s) => (s.id === slide.id ? slide : s)));
      setEditingSlide(null);
    } else {
      // Add new slide
      setSlides((prev) => [...prev, slide]);
    }
    setActiveSlide(slide.id);
    setShowAddDialog(false);
  };

  // Delete slide
  const deleteSlide = (slideId: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== slideId));
    if (activeSlide === slideId) {
      setActiveSlide(null);
    }
  };

  // Move slide
  const moveSlide = (slideId: string, direction: "up" | "down") => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === slideId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  // Export
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template?.id,
          slides,
          reportData,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template?.name ?? "report"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Save slide template
  const saveSlideTemplate = async () => {
    if (!slideTemplateName.trim() || slides.length === 0) return;
    setSavingSlideTemplate(true);
    try {
      const tmpl: SlideTemplateFile = {
        id: crypto.randomUUID(),
        name: slideTemplateName,
        slides,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await fetch("/api/slide-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tmpl),
      });
      setShowSaveSlideTemplate(false);
      setSlideTemplateName("");
    } finally {
      setSavingSlideTemplate(false);
    }
  };

  // Load slide templates list
  const loadSlideTemplatesList = async () => {
    const res = await fetch("/api/slide-templates");
    const data = await res.json();
    setSlideTemplates(data.templates ?? []);
    setShowLoadSlideTemplate(true);
  };

  // Apply a slide template
  const applySlideTemplate = (tmpl: SlideTemplateFile) => {
    setSlides(tmpl.slides);
    setActiveSlide(tmpl.slides[0]?.id ?? null);
    setShowLoadSlideTemplate(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-zinc-400">Template not found.</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-blue-400 hover:text-blue-300 mt-4"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{template.name}</h1>
              <button
                onClick={() => router.push(`/report/new?edit=${template.id}`)}
                className="text-zinc-600 hover:text-blue-400 transition-colors"
                title="Edit template"
              >
                <Pencil size={13} />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {template.platforms.map((p) => p.platformLabel).join(", ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSlideTemplatesList}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm transition-colors"
            title="Load slide template"
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => setShowSaveSlideTemplate(true)}
            disabled={slides.length === 0}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 px-3 py-2 rounded-lg text-sm transition-colors"
            title="Save slide template"
          >
            <Save size={14} />
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={14} />
            Add Slide
          </button>
          <button
            onClick={handleExport}
            disabled={slides.length === 0 || !reportData || exporting}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export .pptx
          </button>
        </div>
      </div>

      {/* Date range + Fetch */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useAllData}
              onChange={(e) => setUseAllData(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-zinc-400">All data</span>
          </label>

          {!useAllData && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none"
              />
              <span className="text-zinc-600">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none"
              />
            </>
          )}

          <button
            onClick={fetchData}
            disabled={fetching}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto"
          >
            {fetching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Fetch Data
          </button>
        </div>

        {fetchError && (
          <p className="text-red-400 text-xs mt-2">{fetchError}</p>
        )}

        {reportData && (
          <p className="text-emerald-400 text-xs mt-2">
            Loaded {reportData.platforms.length} platform
            {reportData.platforms.length !== 1 ? "s" : ""},{" "}
            {reportData.platforms.reduce((sum, p) => sum + p.rows.length, 0)}{" "}
            total rows
            {reportData.comparison ? " (with comparison period)" : ""}
          </p>
        )}
      </div>

      {/* Slides */}
      <div className="grid grid-cols-[280px_1fr] gap-5">
        {/* Slide list (left panel) */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Slides ({slides.length})
          </p>

          {slides.length === 0 ? (
            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full border border-dashed border-zinc-800 rounded-lg py-8 text-center text-zinc-600 text-xs hover:border-zinc-700 hover:text-zinc-500 transition-colors"
            >
              Add your first slide
            </button>
          ) : (
            slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={`border rounded-lg p-2.5 transition-colors cursor-pointer group ${
                  activeSlide === slide.id
                    ? "border-blue-500/50 bg-blue-950/10"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
                onClick={() => setActiveSlide(slide.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">
                    <GripVertical size={12} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {idx + 1}. {slide.title}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {slide.template}
                      {slide.platformFilter ? ` · ${slide.platformFilter}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSlide(slide);
                        setShowAddDialog(true);
                      }}
                      className="text-zinc-600 hover:text-blue-400 p-0.5"
                      title="Edit slide"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(slide.id, "up");
                      }}
                      disabled={idx === 0}
                      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 p-0.5"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(slide.id, "down");
                      }}
                      disabled={idx === slides.length - 1}
                      className="text-zinc-600 hover:text-zinc-300 disabled:opacity-30 p-0.5"
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(slide.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 p-0.5"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Preview (right panel) */}
        <div>
          {slides.length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-lg aspect-video flex items-center justify-center text-zinc-600 text-sm">
              No slides to preview
            </div>
          ) : (
            <div className="space-y-4">
              {slides.map((slide) => (
                <SlidePreview
                  key={slide.id}
                  slide={slide}
                  data={reportData}
                  formulas={template.formulas}
                  isActive={activeSlide === slide.id}
                  onClick={() => setActiveSlide(slide.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Slide Dialog */}
      {showAddDialog && (
        <AddSlideDialog
          template={template}
          editSlide={editingSlide ?? undefined}
          onAdd={addSlide}
          onClose={() => {
            setShowAddDialog(false);
            setEditingSlide(null);
          }}
        />
      )}

      {/* Save Slide Template Dialog */}
      {showSaveSlideTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <h2 className="text-base font-medium">Save Slide Template</h2>
            <p className="text-xs text-zinc-400">
              Save your current {slides.length} slide
              {slides.length !== 1 ? "s" : ""} as a reusable template.
            </p>
            <input
              type="text"
              value={slideTemplateName}
              onChange={(e) => setSlideTemplateName(e.target.value)}
              placeholder="Template name..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveSlideTemplate(false)}
                className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={saveSlideTemplate}
                disabled={!slideTemplateName.trim() || savingSlideTemplate}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {savingSlideTemplate && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Slide Template Dialog */}
      {showLoadSlideTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-5 space-y-4">
            <h2 className="text-base font-medium">Load Slide Template</h2>
            {slideTemplates.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No saved slide templates yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {slideTemplates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => applySlideTemplate(tmpl)}
                    className="w-full text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-2.5 transition-colors"
                  >
                    <p className="text-sm font-medium">{tmpl.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {tmpl.slides.length} slide
                      {tmpl.slides.length !== 1 ? "s" : ""} ·{" "}
                      {new Date(tmpl.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => setShowLoadSlideTemplate(false)}
                className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
