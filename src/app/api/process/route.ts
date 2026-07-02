import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { processReportData } from "@/lib/dataProcessor";
import type { ProjectMapping, DateRange } from "@/types";

const TEMPLATES_PATH = path.join(process.cwd(), "data", "templates.json");

export async function POST(request: NextRequest) {
  try {
    const { templateId, dateRange } = (await request.json()) as {
      templateId: string;
      dateRange: DateRange;
    };

    // Load template
    const raw = await fs.readFile(TEMPLATES_PATH, "utf-8");
    const templates: ProjectMapping[] = JSON.parse(raw);
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    const data = await processReportData(template, dateRange);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Process error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
