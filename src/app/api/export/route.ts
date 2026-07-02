import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { generatePptx } from "@/lib/pptxGenerator";
import type { ProjectMapping, SlideConfig } from "@/types";
import type { ReportData } from "@/lib/dataUtils";

const TEMPLATES_PATH = path.join(process.cwd(), "data", "templates.json");

export async function POST(request: NextRequest) {
  try {
    const { templateId, slides, reportData } = (await request.json()) as {
      templateId: string;
      slides: SlideConfig[];
      reportData: ReportData;
    };

    // Load template for formulas and project name
    const raw = await fs.readFile(TEMPLATES_PATH, "utf-8");
    const templates: ProjectMapping[] = JSON.parse(raw);
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (!reportData) {
      return NextResponse.json(
        { error: "No report data provided. Fetch data first." },
        { status: 400 },
      );
    }

    const buffer = await generatePptx(
      slides,
      reportData,
      template.formulas,
      template.name,
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${template.name}.pptx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
