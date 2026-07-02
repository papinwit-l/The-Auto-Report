import { getAuthClient, getSheetsClient } from "./googleAuth";
import type { SheetTabInfo, RawSheetData } from "@/types";
export { extractSpreadsheetId } from "./utils";

/**
 * Fetch all tab (sheet) names from a spreadsheet
 */
export async function fetchSheetTabs(
  spreadsheetId: string
): Promise<SheetTabInfo[]> {
  const auth = getAuthClient();
  const sheets = getSheetsClient(auth);

  const res = await sheets.spreadsheets.get({ spreadsheetId });

  return (
    res.data.sheets?.map((s, i) => ({
      name: s.properties?.title ?? `Sheet${i + 1}`,
      index: s.properties?.index ?? i,
    })) ?? []
  );
}

/**
 * Fetch raw data from a specific tab
 * Uses UNFORMATTED_VALUE + SERIAL_NUMBER for clean numeric data
 */
export async function fetchSheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<RawSheetData> {
  const auth = getAuthClient();
  const sheets = getSheetsClient(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const allRows = res.data.values ?? [];

  if (allRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = allRows[0].map((h: unknown) => String(h ?? ""));
  const rows = allRows.slice(1).map((row) =>
    headers.map((_: string, i: number) => {
      const val = row[i];
      if (val === undefined || val === null || val === "") return null;
      return val as string | number;
    })
  );

  return { headers, rows };
}

/**
 * Fetch data from multiple tabs at once
 */
export async function fetchMultipleSheetData(
  spreadsheetId: string,
  sheetNames: string[]
): Promise<Record<string, RawSheetData>> {
  const results: Record<string, RawSheetData> = {};

  // Fetch in parallel
  await Promise.all(
    sheetNames.map(async (name) => {
      results[name] = await fetchSheetData(spreadsheetId, name);
    })
  );

  return results;
}
