import { NextResponse } from "next/server";

/**
 * Generates the employee-import CSV template on the fly.
 *
 * Why dynamic?
 *
 *  1. **UTF-8 BOM** — Excel on Windows defaults to the system's Thai ANSI
 *     codepage (CP874) when opening `.csv`. Without a BOM, our Thai
 *     content is rendered as mojibake (เธเธ•เธ• ...). Prefixing the file
 *     with `﻿` tells Excel "this is UTF-8".
 *
 *  2. **Phone number protection** — Excel auto-converts pure digit
 *     strings (e.g. `0812345678`) to scientific notation and drops the
 *     leading zero. Wrapping cells in the Excel-specific formula form
 *     `="0812345678"` forces them to render as text. Our import server
 *     action strips this wrapper before processing.
 *
 * Both behaviors are unique to Excel — LibreOffice/Sheets handle UTF-8
 * CSV correctly without a BOM. The BOM + formula wrappers are
 * additive-safe (parsed correctly by papaparse with our wrapper-strip
 * logic in bulkImportEmployees).
 */

const HEADERS = [
  "email",
  "title_th",
  "first_name_th",
  "last_name_th",
  "title_en",
  "first_name_en",
  "last_name_en",
  "position_number",
  "position_title",
  "employee_type",
  "department_name",
  "education_level",
  "birth_date",
  "hire_date",
  "gender",
  "phone",
  "current_address",
  "role",
];

// Fields that Excel mis-formats as numbers/scientific notation — wrap as
// ="..." so Excel keeps them as text. The server parser strips this back.
const TEXT_GUARDED_FIELDS = new Set(["phone", "position_number"]);

interface Row {
  [key: string]: string;
}

const SAMPLE_ROWS: Row[] = [
  {
    email: "somchai.j@g.lpru.ac.th",
    title_th: "นาย",
    first_name_th: "สมชาย",
    last_name_th: "ใจดี",
    title_en: "Mr.",
    first_name_en: "Somchai",
    last_name_en: "Jaidee",
    position_number: "P-001",
    position_title: "อาจารย์",
    employee_type: "พนักงานมหาวิทยาลัย",
    department_name: "สาขาวิทยาการคอมพิวเตอร์",
    education_level: "ปริญญาเอก",
    birth_date: "1985-05-12",
    hire_date: "2015-06-01",
    gender: "ชาย",
    phone: "0812345678",
    current_address: "123/4 ถ.สนามบิน อ.เมือง จ.ลำปาง",
    role: "employee",
  },
  {
    email: "suchada.k@g.lpru.ac.th",
    title_th: "ผศ.ดร.",
    first_name_th: "สุชาดา",
    last_name_th: "กิตติชัย",
    title_en: "Asst.Prof.Dr.",
    first_name_en: "Suchada",
    last_name_en: "Kittichai",
    position_number: "P-002",
    position_title: "ผู้ช่วยศาสตราจารย์",
    employee_type: "ข้าราชการ",
    department_name: "สาขาคณิตศาสตร์",
    education_level: "ปริญญาเอก",
    birth_date: "1978-09-23",
    hire_date: "2008-05-15",
    gender: "หญิง",
    phone: "0823456789",
    current_address: "55/2 ถ.พหลโยธิน อ.เมือง จ.ลำปาง",
    role: "manager",
  },
  {
    email: "admin.it@g.lpru.ac.th",
    title_th: "นาย",
    first_name_th: "วิทย์",
    last_name_th: "เทคโน",
    title_en: "Mr.",
    first_name_en: "Wit",
    last_name_en: "Techno",
    position_number: "P-099",
    position_title: "เจ้าหน้าที่ระบบสารสนเทศ",
    employee_type: "พนักงานมหาวิทยาลัย",
    department_name: "งานทรัพยากรบุคคล",
    education_level: "ปริญญาตรี",
    birth_date: "1990-01-10",
    hire_date: "2018-08-01",
    gender: "ชาย",
    phone: "0898765432",
    current_address: "99 หมู่ 5 ต.ชมพู อ.เมือง จ.ลำปาง",
    role: "hr",
  },
];

/** RFC 4180-style CSV cell escape: wrap in quotes when needed; double internal quotes. */
function escapeCell(value: string, field: string): string {
  // Apply Excel text-guard for phone/position_number so Excel doesn't
  // collapse leading zeros or render as scientific notation.
  if (TEXT_GUARDED_FIELDS.has(field) && value.length > 0) {
    return `="${value.replace(/"/g, '""')}"`;
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(): string {
  const lines: string[] = [];
  lines.push(HEADERS.join(","));
  for (const row of SAMPLE_ROWS) {
    lines.push(
      HEADERS.map((h) => escapeCell(row[h] ?? "", h)).join(","),
    );
  }
  // CRLF line endings + UTF-8 BOM — both required for clean Excel render
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const dynamic = "force-static"; // cacheable — content never changes

export async function GET() {
  const csv = buildCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="employee-import-template.csv"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
