"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  /** Current page (1-based) */
  currentPage: number;
  /** Total number of items */
  totalCount: number;
  /** Items per page */
  pageSize: number;
  /** CSS class */
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalCount,
  pageSize,
  className,
}: PaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Don't show pagination if only 1 page
  if (totalPages <= 1) {
    return totalCount > 0 ? (
      <div className={`text-sm text-muted-foreground text-center ${className ?? ""}`}>
        ทั้งหมด {totalCount} รายการ
      </div>
    ) : null;
  }

  // Generate page numbers to show
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`}>
      <p className="text-sm text-muted-foreground">
        แสดง {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} จาก {totalCount} รายการ
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canPrev}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-xs"
              onClick={() => goToPage(p as number)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canNext}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Client-side pagination controls (no URL sync).
 */
export function ClientPaginationControls({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  className,
}: PaginationControlsProps & { onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  if (totalPages <= 1) {
    return totalCount > 0 ? (
      <div className={`text-sm text-muted-foreground text-center ${className ?? ""}`}>
        ทั้งหมด {totalCount} รายการ
      </div>
    ) : null;
  }

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <div className={`flex items-center justify-between gap-4 ${className ?? ""}`}>
      <p className="text-sm text-muted-foreground">
        แสดง {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} จาก {totalCount} รายการ
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canPrev}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 text-xs"
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!canNext}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Generate page numbers with ellipsis for large ranges */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
