"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, Trash2, Pencil } from "lucide-react";
import type { ProjectMapping } from "@/types";

export default function Dashboard() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectMapping[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          onClick={() => router.push("/report/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Report
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <FileText size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-sm">No saved projects yet.</p>
          <p className="text-xs mt-1">Create a new report to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 hover:border-zinc-700 transition-colors group"
            >
              <button
                onClick={() => router.push(`/report/${t.id}`)}
                className="flex-1 text-left"
              >
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t.platforms.length} platform
                  {t.platforms.length !== 1 ? "s" : ""} · Updated{" "}
                  {new Date(t.updatedAt).toLocaleDateString()}
                </p>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => router.push(`/report/new?edit=${t.id}`)}
                  className="text-zinc-600 hover:text-blue-400 p-1"
                  title="Edit template"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-zinc-600 hover:text-red-400 p-1"
                  title="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
