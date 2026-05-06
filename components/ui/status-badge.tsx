import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

const STATUS_CLASSES: Record<Enums<"inventory_status">, string> = {
  pending: "bg-slate-200 text-slate-800",
  bought: "bg-amber-200 text-amber-900",
  in_transit: "bg-blue-200 text-blue-900",
  landed: "bg-cyan-200 text-cyan-900",
  listed: "bg-violet-200 text-violet-900",
  sold: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-rose-200 text-rose-900",
};

const STATUS_LABEL: Record<Enums<"inventory_status">, string> = {
  pending: "Pending",
  bought: "Bought",
  in_transit: "In transit",
  landed: "Landed",
  listed: "Listed",
  sold: "Sold",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, className }: { status: Enums<"inventory_status">; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
