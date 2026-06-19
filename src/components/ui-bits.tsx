import { STATUS_LABEL, type TaskStatus, type TaskPriority, PRIORITY_LABEL } from "@/lib/types";
import { Flag } from "lucide-react";

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full status-${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] priority-${priority}`}>
      <Flag className="h-3 w-3" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
