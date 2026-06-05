import { Skeleton } from "@/components/ui/skeleton";

export default function HrLeavesLoading() {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="border border-border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>

      {/* Search row */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-full sm:w-80" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="bg-muted/50 px-4 py-3">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-t">
            <div className="grid grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
