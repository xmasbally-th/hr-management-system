/**
 * Parser for the ANNUAL "สรุปวันลา ประจำปีงบประมาณ" PDF that the university
 * HR sends (มหาวิทยาลัยราชภัฏลำปาง, คณะวิทยาการจัดการ).
 *
 * Differs from the monthly form (see parse-attendance-pdf.ts):
 *  - Leave cells are "ครั้ง/วัน" (e.g. "3/7" = 3 times, 7 days total). We split
 *    on "/" → { count, days }. (Confirmed against the file: every cell has
 *    first ≤ second, impossible under days/times.)
 *  - Extra leave type ลาช่วยเหลือภริยาที่คลอดบุตร, plus ขาดงาน (วัน). No
 *    work/travel/total columns.
 *  - Spans several landscape pages; each page is its own table whose ลำดับ
 *    RESTARTS (e.g. academic staff pages then a support-staff page), so seq is
 *    NOT a global key — rows are kept in page-then-position order.
 *
 * Column x-boundaries calibrated from the form's vertical grid lines:
 * 65,98,279,325,370,416,465,516,578,672,705,771 (PDF points, A4 landscape).
 */

import { getDocumentProxy } from "unpdf";

/** Leave types carried as "ครั้ง/วัน" pairs, left→right. */
export type AnnualLeaveKey =
  | "leave_sick"
  | "leave_personal"
  | "leave_vacation"
  | "leave_maternity"
  | "leave_ordination"
  | "leave_spouse_childbirth";

type AnnualColumn = "seq" | AnnualLeaveKey | "late_online_days" | "absent_days";

/** [minX, maxX) in PDF points + whether the cell is a "ครั้ง/วัน" pair. */
const COLUMN_RANGES: ReadonlyArray<readonly [AnnualColumn, number, number, "pair" | "single"]> = [
  ["seq", 65, 98, "single"],
  // 98–279 = ชื่อ-สกุล (garbled — matched to roster downstream)
  ["leave_sick", 279, 325, "pair"],
  ["leave_personal", 325, 370, "pair"],
  ["leave_vacation", 370, 416, "pair"],
  ["leave_maternity", 416, 465, "pair"],
  ["leave_ordination", 465, 516, "pair"],
  ["leave_spouse_childbirth", 516, 578, "pair"],
  ["late_online_days", 578, 672, "single"],
  ["absent_days", 672, 705, "single"],
  // 705–771 = หมายเหตุ (skipped)
];

const LEAVE_KEYS: AnnualLeaveKey[] = [
  "leave_sick",
  "leave_personal",
  "leave_vacation",
  "leave_maternity",
  "leave_ordination",
  "leave_spouse_childbirth",
];

const ROW_Y_TOLERANCE = 9;

export interface AnnualLeaveCell {
  count: number;
  days: number;
}

export interface ParsedAnnualRow {
  /** ลำดับ as printed (resets per page/table — not globally unique). */
  seq: number;
  /** 1-based source page. */
  page: number;
  /** Appearance order across the whole document (stable global key). */
  row_order: number;
  leave_sick: AnnualLeaveCell;
  leave_personal: AnnualLeaveCell;
  leave_vacation: AnnualLeaveCell;
  leave_maternity: AnnualLeaveCell;
  leave_ordination: AnnualLeaveCell;
  leave_spouse_childbirth: AnnualLeaveCell;
  late_online_days: number;
  absent_days: number;
  /** Tokens that fell outside any known column (template-drift warning). */
  unmapped: Array<{ text: string; x: number }>;
}

export interface ParseAnnualResult {
  rows: ParsedAnnualRow[];
  pages_parsed: number;
  /** Rows that looked data-ish but had no ลำดับ (section headers, totals). */
  skipped_rows: number;
}

interface RawToken {
  text: string;
  x: number;
  y: number;
}

const TOKEN_RE = /^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/;

function columnForX(x: number): readonly [AnnualColumn, number, number, "pair" | "single"] | null {
  for (const range of COLUMN_RANGES) {
    if (x >= range[1] && x < range[2]) return range;
  }
  return null;
}

/** Parse a "ครั้ง/วัน" token. "3/7" → {3,7}; bare "5" in a pair cell → {0,5}. */
function parsePair(text: string): AnnualLeaveCell {
  const [a, b] = text.split("/");
  if (b === undefined) return { count: 0, days: Number(a) || 0 };
  return { count: Number(a) || 0, days: Number(b) || 0 };
}

async function pageTokens(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageNumber: number,
): Promise<RawToken[]> {
  const page = await pdf.getPage(pageNumber);
  const tc = await page.getTextContent();
  const tokens: RawToken[] = [];
  for (const item of tc.items as Array<{ str?: string; transform?: number[] }>) {
    const s = item.str?.trim();
    if (!s || !item.transform || !TOKEN_RE.test(s)) continue;
    tokens.push({ text: s, x: Math.round(item.transform[4]), y: item.transform[5] });
  }
  return tokens;
}

function emptyCell(): AnnualLeaveCell {
  return { count: 0, days: 0 };
}

function buildPageRows(
  tokens: RawToken[],
  page: number,
  startOrder: number,
): { rows: ParsedAnnualRow[]; skipped: number } {
  const sorted = [...tokens].sort((a, b) => b.y - a.y);
  const clusters: RawToken[][] = [];
  for (const t of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last[0].y - t.y) <= ROW_Y_TOLERANCE) last.push(t);
    else clusters.push([t]);
  }

  const rows: ParsedAnnualRow[] = [];
  let skipped = 0;
  let order = startOrder;

  for (const cluster of clusters) {
    let seq: number | null = null;
    const leave: Record<AnnualLeaveKey, AnnualLeaveCell> = {
      leave_sick: emptyCell(),
      leave_personal: emptyCell(),
      leave_vacation: emptyCell(),
      leave_maternity: emptyCell(),
      leave_ordination: emptyCell(),
      leave_spouse_childbirth: emptyCell(),
    };
    let late = 0;
    let absent = 0;
    const unmapped: Array<{ text: string; x: number }> = [];
    let hasData = false;

    for (const tok of cluster) {
      const col = columnForX(tok.x);
      if (!col) {
        unmapped.push({ text: tok.text, x: tok.x });
        continue;
      }
      const [key] = col;
      if (key === "seq") {
        if (seq === null && /^\d+$/.test(tok.text)) seq = Number(tok.text);
        continue;
      }
      hasData = true;
      if (key === "late_online_days") late = Number(tok.text.split("/")[0]) || 0;
      else if (key === "absent_days") absent = Number(tok.text.split("/")[0]) || 0;
      else leave[key] = parsePair(tok.text);
    }

    if (seq === null) {
      if (hasData) skipped++;
      continue;
    }

    rows.push({
      seq,
      page,
      row_order: order++,
      leave_sick: leave.leave_sick,
      leave_personal: leave.leave_personal,
      leave_vacation: leave.leave_vacation,
      leave_maternity: leave.leave_maternity,
      leave_ordination: leave.leave_ordination,
      leave_spouse_childbirth: leave.leave_spouse_childbirth,
      late_online_days: late,
      absent_days: absent,
      unmapped,
    });
  }

  return { rows, skipped };
}

/**
 * Parse the annual leave summary across all pages.
 * Pages with no ลำดับ-numbered rows (cover memo / totals) contribute nothing.
 */
export async function parseAnnualLeavePdf(
  data: Uint8Array | ArrayBuffer,
): Promise<ParseAnnualResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const pdf = await getDocumentProxy(bytes);

  const all: ParsedAnnualRow[] = [];
  let skipped = 0;
  let pagesWithData = 0;

  for (let page = 1; page <= pdf.numPages; page++) {
    const tokens = await pageTokens(pdf, page);
    const { rows, skipped: s } = buildPageRows(tokens, page, all.length);
    if (rows.length > 0) pagesWithData++;
    all.push(...rows);
    skipped += s;
  }

  return { rows: all, pages_parsed: pagesWithData, skipped_rows: skipped };
}

export { LEAVE_KEYS as ANNUAL_LEAVE_KEYS };
