import { Skeleton } from "@/components/ui/skeleton";

export default function PersonnelCalendarLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-72" />
      </div>

      {/* Calendar grid skeleton */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-2 border-b">
              <Skeleton className="h-4 w-8 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="border-b border-r p-1.5 min-h-[110px] space-y-2">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
