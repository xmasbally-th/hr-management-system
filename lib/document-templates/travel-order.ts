/**
 * Travel Appointment Order (.docx) generator.
 *
 * Generates a formal Thai government-style travel order document
 * based on the travel request data and employee profile.
 */
import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopPosition,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
} from "docx";

const travelTypeLabels: Record<string, string> = {
  training: "ไปราชการเพื่ออบรม/สัมมนา",
  supervision: "ไปราชการเพื่อนิเทศ",
  official_contact: "ไปราชการเพื่อติดต่อราชการ",
};

interface TravelOrderData {
  /** Travel request fields */
  title: string;
  travelType: string;
  location: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  /** Employee fields */
  employeeName: string;
  employeePosition?: string;
  departmentName?: string;
  /** Expenses */
  expenses: {
    category: string;
    estimatedAmount: number;
  }[];
  /** Order metadata */
  orderNumber?: string;
  orderDate?: string;
}

function formatThaiDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  } as const;
}

export function generateTravelOrderDocument(data: TravelOrderData): Document {
  const orderDate = data.orderDate ? formatThaiDate(data.orderDate) : formatThaiDate(new Date().toISOString());
  const totalBudget = data.expenses.reduce((sum, e) => sum + e.estimatedAmount, 0);
  const travelTypeLabel = travelTypeLabels[data.travelType] || data.travelType;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "TH SarabunPSK",
            size: 32, // 16pt
          },
          paragraph: {
            spacing: { line: 276 }, // 1.15 line spacing
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [
          // Header: Document title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "คำสั่ง",
                bold: true,
                size: 36, // 18pt
              }),
            ],
          }),

          // Sub-header: Organization (placeholder)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: data.departmentName ? `${data.departmentName}` : "หน่วยงาน",
                bold: true,
                size: 32,
              }),
            ],
          }),

          // Order number and date
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `ที่ ${data.orderNumber || "............/............"}`,
                size: 32,
              }),
            ],
          }),

          // Subject line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `เรื่อง  ให้บุคลากร${travelTypeLabel}`,
                bold: true,
                size: 32,
              }),
            ],
          }),

          // Separator line
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "___________________________",
                size: 28,
              }),
            ],
          }),

          // Body paragraph 1: Authorization
          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `ด้วย ${data.employeeName}`,
                size: 32,
              }),
              new TextRun({
                text: data.employeePosition ? ` ตำแหน่ง ${data.employeePosition}` : "",
                size: 32,
              }),
              new TextRun({
                text: data.departmentName ? ` สังกัด ${data.departmentName}` : "",
                size: 32,
              }),
              new TextRun({
                text: ` มีความจำเป็นต้อง${travelTypeLabel}`,
                size: 32,
              }),
            ],
          }),

          // Body paragraph 2: Details
          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `เรื่อง: ${data.title}`,
                bold: true,
                size: 32,
              }),
            ],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `สถานที่: ${data.location}`,
                size: 32,
              }),
            ],
          }),

          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `ระหว่างวันที่ ${formatThaiDate(data.startDate)} ถึงวันที่ ${formatThaiDate(data.endDate)} รวม ${data.totalDays} วัน`,
                size: 32,
              }),
            ],
          }),

          // Budget section
          ...(data.expenses.length > 0
            ? [
                new Paragraph({
                  indent: { firstLine: 720 },
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: "โดยใช้งบประมาณ ดังนี้",
                      size: 32,
                    }),
                  ],
                }),

                // Expense table
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    // Header row
                    new TableRow({
                      children: [
                        new TableCell({
                          width: { size: 10, type: WidthType.PERCENTAGE },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [new TextRun({ text: "ลำดับ", bold: true, size: 30 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 60, type: WidthType.PERCENTAGE },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: "หมวดค่าใช้จ่าย", bold: true, size: 30 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 30, type: WidthType.PERCENTAGE },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [new TextRun({ text: "จำนวนเงิน (บาท)", bold: true, size: 30 })],
                            }),
                          ],
                        }),
                      ],
                    }),
                    // Data rows
                    ...data.expenses.map(
                      (exp, idx) =>
                        new TableRow({
                          children: [
                            new TableCell({
                              children: [
                                new Paragraph({
                                  alignment: AlignmentType.CENTER,
                                  children: [new TextRun({ text: `${idx + 1}`, size: 30 })],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [new TextRun({ text: exp.category, size: 30 })],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  alignment: AlignmentType.RIGHT,
                                  children: [
                                    new TextRun({
                                      text: exp.estimatedAmount.toLocaleString("th-TH", {
                                        minimumFractionDigits: 2,
                                      }),
                                      size: 30,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        })
                    ),
                    // Total row
                    new TableRow({
                      children: [
                        new TableCell({
                          columnSpan: 2,
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [new TextRun({ text: "รวมทั้งสิ้น", bold: true, size: 30 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [
                                new TextRun({
                                  text: totalBudget.toLocaleString("th-TH", {
                                    minimumFractionDigits: 2,
                                  }),
                                  bold: true,
                                  size: 30,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ]
            : []),

          // Closing paragraph
          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { before: 300, after: 200 },
            children: [
              new TextRun({
                text: "จึงอนุมัติให้เดินทางไปราชการตามรายละเอียดข้างต้น",
                size: 32,
              }),
            ],
          }),

          // Order date
          new Paragraph({
            indent: { firstLine: 720 },
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `สั่ง ณ วันที่ ${orderDate}`,
                size: 32,
              }),
            ],
          }),

          // Signature area
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 100 },
            children: [
              new TextRun({
                text: "(..................................................)",
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "ผู้มีอำนาจสั่ง",
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "ตำแหน่ง ..............................................",
                size: 32,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return doc;
}
