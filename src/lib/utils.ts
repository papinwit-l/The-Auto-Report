/**
 * Extract spreadsheet ID from a Google Sheets URL or return as-is if already an ID
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId;
}
