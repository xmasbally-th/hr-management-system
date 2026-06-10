"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  departments: { id: string; name: string }[];
  selected: string | null;
}

const ALL_VALUE = "__all__";

/**
 * Department filter for the personnel calendar (manager+ only). Writes the
 * selected department id back to the URL as `?dept=...` (preserving `?m` /
 * `?cat`) so the server component re-fetches and re-scopes the events.
 */
export function DepartmentFilter({ departments, selected }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string | null) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (!value || value === ALL_VALUE) {
      params.delete("dept");
    } else {
      params.set("dept", value);
    }
    const qs = params.toString();
    router.push(`/dashboard/personnel-calendar${qs ? `?${qs}` : ""}`);
  }

  // Base UI Select.Value renders the raw value (a UUID) without an items map.
  const items = useMemo(
    () => ({ [ALL_VALUE]: "ทุกหน่วยงาน", ...Object.fromEntries(departments.map((d) => [d.id, d.name])) }),
    [departments],
  );

  return (
    <Select items={items} value={selected ?? ALL_VALUE} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[12rem]">
        <SelectValue placeholder="ทุกหน่วยงาน" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>ทุกหน่วยงาน</SelectItem>
        {departments.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
