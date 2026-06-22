/**
 * Parser for the monthly "สรุปการมาปฏิบัติราชการของบุคลากร" PDF that the
 * university HR sends each month (มหาวิทยาลัยราชภัฏลำปาง).
 *
 * Why this works WITHOUT OCR:
 *   The data table has an embedded text layer. The Thai *names* come out
 *   garbled (the font's ToUnicode map is broken) but every **numeric** cell
 *   extracts perfectly, together with its x/y position. We map each number
 *   to a column purely by its x-coordinate, using boundaries calibrated from
 *   the table's vertical grid lines. Names are matched to the faculty roster
 *   downstream (by row order + human confirmation), so the broken glyphs do
 *   not matter here.
 *
 * Column x-boundaries are specific to this standard university form. If the
 * template ever changes, recalibrate COLUMN_RANGES (boundaries came from the
 * table's vertical lines: 68,93,292,325,359,394,415,441,475,512,555,642,678,
 * 710,768 in PDF points, A4 landscape).
 */

import { getDocumentProxy } from "unpdf";

/** Numeric columns we extract, in left-to-right order. */
export type AttendanceColumn =
  | "seq"
  | "work_days"
  | "travel_days"
  | "leave_vacation"
  | "leave_personal"
  | "leave_sick"
  | "leave_study"
  | "leave_maternity"
  | "leave_ordination"
  | "late_online_days"
  | "missing_checkout_count"
  | "total_days";

/** [minX, maxX) in PDF points. A token's left edge (x0) falling in the range
 *  belongs to that column. Calibrated from the form's vertical grid lines. */
const COLUMN_RANGES: ReadonlyArray<readonly [AttendanceColumn, number, number]> = [
  ["seq", 68, 93],
  // 93–292 = ชื่อ-สกุล (name, garbled — handled by roster matching, not here)
  ["work_days", 292, 325],
  ["travel_days", 325, 359],
  ["leave_vacation", 359, 394],
  ["leave_personal", 394, 415],
  ["leave_sick", 415, 441],
  ["leave_study", 441, 475],
  ["leave_maternity", 475, 512],
  ["leave_ordination", 512, 555],
  ["late_online_days", 555, 642],
  ["missing_checkout_count", 642, 678],
  ["total_days", 678, 710],
  // 710–768 = หมายเหตุ (free text, garbled — skipped)
];

/** Rows whose center-y differs by more than this are different table rows.
 *  Data rows on the form are ~18 pt apart; stray sub-tokens cluster within ~3. */
const ROW_Y_TOLERANCE = 9;

export interface ParsedAttendanceRow {
  /** ลำดับที่ as printed in the file (1-based within the document). */
  seq: number;
  /** Y position (PDF points) — useful only for ordering/debugging. */
  y: number;
  work_days: number;
  travel_days: number;
  leave_vacation: number;
  leave_personal: number;
  leave_sick: number;
  leave_study: number;
  leave_maternity: number;
  leave_ordination: number;
  late_online_days: number;
  missing_checkout_count: number;
  total_days: number;
  /** total_days === sum(work + travel + all 6 leave types). Soft check only. */
  sum_matches_total: boolean;
  /** Numbers that fell outside every known column (template drift warning). */
  unmapped: Array<{ value: number; x: number }>;
}

export interface ParseAttendanceResult {
  /** 1-based page that the table was read from. */
  page_number: number;
  rows: ParsedAttendanceRow[];
  /** Rows of text that looked like table rows but had no ลำดับ number
   *  (e.g. section headers สายวิชาการ/สายสนับสนุน) — reported for transparency. */
  skipped_rows: number;
}

interface Token {
  value: number;
  x: number; // left edge (transform[4])
  y: number; // baseline (transform[5])
}

function columnForX(x: number): AttendanceColumn | null {
  for (const [col, min, max] of COLUMN_RANGES) {
    if (x >= min && x < max) return col;
  }
  return null;
}

/** Extract numeric tokens (with positions) from one page's text layer. */
async function numericTokens(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageNumber: number,
): Promise<Token[]> {
  const page = await pdf.getPage(pageNumber);
  const tc = await page.getTextContent();
  const tokens: Token[] = [];
  for (const item of tc.items as Array<{ str?: string; transform?: number[] }>) {
    const s = item.str?.trim();
    if (!s || !item.transform) continue;
    // pure number (integers or .5 half-days); ignore "8.30" etc by column gate later
    if (!/^\d+(\.\d+)?$/.test(s)) continue;
    tokens.push({ value: Number(s), x: Math.round(item.transform[4]), y: item.transform[5] });
  }
  return tokens;
}

/** Cluster tokens into rows by y, then assign each to a column by x. */
function buildRows(tokens: Token[]): { rows: ParsedAttendanceRow[]; skipped: number } {
  // Group by y with tolerance (sort by y descending = top-to-bottom in PDF space).
  const sorted = [...tokens].sort((a, b) => b.y - a.y);
  const clusters: Token[][] = [];
  for (const t of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last[0].y - t.y) <= ROW_Y_TOLERANCE) {
      last.push(t);
    } else {
      clusters.push([t]);
    }
  }

  const rows: ParsedAttendanceRow[] = [];
  let skipped = 0;

  for (const cluster of clusters) {
    const cells: Partial<Record<AttendanceColumn, number>> = {};
    const unmapped: Array<{ value: number; x: number }> = [];
    let hasDataCell = false;

    for (const tok of cluster) {
      const col = columnForX(tok.x);
      if (!col) {
        unmapped.push({ value: tok.value, x: tok.x });
        continue;
      }
      // If two tokens map to the same column (rare), keep the first seen.
      if (cells[col] === undefined) cells[col] = tok.value;
      if (col !== "seq") hasDataCell = true;
    }

    // A genuine data row has a ลำดับ number. Section headers / title rows don't.
    if (cells.seq === undefined) {
      if (hasDataCell) skipped++; // looked data-ish but no seq → flag, don't import
      continue;
    }

    const num = (c: AttendanceColumn) => cells[c] ?? 0;
    const sum =
      num("work_days") +
      num("travel_days") +
      num("leave_vacation") +
      num("leave_personal") +
      num("leave_sick") +
      num("leave_study") +
      num("leave_maternity") +
      num("leave_ordination");

    rows.push({
      seq: cells.seq,
      y: Math.round(cluster[0].y),
      work_days: num("work_days"),
      travel_days: num("travel_days"),
      leave_vacation: num("leave_vacation"),
      leave_personal: num("leave_personal"),
      leave_sick: num("leave_sick"),
      leave_study: num("leave_study"),
      leave_maternity: num("leave_maternity"),
      leave_ordination: num("leave_ordination"),
      late_online_days: num("late_online_days"),
      missing_checkout_count: num("missing_checkout_count"),
      total_days: num("total_days"),
      sum_matches_total: cells.total_days === undefined ? false : sum === cells.total_days,
      unmapped,
    });
  }

  // Order by the printed ลำดับ for a stable, file-faithful sequence.
  rows.sort((a, b) => a.seq - b.seq);
  return { rows, skipped };
}

/**
 * Parse the attendance summary table from a PDF.
 *
 * @param data   Raw PDF bytes.
 * @param opts.pageNumber  1-based page to read. If omitted, auto-detects the
 *                         page with the most valid data rows (handles files
 *                         with or without the cover memo on page 1).
 */
export async function parseAttendancePdf(
  data: Uint8Array | ArrayBuffer,
  opts?: { pageNumber?: number },
): Promise<ParseAttendanceResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await getDocumentProxy(bytes);

  const candidatePages = opts?.pageNumber
    ? [opts.pageNumber]
    : Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  let best: ParseAttendanceResult | null = null;
  for (const pageNumber of candidatePages) {
    const tokens = await numericTokens(pdf, pageNumber);
    const { rows, skipped } = buildRows(tokens);
    const result: ParseAttendanceResult = { page_number: pageNumber, rows, skipped_rows: skipped };
    if (!best || result.rows.length > best.rows.length) best = result;
  }

  return best ?? { page_number: candidatePages[0] ?? 1, rows: [], skipped_rows: 0 };
}
