"use client";

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
 * D2: department filter for the leave calendar. Writes the selected
 * department id back to the URL as `?dept=...` (preserving `?m=...`)
 * so the server component re-fetches.
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
    router.push(`/dashboard/leaves/calendar${qs ? `?${qs}` : ""}`);
  }

  return (
    <Select value={selected ?? ALL_VALUE} onValueChange={onChange}>
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
