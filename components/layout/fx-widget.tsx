"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fxLatest } from "@/lib/supabase/fx";

function formatRateDate(d: string): string {
  const dt = new Date(d + "T00:00:00Z");
  if (Number.isNaN(dt.getTime())) return d;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(dt);
}

function todayUtcDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function FxWidget() {
  const query = useQuery({
    queryKey: ["fx-widget"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      return await fxLatest(supabase);
    },
  });

  useEffect(() => {
    function refetch() {
      query.refetch();
    }
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, [query]);

  if (query.isLoading || !query.data) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <p className="text-[10px] font-semibold uppercase tracking-wide">
          Today&apos;s FX
        </p>
        <p className="mt-1">Loading…</p>
      </div>
    );
  }

  const { usd_to_eur, eur_to_usd, rate_date } = query.data;
  const stale = rate_date < todayUtcDate();

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s FX
        </p>
        {stale && (
          <span
            title={`FX rate is from ${formatRateDate(rate_date)} — may be stale (markets closed)`}
            className="text-amber-600"
          >
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
      </div>
      <p className="mt-1 tabular-nums">
        $1.00 → €{usd_to_eur.toFixed(4)}
      </p>
      <p className="tabular-nums">
        €1.00 → ${eur_to_usd.toFixed(4)}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        updated {formatRateDate(rate_date)}
      </p>
    </div>
  );
}
