"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuid } from "uuid";
import { ArrowLeft, ArrowRight, Save, Loader2, Plus, X } from "lucide-react";
import {
  COLUMN_TYPES,
  BUILT_IN_METRICS,
  CHART_CATEGORY_TYPES,
  type SheetTabInfo,
  type PlatformTabMapping,
  type FormulaConfig,
  type DateFormatOption,
  type ProjectMapping,
  type RawSheetData,
} from "@/types";
import { extractSpreadsheetId } from "@/lib/utils";

const STEPS = [
  "Sheet URL",
  "Map Platforms",
  "Date Config",
  "Formulas",
  "Map Columns",
  "Save",
] as const;

const DATE_FORMATS: { value: DateFormatOption; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY/MM/DD", label: "YYYY/MM/DD" },
  { value: "serial", label: "Serial number" },
];

const PLATFORM_PRESETS = [
  "Google Ads",
  "Facebook Ads",
  "TikTok Ads",
  "Line Ads",
  "Taboola",
  "YouTube",
  "Instagram",
  "X (Twitter)",
  "Custom",
];

function ReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [step, setStep] = useState(0);
  const [loadingTemplate, setLoadingTemplate] = useState(!!editId);

  // Step 1: Sheet URL
  const [sheetUrl, setSheetUrl] = useState("");
  const [tabs, setTabs] = useState<SheetTabInfo[]>([]);
  const [fetchingTabs, setFetchingTabs] = useState(false);
  const [tabError, setTabError] = useState("");

  // Step 2: Platform mapping
  const [platformMappings, setPlatformMappings] = useState<
    PlatformTabMapping[]
  >([]);

  // Step 4: Formulas
  const [selectedFormulas, setSelectedFormulas] = useState<FormulaConfig[]>(
    () =>
      Object.entries(BUILT_IN_METRICS).map(([key, meta]) => ({
        id: key,
        key,
        label: meta.label,
        formula: meta.formula,
        requires: meta.requires,
        isBuiltIn: true,
      })),
  );

  // Step 5: Column mapping
  const [tabHeaders, setTabHeaders] = useState<Record<string, string[]>>({});
  const [loadingHeaders, setLoadingHeaders] = useState<string | null>(null);

  // Custom formula form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customFormula, setCustomFormula] = useState("");
  const [customRequires, setCustomRequires] = useState<string[]>([]);

  // Custom columns (extend COLUMN_TYPES)
  const [customColumns, setCustomColumns] = useState<Record<string, string>>(
    {},
  );
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColKey, setNewColKey] = useState("");
  const [newColLabel, setNewColLabel] = useState("");

  // Step 6: Project name
  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);

  // Existing template reference (for edit mode)
  const [existingTemplate, setExistingTemplate] =
    useState<ProjectMapping | null>(null);

  const spreadsheetId = sheetUrl ? extractSpreadsheetId(sheetUrl) : "";

  // ── Load existing template when editing ──
  useEffect(() => {
    if (!editId) return;

    fetch("/api/templates")
      .then((r) => r.json())
      .then(async (d) => {
        const found = (d.templates as ProjectMapping[]).find(
          (t) => t.id === editId,
        );
        if (!found) {
          setLoadingTemplate(false);
          return;
        }

        setExistingTemplate(found);
        setProjectName(found.name);
        setSheetUrl(found.spreadsheetId);
        setSelectedFormulas(found.formulas);
        setPlatformMappings(found.platforms);
        setCustomColumns(found.customColumns ?? {});

        // Fetch tabs from the sheet to populate the tab list
        try {
          const res = await fetch(
            `/api/sheets/${encodeURIComponent(found.spreadsheetId)}?action=tabs`,
          );
          const tabData = await res.json();
          if (res.ok && tabData.tabs) {
            setTabs(tabData.tabs);

            // Load headers for each mapped platform
            for (const platform of found.platforms) {
              try {
                const hRes = await fetch(
                  `/api/sheets/${encodeURIComponent(
                    found.spreadsheetId,
                  )}?action=data&sheet=${encodeURIComponent(
                    platform.sheetName,
                  )}`,
                );
                const hData = await hRes.json();
                if (hRes.ok && hData.data) {
                  setTabHeaders((prev) => ({
                    ...prev,
                    [platform.sheetName]: (hData.data as RawSheetData).headers,
                  }));
                }
              } catch {
                // Skip if header loading fails for a tab
              }
            }
          }
        } catch {
          // Sheet fetch failed, user can re-fetch manually
        }

        setLoadingTemplate(false);
      })
      .catch(() => setLoadingTemplate(false));
  }, [editId]);

  // ── Step 1: Fetch tabs ──
  const fetchTabs = useCallback(async () => {
    if (!sheetUrl.trim()) return;
    setFetchingTabs(true);
    setTabError("");
    try {
      const id = extractSpreadsheetId(sheetUrl);
      const res = await fetch(
        `/api/sheets/${encodeURIComponent(id)}?action=tabs`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setTabs(data.tabs);

      // In edit mode, merge: keep existing mappings, add new tabs as unmapped
      if (existingTemplate) {
        setPlatformMappings((prev) => {
          const existing = new Set(prev.map((m) => m.sheetName));
          const newTabs = (data.tabs as SheetTabInfo[]).filter(
            (t) => !existing.has(t.name),
          );
          return [
            ...prev,
            ...newTabs.map((t) => ({
              sheetName: t.name,
              platformLabel: "",
              dateColumn: "",
              dateFormat: "auto" as DateFormatOption,
              columnMap: {},
            })),
          ];
        });
      } else {
        setPlatformMappings(
          data.tabs.map((t: SheetTabInfo) => ({
            sheetName: t.name,
            platformLabel: "",
            dateColumn: "",
            dateFormat: "auto" as DateFormatOption,
            columnMap: {},
          })),
        );
      }
    } catch (err: unknown) {
      setTabError(err instanceof Error ? err.message : "Error fetching tabs");
    } finally {
      setFetchingTabs(false);
    }
  }, [sheetUrl, existingTemplate]);

  // ── Step 5: Load headers for a tab ──
  const loadHeaders = useCallback(
    async (sheetName: string) => {
      if (tabHeaders[sheetName]) return;
      setLoadingHeaders(sheetName);
      try {
        const res = await fetch(
          `/api/sheets/${encodeURIComponent(
            spreadsheetId,
          )}?action=data&sheet=${encodeURIComponent(sheetName)}`,
        );
        const data = await res.json();
        if (res.ok && data.data) {
          setTabHeaders((prev) => ({
            ...prev,
            [sheetName]: (data.data as RawSheetData).headers,
          }));
        }
      } finally {
        setLoadingHeaders(null);
      }
    },
    [spreadsheetId, tabHeaders],
  );

  const activeMappings = platformMappings.filter((m) => m.platformLabel);

  // Load headers for all active mappings (called when entering step 4)
  const loadAllHeaders = useCallback(() => {
    for (const mapping of platformMappings.filter((m) => m.platformLabel)) {
      if (!tabHeaders[mapping.sheetName]) {
        loadHeaders(mapping.sheetName);
      }
      if (mapping.chartSheetName && !tabHeaders[mapping.chartSheetName]) {
        loadHeaders(mapping.chartSheetName);
      }
    }
  }, [platformMappings, tabHeaders, loadHeaders]);

  // ── Update platform mapping ──
  const updateMapping = (
    index: number,
    updates: Partial<PlatformTabMapping>,
  ) => {
    setPlatformMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m)),
    );
  };

  // ── Toggle tab active ──
  const toggleTab = (tabName: string) => {
    setPlatformMappings((prev) => {
      const exists = prev.find((m) => m.sheetName === tabName);
      if (exists) {
        return prev.filter((m) => m.sheetName !== tabName);
      }
      return [
        ...prev,
        {
          sheetName: tabName,
          platformLabel: "",
          dateColumn: "",
          dateFormat: "auto" as DateFormatOption,
          columnMap: {},
        },
      ];
    });
  };

  // ── Toggle formula ──
  const toggleFormula = (key: string) => {
    setSelectedFormulas((prev) => {
      const exists = prev.find((f) => f.key === key);
      if (exists) return prev.filter((f) => f.key !== key);
      const meta = BUILT_IN_METRICS[key];
      if (!meta) return prev;
      return [
        ...prev,
        {
          id: key,
          key,
          label: meta.label,
          formula: meta.formula,
          requires: meta.requires,
          isBuiltIn: true,
        },
      ];
    });
  };

  // ── Custom formula helpers ──
  const allColumnTypes: Record<string, string> = {
    ...COLUMN_TYPES,
    ...customColumns,
  };
  const availableVars = Object.keys(allColumnTypes).filter(
    (k) =>
      k !== "date" && k !== "campaign" && k !== "adgroup" && k !== "platform",
  );

  const addCustomColumn = () => {
    if (!newColLabel.trim()) return;
    const key =
      newColKey.trim() || newColLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (key in COLUMN_TYPES || key in customColumns) return; // no duplicates
    setCustomColumns((prev) => ({ ...prev, [key]: newColLabel }));
    setNewColKey("");
    setNewColLabel("");
    setShowAddColumn(false);
  };

  const removeCustomColumn = (key: string) => {
    setCustomColumns((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    // Also remove from any formula requires and column maps
    setSelectedFormulas((prev) =>
      prev.map((f) => ({
        ...f,
        requires: f.requires.filter((r) => r !== key),
      })),
    );
  };

  const resetCustomForm = () => {
    setCustomLabel("");
    setCustomKey("");
    setCustomFormula("");
    setCustomRequires([]);
    setShowCustomForm(false);
  };

  const addCustomFormula = () => {
    if (
      !customLabel.trim() ||
      !customFormula.trim() ||
      customRequires.length === 0
    )
      return;
    const key =
      customKey.trim() || customLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    // Check for duplicate key
    if (selectedFormulas.some((f) => f.key === key)) return;

    setSelectedFormulas((prev) => [
      ...prev,
      {
        id: uuid(),
        key,
        label: customLabel,
        formula: customFormula,
        requires: customRequires,
        isBuiltIn: false,
      },
    ]);
    resetCustomForm();
  };

  const removeCustomFormula = (key: string) => {
    setSelectedFormulas((prev) => prev.filter((f) => f.key !== key));
  };

  // ── Save template ──
  const saveTemplate = async () => {
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      const template: ProjectMapping = {
        id: existingTemplate?.id ?? uuid(),
        name: projectName,
        spreadsheetId,
        platforms: platformMappings.filter((m) => m.platformLabel),
        formulas: selectedFormulas,
        customColumns,
        createdAt: existingTemplate?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });

      if (res.ok) {
        router.push(`/report/${template.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Navigation guards ──
  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return tabs.length > 0;
      case 1:
        return platformMappings.some((m) => m.platformLabel);
      case 2:
        return platformMappings
          .filter((m) => m.platformLabel)
          .every((m) => m.dateColumn);
      case 3:
        return selectedFormulas.length > 0;
      case 4:
        return platformMappings
          .filter((m) => m.platformLabel)
          .every((m) => Object.keys(m.columnMap).length > 0);
      case 5:
        return projectName.trim().length > 0;
      default:
        return true;
    }
  };

  const isEdit = !!existingTemplate;

  if (loadingTemplate) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20 text-zinc-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading template...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      {isEdit && (
        <p className="text-xs text-blue-400 mb-4">
          Editing: {existingTemplate.name}
        </p>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <button
              onClick={() => {
                if (i < step) {
                  setStep(i);
                  if (i === 4) loadAllHeaders();
                }
              }}
              disabled={i > step}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                i === step
                  ? "bg-blue-600 text-white"
                  : i < step
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-900 text-zinc-600"
              }`}
            >
              {label}
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-zinc-800" />}
          </div>
        ))}
      </div>

      {/* Step 0: Sheet URL */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Google Sheets URL</h2>
          <p className="text-sm text-zinc-400">
            {isEdit
              ? "Current sheet ID is pre-filled. You can change it or re-fetch tabs."
              : "Paste the URL of your Google Sheet. Make sure it's shared with the service account."}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
            />
            <button
              onClick={fetchTabs}
              disabled={!sheetUrl.trim() || fetchingTabs}
              className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {fetchingTabs && <Loader2 size={14} className="animate-spin" />}
              {isEdit && tabs.length > 0 ? "Re-fetch" : "Fetch"}
            </button>
          </div>
          {tabError && <p className="text-red-400 text-sm">{tabError}</p>}
          {tabs.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-2">
                Found {tabs.length} tab{tabs.length !== 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((t) => (
                  <span
                    key={t.name}
                    className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Map Platforms */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Map Tabs to Platforms</h2>
          <p className="text-sm text-zinc-400">
            Select which tabs to include, assign a platform label, and
            optionally link a chart/demo tab for demographic breakdowns.
          </p>
          <div className="space-y-2">
            {tabs.map((tab) => {
              const mapping = platformMappings.find(
                (m) => m.sheetName === tab.name,
              );
              const isActive = !!mapping;
              // Don't show tabs that are used as chart tabs
              const isChartTab = platformMappings.some(
                (m) => m.chartSheetName === tab.name,
              );
              if (isChartTab && !isActive) return null;

              return (
                <div
                  key={tab.name}
                  className={`border rounded-lg p-3 transition-colors ${
                    isActive
                      ? "border-zinc-700 bg-zinc-900"
                      : "border-zinc-800/50 bg-zinc-900/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleTab(tab.name)}
                        className="accent-blue-500"
                      />
                      <span className="text-sm font-mono text-zinc-400 w-32 truncate">
                        {tab.name}
                      </span>
                    </label>
                    {isActive && (
                      <select
                        value={mapping.platformLabel}
                        onChange={(e) =>
                          updateMapping(platformMappings.indexOf(mapping), {
                            platformLabel: e.target.value,
                          })
                        }
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none"
                      >
                        <option value="">Select platform...</option>
                        {PLATFORM_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* Chart/demo tab link */}
                  {isActive && mapping.platformLabel && (
                    <div className="mt-2 ml-8">
                      <label className="text-xs text-zinc-500 block mb-1">
                        Chart/Demo tab (optional)
                      </label>
                      <select
                        value={mapping.chartSheetName ?? ""}
                        onChange={(e) =>
                          updateMapping(platformMappings.indexOf(mapping), {
                            chartSheetName: e.target.value || undefined,
                          })
                        }
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">— none —</option>
                        {tabs
                          .filter(
                            (t) =>
                              t.name !== tab.name &&
                              !platformMappings.some(
                                (m) =>
                                  m.sheetName === t.name && m.platformLabel,
                              ),
                          )
                          .map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Date Config */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Date Configuration</h2>
          <p className="text-sm text-zinc-400">
            Select the date column and format for each platform tab.
          </p>
          {activeMappings.map((mapping) => {
            const idx = platformMappings.indexOf(mapping);
            const headers = tabHeaders[mapping.sheetName];

            return (
              <div
                key={mapping.sheetName}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{mapping.platformLabel}</p>
                  <span className="text-xs text-zinc-500 font-mono">
                    {mapping.sheetName}
                  </span>
                </div>

                {!headers ? (
                  <button
                    onClick={() => loadHeaders(mapping.sheetName)}
                    disabled={loadingHeaders === mapping.sheetName}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                  >
                    {loadingHeaders === mapping.sheetName && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    Load columns
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">
                        Date column
                      </label>
                      <select
                        value={mapping.dateColumn}
                        onChange={(e) =>
                          updateMapping(idx, { dateColumn: e.target.value })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">
                        Date format
                      </label>
                      <select
                        value={mapping.dateFormat}
                        onChange={(e) =>
                          updateMapping(idx, {
                            dateFormat: e.target.value as DateFormatOption,
                          })
                        }
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none"
                      >
                        {DATE_FORMATS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 3: Formulas */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Select Metrics</h2>
          <p className="text-sm text-zinc-400">
            Choose built-in metrics or create your own custom formulas.
          </p>

          {/* Built-in metrics */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Built-in
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BUILT_IN_METRICS).map(([key, meta]) => {
                const isSelected = selectedFormulas.some((f) => f.key === key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleFormula(key)}
                    className={`text-left border rounded-lg p-3 transition-colors ${
                      isSelected
                        ? "border-blue-500/50 bg-blue-950/20"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {meta.formula}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Requires: {meta.requires.join(", ")}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom formulas list */}
          {selectedFormulas.filter((f) => !f.isBuiltIn).length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                Custom
              </p>
              <div className="space-y-2">
                {selectedFormulas
                  .filter((f) => !f.isBuiltIn)
                  .map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between border border-purple-500/30 bg-purple-950/10 rounded-lg p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          {f.formula}
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                          Requires: {f.requires.join(", ")}
                        </p>
                      </div>
                      <button
                        onClick={() => removeCustomFormula(f.key)}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Custom column types */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Column Variables
            </p>
            <p className="text-xs text-zinc-600 mb-2">
              These are the variable names you can use in formulas. Add custom
              ones if your sheet has columns not listed here.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(COLUMN_TYPES)
                .filter(
                  ([k]) =>
                    k !== "date" &&
                    k !== "campaign" &&
                    k !== "adgroup" &&
                    k !== "platform",
                )
                .map(([key, label]) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                    title={label}
                  >
                    {key}
                  </span>
                ))}
              {Object.entries(customColumns).map(([key, label]) => (
                <span
                  key={key}
                  className="text-xs px-2 py-0.5 rounded bg-purple-950/30 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1"
                  title={label}
                >
                  {key}
                  <button
                    onClick={() => removeCustomColumn(key)}
                    className="hover:text-red-400"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>

            {!showAddColumn ? (
              <button
                onClick={() => setShowAddColumn(true)}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus size={12} />
                Add custom variable
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newColKey}
                  onChange={(e) =>
                    setNewColKey(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="key (e.g. leads)"
                  className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-zinc-500"
                />
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="Label (e.g. Leads)"
                  className="w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={addCustomColumn}
                  disabled={!newColLabel.trim()}
                  className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-2 py-1 rounded transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddColumn(false);
                    setNewColKey("");
                    setNewColLabel("");
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Add custom formula */}
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Plus size={14} />
              Add custom formula
            </button>
          ) : (
            <div className="border border-zinc-700 bg-zinc-900 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">New Custom Formula</p>
                <button
                  onClick={resetCustomForm}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">
                    Label (display name)
                  </label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Cost Per View"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">
                    Key (unique ID, auto-generated if empty)
                  </label>
                  <input
                    type="text"
                    value={customKey}
                    onChange={(e) =>
                      setCustomKey(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                      )
                    }
                    placeholder="e.g. cpv"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Formula (use variable names below)
                </label>
                <input
                  type="text"
                  value={customFormula}
                  onChange={(e) => setCustomFormula(e.target.value)}
                  placeholder="e.g. spend / video_views"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">
                  Required variables (click to select)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableVars.map((v) => {
                    const isReq = customRequires.includes(v);
                    return (
                      <button
                        key={v}
                        onClick={() =>
                          setCustomRequires((prev) =>
                            isReq ? prev.filter((r) => r !== v) : [...prev, v],
                          )
                        }
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                          isReq
                            ? "border-purple-500/50 bg-purple-950/30 text-purple-300"
                            : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              {customFormula && customRequires.length > 0 && (
                <div className="bg-zinc-800/50 rounded p-2 text-xs text-zinc-400">
                  <span className="text-zinc-500">Preview:</span>{" "}
                  <span className="font-medium">
                    {customLabel || "Untitled"}
                  </span>
                  {" = "}
                  <span className="font-mono text-zinc-300">
                    {customFormula}
                  </span>
                </div>
              )}

              <button
                onClick={addCustomFormula}
                disabled={
                  !customLabel.trim() ||
                  !customFormula.trim() ||
                  customRequires.length === 0
                }
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add Formula
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Column Mapping */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Map Data Columns</h2>
          <p className="text-sm text-zinc-400">
            For each platform, map your sheet columns to known data types.
          </p>
          {activeMappings.map((mapping) => {
            const idx = platformMappings.indexOf(mapping);
            const headers = tabHeaders[mapping.sheetName] ?? [];
            const chartHeaders = mapping.chartSheetName
              ? (tabHeaders[mapping.chartSheetName] ?? [])
              : [];

            return (
              <div
                key={mapping.sheetName}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4"
              >
                <p className="text-sm font-medium">{mapping.platformLabel}</p>

                {/* Main column mapping */}
                <div>
                  <p className="text-xs text-zinc-500 mb-2">
                    Performance data —{" "}
                    <span className="font-mono">{mapping.sheetName}</span>
                  </p>
                  {headers.length === 0 ? (
                    <p className="text-xs text-zinc-500">Loading columns...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(allColumnTypes).map(
                        ([typeKey, typeLabel]) => {
                          if (typeKey === "date") return null;
                          const isCustom = typeKey in customColumns;
                          return (
                            <div key={typeKey}>
                              <label
                                className={`text-xs block mb-1 ${isCustom ? "text-purple-400" : "text-zinc-500"}`}
                              >
                                {typeLabel}
                                {isCustom && " ✦"}
                              </label>
                              <select
                                value={mapping.columnMap[typeKey] ?? ""}
                                onChange={(e) => {
                                  const newMap = { ...mapping.columnMap };
                                  if (e.target.value) {
                                    newMap[typeKey] = e.target.value;
                                  } else {
                                    delete newMap[typeKey];
                                  }
                                  updateMapping(idx, { columnMap: newMap });
                                }}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="">— skip —</option>
                                {headers.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>

                {/* Chart/demo tab column mapping */}
                {mapping.chartSheetName && (
                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-xs text-amber-400 mb-2">
                      Chart data —{" "}
                      <span className="font-mono">
                        {mapping.chartSheetName}
                      </span>
                    </p>
                    {chartHeaders.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        Loading chart columns...
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {/* Category columns */}
                        <div>
                          <p className="text-xs text-zinc-600 mb-1">
                            Categories
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(CHART_CATEGORY_TYPES).map(
                              ([catKey, catLabel]) => (
                                <div key={catKey}>
                                  <label className="text-xs text-amber-400/70 block mb-1">
                                    {catLabel}
                                  </label>
                                  <select
                                    value={
                                      mapping.chartColumnMap?.[catKey] ?? ""
                                    }
                                    onChange={(e) => {
                                      const newMap = {
                                        ...(mapping.chartColumnMap ?? {}),
                                      };
                                      if (e.target.value) {
                                        newMap[catKey] = e.target.value;
                                      } else {
                                        delete newMap[catKey];
                                      }
                                      updateMapping(idx, {
                                        chartColumnMap: newMap,
                                      });
                                    }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
                                  >
                                    <option value="">— skip —</option>
                                    {chartHeaders.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                        {/* Metric columns (reuse same types as main) */}
                        <div>
                          <p className="text-xs text-zinc-600 mb-1">Metrics</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(allColumnTypes)
                              .filter(
                                ([k]) =>
                                  ![
                                    "date",
                                    "campaign",
                                    "adgroup",
                                    "platform",
                                  ].includes(k),
                              )
                              .map(([typeKey, typeLabel]) => (
                                <div key={`chart_${typeKey}`}>
                                  <label className="text-xs text-zinc-500 block mb-1">
                                    {typeLabel}
                                  </label>
                                  <select
                                    value={
                                      mapping.chartColumnMap?.[typeKey] ?? ""
                                    }
                                    onChange={(e) => {
                                      const newMap = {
                                        ...(mapping.chartColumnMap ?? {}),
                                      };
                                      if (e.target.value) {
                                        newMap[typeKey] = e.target.value;
                                      } else {
                                        delete newMap[typeKey];
                                      }
                                      updateMapping(idx, {
                                        chartColumnMap: newMap,
                                      });
                                    }}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs focus:outline-none"
                                  >
                                    <option value="">— skip —</option>
                                    {chartHeaders.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 5: Save */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">
            {isEdit ? "Update Project" : "Save Project"}
          </h2>
          <p className="text-sm text-zinc-400">
            {isEdit
              ? "Review changes and update your project template."
              : "Name your project template. You can reuse this mapping for future reports."}
          </p>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. Client X — June 2025"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600"
          />

          {/* Summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-zinc-400">
              <span className="text-zinc-500">Sheet:</span>{" "}
              <span className="font-mono text-xs">{spreadsheetId}</span>
            </p>
            <p className="text-zinc-400">
              <span className="text-zinc-500">Platforms:</span>{" "}
              {activeMappings.map((m) => m.platformLabel).join(", ")}
            </p>
            <p className="text-zinc-400">
              <span className="text-zinc-500">Metrics:</span>{" "}
              {selectedFormulas.map((f) => f.label).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-4 border-t border-zinc-800">
        <button
          onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} />
          {step === 0 ? "Dashboard" : "Back"}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => {
              const nextStep = step + 1;
              setStep(nextStep);
              if (nextStep === 4) loadAllHeaders();
            }}
            disabled={!canProceed()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Next
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={saveTemplate}
            disabled={!canProceed() || saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            <Save size={14} />
            {isEdit ? "Update & Continue" : "Save & Continue"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function NewReportPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20 text-zinc-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      }
    >
      <ReportForm />
    </Suspense>
  );
}
