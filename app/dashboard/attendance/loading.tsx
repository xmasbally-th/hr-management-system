import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-6">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="px-3 py-4 border-r border-border">
                <Skeleton className="h-3 w-12 mb-2" />
                <Skeleton className="h-5 w-6" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
