import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal progress stepper for a leave request's signature workflow.
 * Pure/presentational (safe in a server component). The chair stage only
 * appears for requests that need it (vacation + academic staff), so the node
 * list is built from `needsChair` to mirror the real path.
 */

type NodeKey = "submit" | "chair" | "director" | "dean" | "university" | "done";

const NODE_LABELS: Record<NodeKey, string> = {
  submit: "ยื่นคำขอ",
  chair: "ประธานสาขา",
  director: "ผอ.สำนักงาน",
  dean: "คณบดี",
  university: "อธิการบดี",
  done: "เสร็จสิ้น",
};

/** Which node the request is currently waiting on (null = terminal). */
function currentNode(status: string, needsChair: boolean): NodeKey | null {
  switch (status) {
    case "pending":
      return needsChair ? "chair" : "director";
    case "awaiting_chair":
      return "chair";
    case "awaiting_director":
      return "director";
    case "awaiting_dean":
      return "dean";
    case "approved":
    case "awaiting_university":
      return "university";
    case "completed":
      return "done";
    default:
      return null;
  }
}

export function LeaveWorkflowStepper({
  status,
  needsChair,
}: {
  status: string;
  needsChair: boolean;
}) {
  if (status === "rejected" || status === "cancelled") {
    const isReject = status === "rejected";
    return (
      <div className="border rounded-lg p-4 bg-card">
        <div
          className={cn(
            "flex items-center gap-2 text-sm font-medium",
            isReject ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <XCircle className="h-4 w-4 shrink-0" />
          {isReject ? "คำขอนี้ไม่ได้รับการอนุมัติ" : "คำขอนี้ถูกยกเลิก"}
        </div>
      </div>
    );
  }

  const nodes: NodeKey[] = needsChair
    ? ["submit", "chair", "director", "dean", "university", "done"]
    : ["submit", "director", "dean", "university", "done"];

  const current = currentNode(status, needsChair);
  const isDoneAll = status === "completed";
  const activeIdx = current ? nodes.indexOf(current) : -1;

  return (
    <div className="border rounded-lg p-4 bg-card">
      <p className="text-sm font-semibold mb-4">ขั้นตอนการดำเนินการ</p>
      <ol className="flex items-start">
        {nodes.map((n, i) => {
          const done = isDoneAll || i < activeIdx;
          const active = !isDoneAll && i === activeIdx;
          const prevReached = isDoneAll || i - 1 < activeIdx;
          return (
            <li key={n} className="relative flex flex-1 flex-col items-center">
              {/* connector from the previous node's centre */}
              {i > 0 && (
                <span
                  className={cn(
                    "absolute top-3 -left-1/2 -z-0 h-0.5 w-full",
                    prevReached ? "bg-emerald-500" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40"
                      : "border-border bg-card",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle
                    className={cn(
                      "h-2.5 w-2.5",
                      active ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40",
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  "mt-1.5 px-1 text-center text-xs leading-tight",
                  active
                    ? "font-semibold text-foreground"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {NODE_LABELS[n]}
              </span>
            </li>
          );
        })}
      </ol>
      {current && current !== "done" && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          ตอนนี้รอ: <span className="font-medium text-foreground">{NODE_LABELS[current]}</span>
        </p>
      )}
    </div>
  );
}
