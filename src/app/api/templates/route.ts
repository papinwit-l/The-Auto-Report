import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { ProjectMapping } from "@/types";

const TEMPLATES_PATH = path.join(process.cwd(), "data", "templates.json");

async function readTemplates(): Promise<ProjectMapping[]> {
  try {
    const raw = await fs.readFile(TEMPLATES_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeTemplates(templates: ProjectMapping[]): Promise<void> {
  await fs.mkdir(path.dirname(TEMPLATES_PATH), { recursive: true });
  await fs.writeFile(TEMPLATES_PATH, JSON.stringify(templates, null, 2));
}

// GET /api/templates — list all templates
export async function GET() {
  const templates = await readTemplates();
  return NextResponse.json({ templates });
}

// POST /api/templates — create or update a template
export async function POST(request: NextRequest) {
  try {
    const body: ProjectMapping = await request.json();
    const templates = await readTemplates();

    const existingIndex = templates.findIndex((t) => t.id === body.id);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      templates[existingIndex] = { ...body, updatedAt: now };
    } else {
      templates.push({ ...body, createdAt: now, updatedAt: now });
    }

    await writeTemplates(templates);
    return NextResponse.json({ ok: true, id: body.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/templates?id=xxx — delete a template
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const templates = await readTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  await writeTemplates(filtered);
  return NextResponse.json({ ok: true });
}
