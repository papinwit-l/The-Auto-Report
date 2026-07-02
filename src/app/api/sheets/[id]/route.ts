import { NextRequest, NextResponse } from "next/server";
import {
  extractSpreadsheetId,
  fetchSheetTabs,
  fetchSheetData,
} from "@/lib/googleSheets";

// GET /api/sheets/[id] — fetch tabs or tab data
// ?action=tabs → list all tab names
// ?action=data&sheet=TabName → fetch raw data from a tab
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const spreadsheetId = extractSpreadsheetId(decodeURIComponent(rawId));
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") ?? "tabs";

    if (action === "tabs") {
      const tabs = await fetchSheetTabs(spreadsheetId);
      return NextResponse.json({ tabs });
    }

    if (action === "data") {
      const sheetName = searchParams.get("sheet");
      if (!sheetName) {
        return NextResponse.json(
          { error: "Missing 'sheet' query param" },
          { status: 400 }
        );
      }
      const data = await fetchSheetData(spreadsheetId, sheetName);
      return NextResponse.json({ data });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Sheets API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
