"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface StatusFilterProps {
  options: { value: string; label: string }[];
  paramName?: string;
}

/**
 * URL-synced status filter tabs. Resets page when status changes.
 */
export function StatusFilter({ options, paramName = "status" }: StatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? "all";

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleClick(opt.value)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            current === opt.value
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground border"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
