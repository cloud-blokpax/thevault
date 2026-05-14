"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";

type StockState = boolean | null;

export type RetailerLinkPillProps = {
  link: {
    id: string;
    retailer: string;
    region: string;
    url: string;
    price_usd: number | null;
    price_eur: number | null;
    in_stock: StockState;
    stock_checked_at: string | null;
    notes: string | null;
  };
  retailerLabel: string;
  isAdmin: boolean;
};

const STOCK_LABEL: Record<"in" | "out" | "unknown", string> = {
  in: "In stock",
  out: "Out of stock",
  unknown: "Stock unknown",
};

function stateKey(s: StockState): "in" | "out" | "unknown" {
  if (s === true) return "in";
  if (s === false) return "out";
  return "unknown";
}

function nextState(s: StockState): StockState {
  if (s === null) return true;
  if (s === true) return false;
  return null;
}

export function RetailerLinkPill({
  link,
  retailerLabel,
  isAdmin,
}: RetailerLinkPillProps) {
  const [stock, setStock] = useState<StockState>(link.in_stock);
  const [pending, setPending] = useState(false);

  const price =
    link.price_usd != null
      ? formatCurrency(link.price_usd, "USD")
      : link.price_eur != null
        ? formatCurrency(link.price_eur, "EUR")
        : null;
  const out = stock === false;
  const key = stateKey(stock);

  async function cycle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const target = nextState(stock);
    const supabase = createClient();
    const { error } = await supabase
      .from("drop_retailer_links")
      .update({
        in_stock: target,
        stock_checked_at: new Date().toISOString(),
      })
      .eq("id", link.id);
    setPending(false);
    if (!error) setStock(target);
  }

  const dotColor =
    key === "in"
      ? "bg-emerald-500"
      : key === "out"
        ? "bg-red-500"
        : "bg-muted-foreground/40";

  const tooltip = link.notes
    ? `${STOCK_LABEL[key]} · ${link.notes}`
    : STOCK_LABEL[key];

  return (
    <span className="inline-flex items-stretch rounded-md border bg-background text-xs font-medium">
      {isAdmin ? (
        <button
          type="button"
          onClick={cycle}
          aria-label={`Toggle stock state for ${retailerLabel} (currently ${STOCK_LABEL[key].toLowerCase()})`}
          title={`${STOCK_LABEL[key]} — click to change`}
          disabled={pending}
          className={cn(
            "inline-flex h-7 w-6 items-center justify-center rounded-l-md border-r hover:bg-accent",
            pending && "opacity-50",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", dotColor)} aria-hidden />
        </button>
      ) : (
        <span
          aria-label={STOCK_LABEL[key]}
          title={STOCK_LABEL[key]}
          className="inline-flex h-7 w-6 items-center justify-center rounded-l-md border-r"
        >
          <span className={cn("h-2 w-2 rounded-full", dotColor)} aria-hidden />
        </span>
      )}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 px-2.5 py-1 transition-colors sm:min-h-0",
          out
            ? "text-muted-foreground line-through"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
        title={tooltip}
      >
        <span>{retailerLabel}</span>
        {link.region !== "US" && (
          <span className="rounded bg-muted px-1 text-[10px] font-mono uppercase text-muted-foreground">
            {link.region}
          </span>
        )}
        {price && (
          <span className="tabular-nums text-muted-foreground">{price}</span>
        )}
        <ExternalLink className="h-3 w-3" />
      </a>
    </span>
  );
}
