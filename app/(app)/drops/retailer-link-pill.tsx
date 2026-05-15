"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MonitorMode = "off" | "manual" | "cold" | "warm" | "hot";
export type MonitorState = "unknown" | "in_stock" | "out_of_stock" | "queue" | "error";

export type RetailerLinkPillProps = {
  link: {
    id: string;
    retailer: string;
    region: string;
    url: string;
    price_usd: number | null;
    price_eur: number | null;
    in_stock: boolean | null;
    stock_checked_at: string | null;
    notes: string | null;
    monitor_mode?: MonitorMode;
    last_state?: MonitorState;
    last_state_at?: string | null;
    next_check_at?: string | null;
  };
  retailerLabel: string;
  isAdmin: boolean;
};

const STATE_DOT: Record<MonitorState, string> = {
  in_stock: "bg-emerald-500",
  out_of_stock: "bg-red-500",
  queue: "bg-amber-500",
  error: "bg-orange-500",
  unknown: "bg-muted-foreground/40",
};

const STATE_LABEL: Record<MonitorState, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  queue: "In queue",
  error: "Check error",
  unknown: "Stock unknown",
};

const MODE_LABEL: Record<MonitorMode, string> = {
  off: "Off",
  manual: "Manual",
  cold: "Cold · 4h",
  warm: "Warm · 30m",
  hot: "Hot · 5m",
};

function deriveState(link: RetailerLinkPillProps["link"]): MonitorState {
  if (link.last_state && link.last_state !== "unknown") return link.last_state;
  if (link.in_stock === true) return "in_stock";
  if (link.in_stock === false) return "out_of_stock";
  return "unknown";
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function RetailerLinkPill({
  link,
  retailerLabel,
  isAdmin,
}: RetailerLinkPillProps) {
  const [linkState, setLinkState] = useState(link);
  const [mode, setMode] = useState<MonitorMode>(link.monitor_mode ?? "off");
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = deriveState(linkState);
  const monitored = mode !== "off" && mode !== "manual";

  const price =
    linkState.price_usd != null
      ? formatCurrency(linkState.price_usd, "USD")
      : linkState.price_eur != null
        ? formatCurrency(linkState.price_eur, "EUR")
        : null;

  async function cycleManualStock(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending || monitored) return;
    const next =
      linkState.in_stock === null ? true : linkState.in_stock === true ? false : null;
    setPending(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("drop_retailer_links")
      .update({
        in_stock: next,
        stock_checked_at: new Date().toISOString(),
      })
      .eq("id", linkState.id);
    setPending(false);
    if (!err) {
      setLinkState((s) => ({ ...s, in_stock: next, stock_checked_at: new Date().toISOString() }));
    }
  }

  async function changeMode(next: MonitorMode) {
    if (pending) return;
    setPending(true);
    setError(null);
    const prev = mode;
    setMode(next);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("monitor_set_link_mode" as never, {
      p_link_id: linkState.id,
      p_mode: next,
    } as never);
    setPending(false);
    if (err) {
      setMode(prev);
      setError(err.message);
    }
  }

  async function checkNow() {
    if (checking) return;
    setChecking(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.functions.invoke("drop-check-link", {
      body: { link_id: linkState.id },
    });
    setChecking(false);
    if (err) {
      const fnMsg = (err as { context?: { error?: string } })?.context?.error;
      setError(fnMsg ?? err.message);
      return;
    }
    const res = (data as { result?: { state?: MonitorState } } | null)?.result;
    if (res?.state) {
      setLinkState((s) => ({
        ...s,
        last_state: res.state,
        last_state_at: new Date().toISOString(),
        in_stock:
          res.state === "in_stock" ? true : res.state === "out_of_stock" ? false : s.in_stock,
      }));
    }
  }

  const dotColor = STATE_DOT[state];
  const tooltip = `${STATE_LABEL[state]}${
    linkState.last_state_at ? ` · ${timeAgo(linkState.last_state_at)}` : ""
  }${linkState.notes ? ` · ${linkState.notes}` : ""}`;

  const out = state === "out_of_stock";

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-stretch rounded-md border bg-background text-xs font-medium">
        {isAdmin && !monitored ? (
          <button
            type="button"
            onClick={cycleManualStock}
            aria-label={`Toggle stock state for ${retailerLabel}`}
            title={`${tooltip} — click to change`}
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
            aria-label={STATE_LABEL[state]}
            title={tooltip}
            className="inline-flex h-7 w-6 items-center justify-center rounded-l-md border-r"
          >
            <span className={cn("h-2 w-2 rounded-full", dotColor)} aria-hidden />
          </span>
        )}
        <a
          href={linkState.url}
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
          {linkState.region !== "US" && (
            <span className="rounded bg-muted px-1 text-[10px] font-mono uppercase text-muted-foreground">
              {linkState.region}
            </span>
          )}
          {price && (
            <span className="tabular-nums text-muted-foreground">{price}</span>
          )}
          <ExternalLink className="h-3 w-3" />
        </a>
      </span>

      {isAdmin && (
        <span className="inline-flex items-center gap-1">
          <Select
            value={mode}
            onValueChange={(v) => changeMode(v as MonitorMode)}
            disabled={pending}
          >
            <SelectTrigger
              className="h-7 w-[110px] px-2 text-[11px]"
              aria-label="Monitor mode"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["off", "manual", "cold", "warm", "hot"] as MonitorMode[]).map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {MODE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={checkNow}
            disabled={checking || !linkState.url}
            aria-label="Check now"
            title="Check now"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              checking && "opacity-60",
            )}
          >
            <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
          </button>
        </span>
      )}
      {error && (
        <span className="text-[11px] text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
