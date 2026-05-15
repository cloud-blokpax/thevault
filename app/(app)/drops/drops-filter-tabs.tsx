"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "upcoming" | "in_stock" | "suggested" | "past";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "in_stock", label: "In stock now" },
  { key: "suggested", label: "Suggested" },
  { key: "past", label: "Past" },
];

export function DropsFilterTabs({
  active,
  counts,
}: {
  active: FilterKey;
  counts: Record<FilterKey, number>;
}) {
  return (
    <nav
      aria-label="Drop filters"
      className="-mx-1 flex flex-wrap gap-1 overflow-x-auto"
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        const count = counts[t.key];
        return (
          <Link
            key={t.key}
            href={t.key === "all" ? "/drops" : `/drops?filter=${t.key}`}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            <span>{t.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "tabular-nums",
                  isActive ? "opacity-90" : "text-muted-foreground/80",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
