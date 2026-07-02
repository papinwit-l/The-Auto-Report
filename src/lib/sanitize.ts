import type { DateFormatOption } from "@/types";

/**
 * Sanitize a raw cell value into a number.
 * Strips currency symbols, commas, % signs, whitespace.
 * Returns null if not parseable.
 */
export function sanitizeNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;

  const str = String(raw)
    .replace(/[฿$€£¥,\s%]/g, "")
    .trim();

  if (str === "" || str === "-") return null;

  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Convert Excel serial date number to JS Date.
 * Excel uses Jan 0, 1900 as epoch (with the Lotus 1-2-3 leap year bug).
 */
export function excelSerialToDate(serial: number): Date {
  // Excel epoch: Jan 1, 1900 = serial 1
  // But Excel thinks 1900 was a leap year (bug), so adjust for dates after Feb 28, 1900
  const adjusted = serial > 59 ? serial - 1 : serial;
  const msPerDay = 86400000;
  const excelEpoch = new Date(1899, 11, 31).getTime(); // Dec 31, 1899
  return new Date(excelEpoch + adjusted * msPerDay);
}

/**
 * Parse a date value from a cell based on the configured format.
 */
export function parseDate(
  raw: unknown,
  format: DateFormatOption
): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Serial number from Sheets API
  if (format === "serial" || (typeof raw === "number" && format === "auto")) {
    return excelSerialToDate(raw as number);
  }

  const str = String(raw).trim();

  if (format === "auto") {
    // Try ISO first, then common formats
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) return isoDate;

    // Try DD/MM/YYYY
    const ddmm = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmm) {
      // Ambiguous, assume DD/MM/YYYY
      return new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]));
    }

    return null;
  }

  const parts = str.split(/[/\-. ]+/);
  if (parts.length < 3) return null;

  let year: number, month: number, day: number;

  switch (format) {
    case "YYYY-MM-DD":
    case "YYYY/MM/DD":
      year = Number(parts[0]);
      month = Number(parts[1]) - 1;
      day = Number(parts[2]);
      break;
    case "DD/MM/YYYY":
      day = Number(parts[0]);
      month = Number(parts[1]) - 1;
      year = Number(parts[2]);
      break;
    case "MM/DD/YYYY":
      month = Number(parts[0]) - 1;
      day = Number(parts[1]);
      year = Number(parts[2]);
      break;
    default:
      return null;
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

/**
 * Format a Date to YYYY-MM-DD string
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calculate previous period for comparison.
 * Given a date range, returns the same-length period immediately before it.
 * e.g. June 1-30 (30 days) → May 2-31 (30 days)
 */
export function getPreviousPeriod(
  start: string,
  end: string
): { start: string; end: string } {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const dayMs = 86400000;
  const durationDays = Math.round(durationMs / dayMs);

  const prevEnd = new Date(startDate.getTime() - dayMs);
  const prevStart = new Date(prevEnd.getTime() - durationDays * dayMs + dayMs);

  return {
    start: formatDateISO(prevStart),
    end: formatDateISO(prevEnd),
  };
}
