/**
 * Training type labels and helpers.
 * Shared between client and server components.
 */

export const TRAINING_TYPES: Record<string, string> = {
  internal: "อบรมภายใน",
  external: "อบรมภายนอก",
  seminar: "สัมมนา",
  workshop: "เวิร์คชอป",
  conference: "ประชุมวิชาการ",
  online: "อบรมออนไลน์",
  other: "อื่นๆ",
};

export function getTrainingTypeLabel(type: string): string {
  return TRAINING_TYPES[type] ?? type;
}

export function getTrainingTypes(): { value: string; label: string }[] {
  return Object.entries(TRAINING_TYPES).map(([value, label]) => ({ value, label }));
}
