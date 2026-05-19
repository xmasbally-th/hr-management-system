import { User, Briefcase, GraduationCap, Award, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only "overview" view of the current user's profile + history.
 *
 * Shared between:
 *   • /welcome     — first-login review screen
 *   • /dashboard/profile (ภาพรวม tab) — anytime read-only summary
 *
 * All date formatting is deterministic UTC-based to avoid React
 * hydration mismatches (server/client must produce identical HTML).
 */

interface Profile {
  email: string;
  title_th?: string | null;
  first_name_th?: string | null;
  last_name_th?: string | null;
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  phone?: string | null;
  position_title?: string | null;
  position_number?: string | null;
  employee_type?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  current_address?: string | null;
  department?: { id: string; name: string } | null;
}

interface Props {
  profile: Profile;
  educations: Array<{
    id: string;
    entry_year: number | null;
    graduation_year: number | null;
    institution: string;
    country: string | null;
    degree: string;
    program_name: string | null;
    major_field: string | null;
  }>;
  decorations: Array<{
    id: string;
    decoration_name: string;
    abbreviation: string | null;
    approved_date: string | null;
    position_at_grant: string | null;
  }>;
  adminPositions: Array<{
    id: string;
    position_title: string;
    responsible_unit: string | null;
    start_date: string;
    end_date: string | null;
  }>;
  /** When provided, each section header gets a small "ขอแก้" button that
   *  pre-fills the correction form with that section's field keys. */
  onSectionEditClick?: (sectionKey: SectionKey) => void;
  /** Disable section edit buttons (e.g. when a pending request already
   *  exists — user shouldn't queue duplicates). */
  editDisabled?: boolean;
  /** Tooltip shown when the section edit button is disabled. */
  editDisabledReason?: string;
  /** Field keys that the user flagged in a correction request. Each
   *  section header surfaces a "⭐ คำขอแก้ฟิลด์นี้" badge when one of
   *  its fields is in this set. Null/undefined disables highlighting. */
  highlightFields?: Set<string> | null;
}

export type SectionKey =
  | "identity"
  | "position"
  | "educations"
  | "decorations"
  | "admin_positions";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const yearBE = d.getUTCFullYear() + 543;
  return `${day} ${month} ${yearBE}`;
}

function joinThai(p: Profile): string | null {
  const parts = [p.title_th, p.first_name_th, p.last_name_th].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function joinEnglish(p: Profile): string | null {
  const parts = [p.title_en, p.first_name_en, p.last_name_en].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

// Section → which field keys belong to it (used to compute the
// "any flagged?" badge for each header in the read-only overview).
const SECTION_FIELD_GROUPS: Record<SectionKey, string[]> = {
  identity: [
    "title_th","first_name_th","last_name_th",
    "title_en","first_name_en","last_name_en",
    "phone","gender","birth_date","current_address",
  ],
  position: [
    "position_title","position_number","employee_type",
    "department_id","hire_date",
  ],
  educations: ["educations"],
  decorations: ["decorations"],
  admin_positions: ["admin_positions"],
};

export function ProfileOverview({
  profile,
  educations,
  decorations,
  adminPositions,
  onSectionEditClick,
  editDisabled,
  editDisabledReason,
  highlightFields,
}: Props) {
  const editFor = (key: SectionKey) =>
    onSectionEditClick
      ? () => onSectionEditClick(key)
      : undefined;

  const isFlagged = (key: SectionKey): boolean => {
    if (!highlightFields || highlightFields.size === 0) return false;
    return SECTION_FIELD_GROUPS[key].some((f) => highlightFields.has(f));
  };

  return (
    <div className="space-y-6">
      <Section
        icon={<User className="size-4" />}
        title="ข้อมูลส่วนตัว"
        flagged={isFlagged("identity")}
        onEditClick={editFor("identity")}
        editDisabled={editDisabled}
        editDisabledReason={editDisabledReason}
        rows={[
          ["ชื่อ-นามสกุล (ไทย)", joinThai(profile)],
          ["ชื่อ-นามสกุล (อังกฤษ)", joinEnglish(profile)],
          ["อีเมล", profile.email],
          ["เบอร์โทรศัพท์", profile.phone],
          ["เพศ", profile.gender],
          ["วันเดือนปีเกิด", formatDate(profile.birth_date)],
          ["ที่อยู่ปัจจุบัน", profile.current_address],
        ]}
      />

      <Section
        icon={<Briefcase className="size-4" />}
        title="ข้อมูลตำแหน่ง"
        flagged={isFlagged("position")}
        onEditClick={editFor("position")}
        editDisabled={editDisabled}
        editDisabledReason={editDisabledReason}
        rows={[
          ["ตำแหน่ง", profile.position_title],
          ["เลขที่ตำแหน่ง", profile.position_number],
          ["ประเภทบุคลากร", profile.employee_type],
          ["สังกัดหน่วยงาน", profile.department?.name],
          ["วันที่เริ่มทำงาน", formatDate(profile.hire_date)],
        ]}
      />

      <ListBlock
        icon={<GraduationCap className="size-4" />}
        title="ประวัติการศึกษา"
        count={educations.length}
        flagged={isFlagged("educations")}
        onEditClick={editFor("educations")}
        editDisabled={editDisabled}
        editDisabledReason={editDisabledReason}
      >
        {educations.length === 0 ? (
          <Empty text="ยังไม่มีประวัติการศึกษา" />
        ) : (
          <ul className="divide-y divide-border">
            {educations.map((e) => (
              <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                <div className="text-sm font-medium">
                  {e.degree}
                  {e.program_name && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {e.program_name}
                    </span>
                  )}
                  {e.major_field && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · สาขา{e.major_field}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {e.institution}
                  {e.country && <> · {e.country}</>}
                  {(e.entry_year || e.graduation_year) && (
                    <>
                      {" "}
                      · {e.entry_year ?? "?"} – {e.graduation_year ?? "ปัจจุบัน"}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListBlock>

      <ListBlock
        icon={<Award className="size-4" />}
        title="เครื่องราชอิสริยาภรณ์"
        count={decorations.length}
        flagged={isFlagged("decorations")}
        onEditClick={editFor("decorations")}
        editDisabled={editDisabled}
        editDisabledReason={editDisabledReason}
      >
        {decorations.length === 0 ? (
          <Empty text="ยังไม่มีข้อมูล" />
        ) : (
          <ul className="divide-y divide-border">
            {decorations.map((d) => (
              <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                <div className="text-sm font-medium">
                  {d.decoration_name}
                  {d.abbreviation && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      ({d.abbreviation})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {d.position_at_grant && <>{d.position_at_grant} · </>}
                  {formatDate(d.approved_date)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListBlock>

      <ListBlock
        icon={<Briefcase className="size-4" />}
        title="ประวัติการดำรงตำแหน่งบริหาร"
        count={adminPositions.length}
        flagged={isFlagged("admin_positions")}
        onEditClick={editFor("admin_positions")}
        editDisabled={editDisabled}
        editDisabledReason={editDisabledReason}
      >
        {adminPositions.length === 0 ? (
          <Empty text="ยังไม่มีข้อมูล" />
        ) : (
          <ul className="divide-y divide-border">
            {adminPositions.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="text-sm font-medium">{p.position_title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.responsible_unit && <>{p.responsible_unit} · </>}
                  {formatDate(p.start_date)} –{" "}
                  {formatDate(p.end_date) ?? "ปัจจุบัน"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListBlock>
    </div>
  );
}

// ─── Internal sub-components ────────────────────────────────────────

function Section({
  icon,
  title,
  rows,
  flagged,
  onEditClick,
  editDisabled,
  editDisabledReason,
}: {
  icon: React.ReactNode;
  title: string;
  rows: Array<[string, string | null | undefined]>;
  flagged?: boolean;
  onEditClick?: () => void;
  editDisabled?: boolean;
  editDisabledReason?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5",
        flagged ? "border-amber-300 ring-2 ring-amber-100" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div
          className={cn(
            "size-8 grid place-items-center rounded-lg",
            flagged
              ? "bg-amber-100 text-amber-700"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </div>
        <h2 className="font-semibold flex-1">{title}</h2>
        {flagged && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200"
            title="ผู้ใช้แจ้งขอแก้ไขข้อมูลในส่วนนี้"
          >
            ⭐ คำขอแก้
          </span>
        )}
        <EditButton
          onClick={onEditClick}
          disabled={editDisabled}
          disabledReason={editDisabledReason}
        />
      </header>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "text-sm mt-0.5",
                !value && "text-muted-foreground italic",
              )}
            >
              {value || "— ไม่ระบุ —"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListBlock({
  icon,
  title,
  count,
  children,
  flagged,
  onEditClick,
  editDisabled,
  editDisabledReason,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
  flagged?: boolean;
  onEditClick?: () => void;
  editDisabled?: boolean;
  editDisabledReason?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5",
        flagged ? "border-amber-300 ring-2 ring-amber-100" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div
          className={cn(
            "size-8 grid place-items-center rounded-lg",
            flagged
              ? "bg-amber-100 text-amber-700"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </div>
        <h2 className="font-semibold flex-1">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {count} รายการ
        </span>
        {flagged && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200"
            title="ผู้ใช้แจ้งขอแก้ไขข้อมูลในส่วนนี้"
          >
            ⭐ คำขอแก้
          </span>
        )}
        <EditButton
          onClick={onEditClick}
          disabled={editDisabled}
          disabledReason={editDisabledReason}
        />
      </header>
      {children}
    </section>
  );
}

function EditButton({
  onClick,
  disabled,
  disabledReason,
}: {
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : "ขอแก้ไขข้อมูลในส่วนนี้"}
      aria-label="ขอแก้ไขข้อมูลในส่วนนี้"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition",
        disabled
          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
          : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
      )}
    >
      <Pencil className="size-3" />
      ขอแก้
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-6 text-sm text-muted-foreground italic">
      {text}
    </div>
  );
}
