"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Flag,
  Info,
  Plus,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CardImage } from "@/components/ui/card-image";
import { ZoomableCardImage } from "@/components/ui/zoomable-card-image";
import { CardSearchInput, type CardHit } from "@/components/card-search-input";
import { cn, formatCurrency, formatDateTime, titleCase } from "@/lib/utils";
import {
  type BuyCategory,
  type Deal,
  type DealConfidence,
  type EbayListing,
  type PriceQuality,
  type ProvenanceRow,
  POTENTIAL_DEALS_SELECT,
  gameLabel,
  num,
} from "@/lib/deals";

export const runtime = "edge";

type Confidence = DealConfidence;

type GameFilter = "all" | "pokemon" | "one_piece";
type TypeFilter = "all" | "sealed" | "singles";
type SortKey =
  | "profit_floor_desc"
  | "profit_trend_desc"
  | "margin_floor_desc"
  | "buy_asc"
  | "buy_desc";

const PROFIT_SNAPS = [0, 5, 25, 100, 500];
const MARGIN_SNAPS = [0, 10, 20, 30, 50, 100, 200, 500];

const TRANSPARENCY_BANNER_KEY = "deals.transparencyBanner.dismissed";

function snap(value: number, snaps: number[]): number {
  let best = snaps[0];
  let bestDiff = Math.abs(value - best);
  for (const s of snaps) {
    const d = Math.abs(value - s);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type CategoryDefaults = {
  type: TypeFilter;
  minMargin: number;
  minBuy: string;
  maxBuy: string;
  showWarnings: boolean;
  includeTrendOnly: boolean;
  sort: SortKey;
  confidence: Confidence[];
};

function defaultsForCategory(c: BuyCategory | null): CategoryDefaults {
  switch (c) {
    case "sealed-premium":
      return {
        type: "sealed",
        minMargin: 0,
        minBuy: "200",
        maxBuy: "",
        showWarnings: false,
        includeTrendOnly: false,
        sort: "profit_floor_desc",
        confidence: ["high", "medium", "low"],
      };
    case "sealed-other":
      return {
        type: "sealed",
        minMargin: 0,
        minBuy: "",
        maxBuy: "200",
        showWarnings: false,
        includeTrendOnly: false,
        sort: "profit_floor_desc",
        confidence: ["high", "medium", "low"],
      };
    case "premium-singles":
      return {
        type: "singles",
        minMargin: 0,
        minBuy: "50",
        maxBuy: "",
        showWarnings: false,
        includeTrendOnly: false,
        sort: "profit_floor_desc",
        confidence: ["high", "medium", "low"],
      };
    case "microflips":
      return {
        type: "singles",
        minMargin: 30,
        minBuy: "",
        maxBuy: "50",
        showWarnings: false,
        includeTrendOnly: false,
        sort: "margin_floor_desc",
        confidence: ["high", "medium", "low"],
      };
    case "verify":
      return {
        type: "all",
        minMargin: 0,
        minBuy: "",
        maxBuy: "",
        showWarnings: true,
        includeTrendOnly: true,
        sort: "profit_trend_desc",
        confidence: ["high", "medium", "low"],
      };
    case "top":
    default:
      return {
        type: "all",
        minMargin: 0,
        minBuy: "",
        maxBuy: "",
        showWarnings: false,
        includeTrendOnly: false,
        sort: "profit_floor_desc",
        confidence: ["high", "medium"],
      };
  }
}

export default function DealsPage() {
  return (
    <Suspense fallback={null}>
      <DealsPageInner />
    </Suspense>
  );
}

function DealsPageInner() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") as BuyCategory | null;
  const initial = useMemo(() => defaultsForCategory(categoryParam), [categoryParam]);

  const [game, setGame] = useState<GameFilter>("all");
  const [type, setType] = useState<TypeFilter>(initial.type);
  const [minMargin, setMinMargin] = useState(initial.minMargin);
  const [minProfit, setMinProfit] = useState(0);
  const [minBuy, setMinBuy] = useState(initial.minBuy);
  const [maxBuy, setMaxBuy] = useState(initial.maxBuy);
  const [confidence, setConfidence] = useState<Confidence[]>(initial.confidence);
  const [showWarnings, setShowWarnings] = useState(initial.showWarnings);
  const [includeTrendOnly, setIncludeTrendOnly] = useState(initial.includeTrendOnly);
  const [sort, setSort] = useState<SortKey>(initial.sort);

  const [debouncedMinBuy, setDebouncedMinBuy] = useState(minBuy);
  const [debouncedMaxBuy, setDebouncedMaxBuy] = useState(maxBuy);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMinBuy(minBuy), 300);
    return () => clearTimeout(t);
  }, [minBuy]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMaxBuy(maxBuy), 300);
    return () => clearTimeout(t);
  }, [maxBuy]);

  const filterKey = useMemo(
    () => ({
      game,
      type,
      minMargin,
      minProfit,
      minBuy: debouncedMinBuy,
      maxBuy: debouncedMaxBuy,
      confidence: [...confidence].sort().join(","),
      showWarnings,
      includeTrendOnly,
      sort,
    }),
    [
      game,
      type,
      minMargin,
      minProfit,
      debouncedMinBuy,
      debouncedMaxBuy,
      confidence,
      showWarnings,
      includeTrendOnly,
      sort,
    ],
  );

  const dealsQuery = useQuery<Deal[]>({
    queryKey: ["potential_deals", filterKey],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("potential_deals" as never)
        .select(POTENTIAL_DEALS_SELECT)
        .limit(50);

      if (includeTrendOnly) {
        q = q.gt("profit_eur", 0);
      } else {
        q = q.gt("profit_at_eu_low_eur", 0);
      }

      if (!showWarnings) q = q.eq("variant_spread_warning", false);
      if (game !== "all") q = q.eq("game", game);
      if (type === "sealed") q = q.eq("is_sealed", true);
      if (type === "singles") q = q.eq("is_sealed", false);
      if (minMargin > 0) {
        if (includeTrendOnly) q = q.gte("margin_pct", minMargin);
        else q = q.gte("margin_pct_at_eu_low", minMargin);
      }
      if (minProfit > 0) {
        if (includeTrendOnly) q = q.gte("profit_eur", minProfit);
        else q = q.gte("profit_at_eu_low_eur", minProfit);
      }
      const minB = Number(debouncedMinBuy);
      if (debouncedMinBuy && !Number.isNaN(minB) && minB > 0) q = q.gte("us_buy_usd", minB);
      const maxB = Number(debouncedMaxBuy);
      if (debouncedMaxBuy && !Number.isNaN(maxB) && maxB > 0) q = q.lte("us_buy_usd", maxB);
      if (confidence.length > 0 && confidence.length < 3) {
        q = q.in("match_confidence", confidence);
      }
      switch (sort) {
        case "profit_trend_desc":
          q = q.order("profit_eur", { ascending: false });
          break;
        case "margin_floor_desc":
          q = q.order("margin_pct_at_eu_low", { ascending: false, nullsFirst: false });
          break;
        case "buy_asc":
          q = q.order("us_buy_usd", { ascending: true });
          break;
        case "buy_desc":
          q = q.order("us_buy_usd", { ascending: false });
          break;
        default:
          q = q.order("profit_at_eu_low_eur", { ascending: false, nullsFirst: false });
      }

      const { data, error } = (await q) as unknown as { data: Deal[] | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [openDeal, setOpenDeal] = useState<Deal | null>(null);
  const [provenanceCardId, setProvenanceCardId] = useState<string | null>(null);
  const [provenanceTitle, setProvenanceTitle] = useState<string>("");

  function showProvenance(deal: Deal) {
    setProvenanceCardId(deal.card_id);
    setProvenanceTitle(deal.name);
  }

  const deals = dealsQuery.data ?? [];

  function toggleConfidence(c: Confidence) {
    setConfidence((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  function resetFilters() {
    setGame("all");
    setType(initial.type);
    setMinMargin(initial.minMargin);
    setMinProfit(0);
    setMinBuy(initial.minBuy);
    setMaxBuy(initial.maxBuy);
    setConfidence(initial.confidence);
    setShowWarnings(initial.showWarnings);
    setIncludeTrendOnly(initial.includeTrendOnly);
    setSort(initial.sort);
  }

  const sameConfidence = (a: Confidence[], b: Confidence[]) =>
    a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

  const activeFilterCount =
    (game !== "all" ? 1 : 0) +
    (type !== initial.type ? 1 : 0) +
    (minMargin !== initial.minMargin ? 1 : 0) +
    (minProfit !== 0 ? 1 : 0) +
    (minBuy !== initial.minBuy ? 1 : 0) +
    (maxBuy !== initial.maxBuy ? 1 : 0) +
    (sameConfidence(confidence, initial.confidence) ? 0 : 1) +
    (showWarnings !== initial.showWarnings ? 1 : 0) +
    (includeTrendOnly !== initial.includeTrendOnly ? 1 : 0) +
    (sort !== initial.sort ? 1 : 0);

  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (filtersOpen !== null) return;
    if (typeof window === "undefined") return;
    setFiltersOpen(window.matchMedia("(min-width: 768px)").matches);
  }, [filtersOpen]);
  const isOpen = filtersOpen ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground">
          US→EU arbitrage opportunities, refreshed nightly. Profit estimates apply your default margins, travel, and FX.
        </p>
      </div>

      <TransparencyBanner />

      <QuickEvaluator />

      <div className="sticky top-12 z-20 -mx-4 border-b bg-background/95 backdrop-blur md:top-0 md:mx-0 md:rounded-lg md:border">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !(v ?? false))}
          aria-expanded={isOpen}
          aria-controls="deals-filter-panel"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
        <div
          id="deals-filter-panel"
          hidden={!isOpen}
          className={cn("border-t px-4 pb-3 pt-3", !isOpen && "hidden")}
        >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Game</Label>
            <div className="flex flex-wrap gap-1">
              {(["all", "pokemon", "one_piece"] as GameFilter[]).map((g) => (
                <Chip key={g} active={game === g} onClick={() => setGame(g)}>
                  {g === "all" ? "All" : g === "one_piece" ? "One Piece" : "Pokemon"}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <div className="flex flex-wrap gap-1">
              {(["all", "sealed", "singles"] as TypeFilter[]).map((t) => (
                <Chip key={t} active={type === t} onClick={() => setType(t)}>
                  {t === "all" ? "All" : titleCase(t)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center justify-between">
              <span>Min margin</span>
              <span className="tabular-nums text-muted-foreground">{minMargin}%</span>
            </Label>
            <input
              type="range"
              min={0}
              max={500}
              step={1}
              value={minMargin}
              onChange={(e) => setMinMargin(snap(Number(e.target.value), MARGIN_SNAPS))}
              className="w-full"
              aria-label="Minimum margin percent"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center justify-between">
              <span>Min profit</span>
              <span className="tabular-nums text-muted-foreground">€{minProfit}</span>
            </Label>
            <input
              type="range"
              min={0}
              max={500}
              step={1}
              value={minProfit}
              onChange={(e) => setMinProfit(snap(Number(e.target.value), PROFIT_SNAPS))}
              className="w-full"
              aria-label="Minimum profit euros"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:contents">
            <div className="space-y-1">
              <Label className="text-xs">Min buy ($)</Label>
              <Input
                inputMode="decimal"
                value={minBuy}
                onChange={(e) => setMinBuy(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max buy ($)</Label>
              <Input
                inputMode="decimal"
                value={maxBuy}
                onChange={(e) => setMaxBuy(e.target.value)}
                placeholder="no cap"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Confidence</Label>
            <div className="flex flex-wrap gap-1">
              {(["high", "medium", "low"] as Confidence[]).map((c) => (
                <Chip key={c} active={confidence.includes(c)} onClick={() => toggleConfidence(c)}>
                  {titleCase(c)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sort by</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profit_floor_desc">Floor profit (high→low)</SelectItem>
                <SelectItem value="profit_trend_desc">Trend profit (high→low)</SelectItem>
                <SelectItem value="margin_floor_desc">Floor margin (high→low)</SelectItem>
                <SelectItem value="buy_asc">Buy (low→high)</SelectItem>
                <SelectItem value="buy_desc">Buy (high→low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeTrendOnly}
                onChange={(e) => setIncludeTrendOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Include trend-based deals
              <span title="Optimistic plays where Cardmarket trend says profit but lowest listings don't agree.">
                <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showWarnings}
                onChange={(e) => setShowWarnings(e.target.checked)}
                className="h-4 w-4"
              />
              Show variant warnings
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            className="md:hidden"
            onClick={() => setFiltersOpen(false)}
          >
            Done
          </Button>
        </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {dealsQuery.isLoading
          ? "Loading…"
          : `Showing ${deals.length} deal${deals.length === 1 ? "" : "s"}`}
        {!includeTrendOnly && !dealsQuery.isLoading && (
          <span className="ml-2 text-muted-foreground/80">
            · floor-positive only
          </span>
        )}
      </p>

      {dealsQuery.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load deals: {(dealsQuery.error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {!dealsQuery.isLoading && deals.length === 0 && !dealsQuery.error && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No deals match these filters.
            </CardContent>
          </Card>
        )}
        {deals.map((deal) => (
          <DealRow
            key={deal.card_id}
            deal={deal}
            onOpen={() => setOpenDeal(deal)}
            onShowProvenance={() => showProvenance(deal)}
          />
        ))}
      </div>

      <DealDetailDialog
        deal={openDeal}
        onClose={() => setOpenDeal(null)}
        onShowProvenance={showProvenance}
      />
      <ProvenanceDialog
        cardId={provenanceCardId}
        title={provenanceTitle}
        onClose={() => setProvenanceCardId(null)}
      />
    </div>
  );
}

function TransparencyBanner() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.sessionStorage.getItem(TRANSPARENCY_BANNER_KEY);
    setHidden(dismissed === "1");
  }, []);
  if (hidden) return null;
  function dismiss() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(TRANSPARENCY_BANNER_KEY, "1");
    }
    setHidden(true);
  }
  return (
    <div className="relative rounded-md border border-blue-200 bg-blue-50 px-4 py-3 pr-9 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
      <p className="flex items-center gap-1.5 font-semibold">
        <Info className="h-3.5 w-3.5 shrink-0" />
        How we calculate deals
      </p>
      <p className="mt-1 leading-relaxed">
        US prices come from TCGplayer&apos;s daily algorithmic &ldquo;market price&rdquo;
        (not verified sales). EU prices come from Cardmarket&apos;s &ldquo;Price Trend&rdquo;
        and lowest listing. Click any price to see the source.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-blue-900/70 hover:bg-blue-100 dark:text-blue-100/70 dark:hover:bg-blue-900/40"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    low: "bg-muted text-muted-foreground border-border",
  };
  const tip = "high = 1-2 variants on each side, medium = some spread, low = many variants, verify manually.";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[confidence],
      )}
      title={tip}
    >
      {confidence}
    </span>
  );
}

function priceQualityCopy(
  q: PriceQuality | null,
  euLow: number,
  euTrend: number,
): { kind: "none" | "trend" | "us" | "trend_only"; text: string } {
  if (q === "trend_above_listings") {
    const ratio = euLow > 0 ? euTrend / euLow : null;
    const ratioText = ratio !== null ? `${ratio.toFixed(1)}× the lowest listing` : "above the lowest listing";
    return { kind: "trend", text: `EU trend is ${ratioText} — verify` };
  }
  if (q === "us_market_below_low") {
    return { kind: "us", text: "US market price below lowest listing — TCGplayer may be stale" };
  }
  return { kind: "none", text: "" };
}

function ClickablePrice({
  primary,
  secondary,
  onClick,
  className,
}: {
  primary: string;
  secondary?: string | null;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        "group inline-flex items-baseline gap-1 rounded text-left tabular-nums hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      title="Where this number comes from"
    >
      <span className="font-semibold">{primary}</span>
      <Info className="h-3 w-3 self-center text-muted-foreground/70 group-hover:text-foreground" />
      {secondary && (
        <span className="text-xs font-normal text-muted-foreground">({secondary})</span>
      )}
    </button>
  );
}

function DealRow({
  deal,
  onOpen,
  onShowProvenance,
}: {
  deal: Deal;
  onOpen: () => void;
  onShowProvenance: () => void;
}) {
  const buyUsd = num(deal.us_buy_usd);
  const buyEur = deal.us_buy_eur != null ? num(deal.us_buy_eur) : null;

  const euLow = deal.eu_low_min != null ? num(deal.eu_low_min) : 0;
  const euTrend = num(deal.eu_sell_eur);
  const hasEuLow = euLow > 0;

  const profitFloor =
    deal.profit_at_eu_low_eur != null ? num(deal.profit_at_eu_low_eur) : null;
  const marginFloor =
    deal.margin_pct_at_eu_low != null ? num(deal.margin_pct_at_eu_low) : null;
  const profitTrend = num(deal.profit_eur);
  const marginTrend = num(deal.margin_pct);

  const showBoth =
    deal.price_quality === "trend_above_listings" ||
    (hasEuLow && euTrend > 0 && euTrend / Math.max(euLow, 0.01) > 1.5);
  const flag = priceQualityCopy(deal.price_quality, euLow, euTrend);

  const ebayCount = deal.ebay_active_count != null ? num(deal.ebay_active_count) : 0;
  const ebayBest = deal.ebay_best_total_usd != null ? num(deal.ebay_best_total_usd) : null;
  const ebayUrl = deal.ebay_best_listing_url;
  const hasEbay = ebayCount > 0 && !!ebayUrl;

  const headlineProfit = profitFloor != null ? profitFloor : profitTrend;
  const isFloorPositive = profitFloor != null && profitFloor > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background/80 text-muted-foreground opacity-70 backdrop-blur transition-opacity group-hover:opacity-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </span>

      <div className="flex flex-col gap-3 p-3 sm:flex-row">
        <div className="shrink-0">
          <CardImage src={deal.image_url} alt="" width={60} height={84} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="pr-7">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{deal.name}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <span>{gameLabel(deal.game)}</span>
              <span>·</span>
              <span>{deal.is_sealed ? "Sealed" : "Single"}</span>
              {deal.set_name && (
                <>
                  <span>·</span>
                  <span className="truncate">{deal.set_name}</span>
                </>
              )}
              <ConfidenceBadge confidence={deal.match_confidence} />
              {deal.variant_spread_warning && (
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-500"
                  aria-label="Variant spread warning"
                />
              )}
            </p>
          </div>

          <div className="border-t pt-2">
            <p className="flex items-baseline gap-x-2 text-sm">
              <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                US
              </span>
              <ClickablePrice
                primary={formatCurrency(buyUsd, "USD")}
                secondary={buyEur != null ? formatCurrency(buyEur, "EUR") : null}
                onClick={onShowProvenance}
              />
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="w-6 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                EU
              </span>
              {hasEuLow && (
                <ClickablePrice
                  primary={formatCurrency(euLow, "EUR")}
                  onClick={onShowProvenance}
                />
              )}
              {hasEuLow && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  floor
                </span>
              )}
              {showBoth && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <ClickablePrice
                    primary={formatCurrency(euTrend, "EUR")}
                    onClick={onShowProvenance}
                    className="text-muted-foreground"
                  />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    trend
                  </span>
                </>
              )}
              {!hasEuLow && (
                <ClickablePrice
                  primary={formatCurrency(euTrend, "EUR")}
                  onClick={onShowProvenance}
                />
              )}
            </p>
          </div>

          <div className="border-t pt-2">
            {showBoth && profitFloor != null ? (
              <div className="space-y-0.5">
                <ProfitLine
                  label="Profit at floor"
                  value={profitFloor}
                  marginPct={marginFloor}
                  emphasis
                />
                <ProfitLine
                  label="Profit at trend"
                  value={profitTrend}
                  marginPct={marginTrend}
                  emphasis={false}
                  muted
                />
              </div>
            ) : (
              <ProfitLine
                label={isFloorPositive ? "Profit" : "Trend profit"}
                value={headlineProfit}
                marginPct={isFloorPositive ? marginFloor : marginTrend}
                emphasis
              />
            )}
            {flag.kind === "trend" && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Flag className="h-3 w-3" />
                {flag.text}
              </p>
            )}
            {flag.kind === "us" && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3" />
                {flag.text}
              </p>
            )}
            {!isFloorPositive && profitFloor != null && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <Flag className="h-3 w-3" />
                Speculative — depends on EU trend holding
              </p>
            )}
          </div>

          {hasEbay ? (
            <a
              href={ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="-mx-3 -mb-3 mt-1 flex items-center gap-1.5 border-t bg-muted/30 px-3 py-2 text-xs hover:bg-muted/60"
            >
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                <span className="font-semibold">{ebayCount}</span> eBay listing{ebayCount === 1 ? "" : "s"}
                {ebayBest != null && (
                  <>
                    {" "}· best{" "}
                    <span className="font-semibold">{formatCurrency(ebayBest, "USD")}</span>
                  </>
                )}
              </span>
              <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <div className="-mx-3 -mb-3 mt-1 flex items-center gap-1.5 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span>No eBay data yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfitLine({
  label,
  value,
  marginPct,
  emphasis,
  muted,
}: {
  label: string;
  value: number | null;
  marginPct: number | null;
  emphasis: boolean;
  muted?: boolean;
}) {
  const positive = value != null && value >= 0;
  const colorClass = muted
    ? "text-muted-foreground"
    : positive
      ? "text-emerald-600 dark:text-emerald-500"
      : "text-destructive";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          colorClass,
          emphasis ? "text-base font-bold" : "text-sm font-semibold",
        )}
      >
        {value == null
          ? "—"
          : `${value >= 0 ? "+" : ""}${formatCurrency(value, "EUR")}`}
      </span>
      {marginPct != null && (
        <span className={cn("text-xs tabular-nums", colorClass)}>
          ({marginPct >= 0 ? "+" : ""}
          {marginPct.toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

function formatStrikeUsd(value: number): string {
  return formatCurrency(value, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function DealDetailDialog({
  deal,
  onClose,
  onShowProvenance,
}: {
  deal: Deal | null;
  onClose: () => void;
  onShowProvenance: (deal: Deal) => void;
}) {
  const open = deal !== null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-xl focus:outline-none">
          {deal && <DealDetailContent deal={deal} onShowProvenance={() => onShowProvenance(deal)} />}
          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DealDetailContent({
  deal,
  onShowProvenance,
}: {
  deal: Deal;
  onShowProvenance: () => void;
}) {
  const buyUsd = num(deal.us_buy_usd);
  const sellEur = num(deal.eu_sell_eur);
  const euLow = deal.eu_low_min != null ? num(deal.eu_low_min) : 0;
  const floorEur = num(deal.floor_eur);
  const profitFloor = deal.profit_at_eu_low_eur != null ? num(deal.profit_at_eu_low_eur) : null;
  const profitTrend = num(deal.profit_eur);
  const marginFloor =
    deal.margin_pct_at_eu_low != null ? num(deal.margin_pct_at_eu_low) : null;
  const marginTrend = num(deal.margin_pct);

  const tcgUrl = `https://www.tcgplayer.com/search/all/product?productLineName=&q=${encodeURIComponent(deal.name)}`;
  const cmUrl = `https://www.cardmarket.com/en/${deal.game === "one_piece" ? "OnePiece" : "Pokemon"}/Products/Search?searchString=${encodeURIComponent(deal.name)}`;

  const inventoryHref = `/inventory/new?card_id=${encodeURIComponent(deal.card_id)}&buy_cost_local=${buyUsd}&buy_currency=USD&listed_price=${num(deal.eu_market_min)}&sell_currency=EUR`;

  const captured = deal.us_captured_at && deal.eu_captured_at
    ? new Date(deal.us_captured_at) > new Date(deal.eu_captured_at)
      ? deal.eu_captured_at
      : deal.us_captured_at
    : (deal.us_captured_at || deal.eu_captured_at);

  return (
    <div className="space-y-4">
      <Dialog.Title className="text-lg font-bold tracking-tight pr-8">
        {deal.name}
      </Dialog.Title>
      <Dialog.Description className="sr-only">Deal details</Dialog.Description>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0">
          <ZoomableCardImage src={deal.image_url} alt={deal.name} width={200} height={280} />
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Meta label="Game" value={titleCase(deal.game)} />
            <Meta label="Type" value={deal.is_sealed ? "Sealed" : "Single"} />
            {deal.set_code && <Meta label="Set" value={deal.set_code} />}
            {deal.card_number && <Meta label="Number" value={deal.card_number} />}
            {deal.rarity && <Meta label="Rarity" value={deal.rarity} />}
            <Meta
              label="Confidence"
              value={<ConfidenceBadge confidence={deal.match_confidence} />}
            />
          </dl>
          {deal.variant_spread_warning && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              EU price spread is wide; verify which variant the EU listing represents before buying.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Profit comparison
          </p>
          <button
            type="button"
            onClick={onShowProvenance}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            View source data →
          </button>
        </div>
        <dl className="space-y-1 text-sm">
          <ProfitDtRow
            label="At floor (EU lowest listing)"
            value={profitFloor}
            marginPct={marginFloor}
            emphasis
          />
          <ProfitDtRow
            label="At trend (Cardmarket Price Trend)"
            value={profitTrend}
            marginPct={marginTrend}
            emphasis={false}
          />
        </dl>
        {deal.price_quality === "trend_above_listings" && euLow > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Flag className="mt-0.5 h-3 w-3 shrink-0" />
            Cardmarket trend ({formatCurrency(sellEur, "EUR")}) is{" "}
            {(sellEur / euLow).toFixed(1)}× the lowest listing ({formatCurrency(euLow, "EUR")}).
            The floor number is the realistic worst case; the trend is upside that depends on
            recent-sales history holding.
          </p>
        )}
        {deal.price_quality === "us_market_below_low" && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            US market price is below the lowest listing — TCGplayer&apos;s aggregate may be stale.
          </p>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Price ladder
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold">US (USD)</p>
            <PriceLadder
              min={num(deal.us_market_min)}
              avg={num(deal.us_market_avg)}
              max={num(deal.us_market_max)}
              currency="USD"
            />
          </div>
          <div>
            <p className="text-xs font-semibold">EU (EUR)</p>
            <PriceLadder
              min={euLow > 0 ? euLow : num(deal.eu_market_min)}
              avg={num(deal.eu_market_avg)}
              max={num(deal.eu_market_max)}
              currency="EUR"
            />
          </div>
        </div>
      </div>

      {deal.us_variant_count > 1 && deal.us_variants && deal.us_variants.length > 0 && (
        <Chips label={`US variants (${deal.us_variant_count})`} items={deal.us_variants} />
      )}
      {deal.eu_variant_count > 1 && deal.eu_languages && deal.eu_languages.length > 0 && (
        <Chips label={`EU languages (${deal.eu_variant_count})`} items={deal.eu_languages} />
      )}

      <StrikeTable deal={deal} />

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Floor breakdown
        </p>
        <p className="font-mono text-xs">
          ({formatCurrency(buyUsd, "USD")} buy + travel) × FX × (1 + margins) ={" "}
          <span className="font-semibold">{formatCurrency(floorEur, "EUR")}</span> floor
        </p>
        {profitFloor != null && (
          <p className="mt-2 text-sm">
            Sell at {formatCurrency(euLow > 0 ? euLow : sellEur, "EUR")} → profit{" "}
            <span
              className={cn(
                "font-semibold",
                profitFloor >= 0
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-destructive",
              )}
            >
              {profitFloor >= 0 ? "+" : ""}
              {formatCurrency(profitFloor, "EUR")}
            </span>
            {marginFloor != null && (
              <>
                {" "}
                ({marginFloor.toFixed(1)}%)
              </>
            )}
          </p>
        )}
      </div>

      <EbayListingsSection cardId={deal.card_id} />

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={inventoryHref}>Add to inventory</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onShowProvenance}>
          <Info className="mr-1 h-3.5 w-3.5" />
          Source data
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={tcgUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            TCGplayer
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={cmUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Cardmarket
          </a>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Updated {formatRelative(captured)}</p>
    </div>
  );
}

function StrikeTable({ deal }: { deal: Deal }) {
  const floor = deal.strike_at_eu_low_usd;
  const conservative = deal.strike_conservative_usd;
  const realistic = deal.strike_realistic_usd;
  const aggressive = deal.strike_aggressive_usd;
  if (floor == null && conservative == null && realistic == null && aggressive == null) return null;
  return (
    <div className="rounded-md border bg-amber-50/40 p-3 dark:bg-amber-950/20">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Price strike (max USD to pay)
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <StrikeRow label="Floor" sub="EU lowest listing" value={floor} highlight />
        <StrikeRow label="Conservative" sub="EU trend min" value={conservative} />
        <StrikeRow label="Realistic" sub="EU trend avg" value={realistic} />
        <StrikeRow label="Aggressive" sub="EU trend max" value={aggressive} />
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Floor is the safe one — it&apos;s based on the lowest active listing, not an algorithmic
        average that can be inflated by outliers.
      </p>
    </div>
  );
}

function StrikeRow({
  label,
  sub,
  value,
  highlight,
}: {
  label: string;
  sub: string;
  value: number | string | null;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0">
      <div>
        <p
          className={cn(
            "text-xs font-medium",
            highlight && "text-amber-700 dark:text-amber-400",
          )}
        >
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      <p
        className={cn(
          "tabular-nums",
          highlight
            ? "text-lg font-extrabold text-amber-600 dark:text-amber-400"
            : "text-base font-bold text-amber-600/80 dark:text-amber-400/80",
        )}
      >
        {value != null ? formatStrikeUsd(num(value)) : "—"}
      </p>
    </div>
  );
}

function ProfitDtRow({
  label,
  value,
  marginPct,
  emphasis,
}: {
  label: string;
  value: number | null;
  marginPct: number | null;
  emphasis: boolean;
}) {
  const positive = value != null && value >= 0;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {value != null ? (
          <span
            className={cn(
              positive
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-destructive",
              emphasis ? "text-base font-bold" : "text-sm font-semibold",
            )}
          >
            {positive ? "+" : ""}
            {formatCurrency(value, "EUR")}
          </span>
        ) : (
          "—"
        )}
        {marginPct != null && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({marginPct >= 0 ? "+" : ""}
            {marginPct.toFixed(1)}%)
          </span>
        )}
      </span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function PriceLadder({
  min,
  avg,
  max,
  currency,
}: {
  min: number;
  avg: number;
  max: number;
  currency: "USD" | "EUR";
}) {
  return (
    <dl className="mt-1 grid grid-cols-3 gap-1 text-xs">
      <div>
        <dt className="text-[10px] text-muted-foreground">Min</dt>
        <dd className="tabular-nums">{formatCurrency(min, currency)}</dd>
      </div>
      <div>
        <dt className="text-[10px] text-muted-foreground">Avg</dt>
        <dd className="tabular-nums">{formatCurrency(avg, currency)}</dd>
      </div>
      <div>
        <dt className="text-[10px] text-muted-foreground">Max</dt>
        <dd className="tabular-nums">{formatCurrency(max, currency)}</dd>
      </div>
    </dl>
  );
}

function EbayListingsSection({ cardId }: { cardId: string }) {
  const listingsQuery = useQuery<EbayListing[]>({
    queryKey: ["ebay_listings", cardId],
    queryFn: async () => {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const { data, error } = (await supabase
        .from("ebay_listings" as never)
        .select(
          "title, price_usd, shipping_usd, total_usd, condition, seller_username, seller_feedback_pct, item_url, is_auction",
        )
        .eq("card_id" as never, cardId as never)
        .gt("expires_at" as never, nowIso as never)
        .gt("total_usd" as never, 0 as never)
        .order("total_usd", { ascending: true })
        .limit(5)) as unknown as {
        data: EbayListing[] | null;
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (listingsQuery.isLoading) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Loading eBay listings…
      </div>
    );
  }

  const listings = listingsQuery.data ?? [];
  if (listings.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <ShoppingCart className="h-3.5 w-3.5" />
        Active eBay listings
      </p>
      <ul className="space-y-2">
        {listings.map((listing, i) => (
          <li key={`${listing.item_url}-${i}`} className="text-xs">
            <a
              href={listing.item_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-baseline gap-2 hover:underline"
            >
              <span className="w-20 shrink-0 font-semibold tabular-nums">
                {formatCurrency(num(listing.total_usd), "USD")}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {listing.title}
                {listing.is_auction ? (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    auction
                  </span>
                ) : null}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
            {listing.seller_username && (
              <p className="ml-[88px] text-[10px] text-muted-foreground">
                Sold by {listing.seller_username}
                {listing.seller_feedback_pct != null && (
                  <> · ★{num(listing.seller_feedback_pct).toFixed(1)}%</>
                )}
                {listing.condition && <> · {listing.condition}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          eBay search may include related products (single packs, hangers, ETBs). Verify the
          exact SKU before purchasing.
        </span>
      </p>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="rounded-full border bg-muted px-2 py-0.5 text-xs"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProvenanceDialog({
  cardId,
  title,
  onClose,
}: {
  cardId: string | null;
  title: string;
  onClose: () => void;
}) {
  const open = cardId !== null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="text-lg font-bold tracking-tight pr-8">
            Where this number comes from
          </Dialog.Title>
          <Dialog.Description className="text-xs text-muted-foreground">
            {title}
          </Dialog.Description>
          {cardId && <ProvenanceContent cardId={cardId} />}
          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProvenanceContent({ cardId }: { cardId: string }) {
  const provenanceQuery = useQuery<ProvenanceRow[]>({
    queryKey: ["card_price_provenance", cardId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = (await supabase.rpc(
        "card_price_provenance" as never,
        { p_card_id: cardId } as never,
      )) as unknown as { data: ProvenanceRow[] | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  if (provenanceQuery.isLoading) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">Loading source data…</p>
    );
  }

  if (provenanceQuery.error) {
    return (
      <p className="mt-4 text-sm text-destructive">
        Failed to load source data: {(provenanceQuery.error as Error).message}
      </p>
    );
  }

  const rows = provenanceQuery.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">No source data available for this card.</p>
    );
  }

  const grouped = new Map<string, ProvenanceRow[]>();
  for (const row of rows) {
    const key = row.source;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  return (
    <div className="mt-4 space-y-3">
      {[...grouped.entries()].map(([source, srows]) => (
        <ProvenanceSourceCard key={source} source={source} rows={srows} />
      ))}
    </div>
  );
}

function ProvenanceSourceCard({ source, rows }: { source: string; rows: ProvenanceRow[] }) {
  const isCm = source.toLowerCase().includes("cardmarket");
  const isTcg = source.toLowerCase().includes("tcgplayer");
  const region = isCm ? "EU" : isTcg ? "US" : "";
  const heading = `${source.toUpperCase()}${region ? ` (${region}` : ""}${rows[0]?.currency ? `${region ? ", " : " ("}${rows[0].currency})` : region ? ")" : ""}`;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide">{heading}</p>
      <div className="mt-2 space-y-3">
        {rows.map((row, i) => (
          <ProvenanceVariant key={i} row={row} />
        ))}
      </div>
      {isTcg && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          TCGplayer&apos;s &ldquo;market price&rdquo; is an algorithmic aggregate, not a verified
          sale.
        </p>
      )}
      {isCm && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Cardmarket&apos;s &ldquo;Price Trend&rdquo; is a proprietary recent-sales aggregate. Can
          be inflated by outlier sales. Lowest listing is the most reliable &ldquo;buy now&rdquo;
          price.
        </p>
      )}
    </div>
  );
}

function ProvenanceVariant({ row }: { row: ProvenanceRow }) {
  const currency = row.currency || "USD";
  const isCm = row.source.toLowerCase().includes("cardmarket");
  const variantLabel = [row.variant_name, row.language, row.is_foil ? "Foil" : null]
    .filter(Boolean)
    .join(" · ");

  const usedRowLabel = isCm ? "Trend (used)" : "Market (used)";

  type Field = { label: string; value: number | string | null; highlight?: "used" | "buy" };
  const fields: Field[] = isCm
    ? [
        { label: "Lowest listing", value: row.price_low, highlight: "buy" },
        { label: "Mid (lifetime avg)", value: row.price_mid },
        { label: usedRowLabel, value: row.price_market, highlight: "used" },
        { label: "30-day avg", value: row.cm_avg30 },
        { label: "7-day avg", value: row.cm_avg7 },
      ]
    : [
        { label: "Lowest listed", value: row.price_low },
        { label: "Mid", value: row.price_mid },
        { label: usedRowLabel, value: row.price_market, highlight: "used" },
        { label: "High", value: row.price_high },
      ];

  return (
    <div className="space-y-1.5 rounded-md border bg-background/50 p-2">
      {variantLabel && (
        <p className="text-[11px] font-medium text-muted-foreground">{variantLabel}</p>
      )}
      <dl className="space-y-0.5 text-xs">
        {fields.map((f) => {
          const v = f.value != null ? num(f.value) : null;
          if (v == null || v === 0) return null;
          return (
            <div key={f.label} className="flex items-baseline justify-between gap-2">
              <dt className={cn("text-muted-foreground", f.highlight && "text-foreground")}>
                {f.label}
              </dt>
              <dd
                className={cn(
                  "tabular-nums",
                  f.highlight === "used" && "font-bold text-foreground",
                  f.highlight === "buy" && "font-semibold text-emerald-600 dark:text-emerald-500",
                )}
              >
                {formatCurrency(v, currency)}
                {f.highlight === "used" && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ← what we display
                  </span>
                )}
                {f.highlight === "buy" && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ← buy now floor
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[10px] text-muted-foreground">
        Captured: {formatDateTime(row.captured_at)}
      </p>
      {row.source_url && (
        <a
          href={row.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View on {titleCase(row.source.replace(/_/g, " "))}
        </a>
      )}
      {row.notes && (
        <p className="text-[10px] italic text-muted-foreground">{row.notes}</p>
      )}
    </div>
  );
}

type EvalResult = {
  floorEur: number;
  euMin: number | null;
  euAvg: number | null;
  profit: number | null;
  breakeven: number;
  buyUsd: number;
  strikeConservative: number | null;
  strikeRealistic: number | null;
};

function QuickEvaluator() {
  const [picked, setPicked] = useState<CardHit | null>(null);
  const [buyUsd, setBuyUsd] = useState("");
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settings = useQuery({
    queryKey: ["evaluator-settings"],
    queryFn: async () => {
      const supabase = createClient();
      const [s, fx] = await Promise.all([
        supabase
          .from("settings")
          .select("key, value")
          .in("key", ["margin_cd_default", "margin_pp_default", "default_travel_per_card_usd"]),
        supabase
          .from("fx_rates")
          .select("rate")
          .eq("base_ccy", "USD")
          .eq("quote_ccy", "EUR")
          .order("rate_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (s.error) throw s.error;
      const map = new Map<string, number>();
      for (const row of s.data ?? []) {
        const v = (row as { key: string; value: unknown }).value;
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isNaN(n)) map.set((row as { key: string }).key, n);
      }
      const fxRate = fx.data?.rate ? num(fx.data.rate) : null;
      return {
        cdMargin: map.get("margin_cd_default") ?? 0.2,
        ppMargin: map.get("margin_pp_default") ?? 0.1,
        travelUsd: map.get("default_travel_per_card_usd") ?? 5,
        fxUsdEur: fxRate,
      };
    },
  });

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!picked) {
      setError("Pick a card first.");
      return;
    }
    const buy = Number(buyUsd);
    if (!buyUsd || Number.isNaN(buy) || buy <= 0) {
      setError("Enter a valid USD buy price.");
      return;
    }
    if (!settings.data) {
      setError("Settings not loaded yet — try again in a moment.");
      return;
    }
    if (!settings.data.fxUsdEur) {
      setError("No USD→EUR FX rate available.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: euRows, error: euErr } = (await supabase
        .from("latest_eu_prices" as never)
        .select("eu_market_min, eu_market_avg")
        .eq("card_group_id" as never, picked.id as never)) as unknown as {
        data: { eu_market_min: number | string | null; eu_market_avg: number | string | null }[] | null;
        error: { message: string } | null;
      };
      if (euErr) throw new Error(euErr.message);
      let euMin: number | null = null;
      let euAvg: number | null = null;
      for (const row of euRows ?? []) {
        const v = num(row.eu_market_min);
        if (v > 0 && (euMin === null || v < euMin)) euMin = v;
        const a = num(row.eu_market_avg);
        if (a > 0 && (euAvg === null || a < euAvg)) euAvg = a;
      }
      const { cdMargin, ppMargin, travelUsd, fxUsdEur } = settings.data;
      const floorEur = (buy + travelUsd) * fxUsdEur * (1 + cdMargin + ppMargin);
      const profit = euMin !== null ? euMin - floorEur : null;
      const denom = fxUsdEur * (1 + cdMargin + ppMargin);
      const strikeConservative =
        euMin !== null && denom > 0 ? euMin / denom - travelUsd : null;
      const strikeRealistic =
        euAvg !== null && denom > 0 ? euAvg / denom - travelUsd : null;
      setResult({
        floorEur,
        euMin,
        euAvg,
        profit,
        breakeven: floorEur,
        buyUsd: buy,
        strikeConservative,
        strikeRealistic,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">Evaluate a candidate</p>
          <p className="text-xs text-muted-foreground">
            Paste a card and the price you&apos;re being offered. We&apos;ll compare it against the latest EU minimum.
          </p>
        </div>
        <form onSubmit={handleEvaluate} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <div>
            {picked ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="truncate text-sm">
                  {picked.name}
                  {picked.set_code ? (
                    <span className="ml-1 text-xs text-muted-foreground">{picked.set_code}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setResult(null);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <CardSearchInput onSelect={setPicked} placeholder="Search card…" />
            )}
          </div>
          <Input
            inputMode="decimal"
            value={buyUsd}
            onChange={(e) => setBuyUsd(e.target.value)}
            placeholder="USD buy"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "…" : "Evaluate"}
          </Button>
        </form>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {result && <EvaluatorResult result={result} />}
      </CardContent>
    </Card>
  );
}

function EvaluatorResult({ result }: { result: EvalResult }) {
  const { strikeConservative, strikeRealistic, buyUsd, profit, euMin } = result;
  const passes = strikeConservative !== null && buyUsd <= strikeConservative;
  const headroom =
    strikeConservative !== null ? strikeConservative - buyUsd : null;

  let verdict: { ok: boolean; text: string } | null = null;
  if (strikeConservative === null) {
    verdict = null;
  } else if (passes) {
    const profitText =
      profit !== null && profit >= 0 ? ` — profit ~${formatCurrency(profit, "EUR")} at EU min` : "";
    verdict = {
      ok: true,
      text: `PROFITABLE — ${formatStrikeUsd(headroom ?? 0)} below strike${profitText}`,
    };
  } else {
    const over = buyUsd - strikeConservative;
    verdict = {
      ok: false,
      text: `PASS — ${formatStrikeUsd(over)} above strike`,
    };
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Strike (conservative)
          </p>
          <p className="tabular-nums font-bold text-amber-600 dark:text-amber-400">
            {strikeConservative !== null ? formatStrikeUsd(strikeConservative) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">buy up to this</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Strike (realistic)
          </p>
          <p className="tabular-nums font-medium">
            {strikeRealistic !== null ? formatStrikeUsd(strikeRealistic) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">EU min</p>
          <p className="tabular-nums font-medium">
            {euMin === null ? "—" : formatCurrency(euMin, "EUR")}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Asking is {formatStrikeUsd(buyUsd)}.
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          verdict === null
            ? "text-muted-foreground"
            : verdict.ok
              ? "text-emerald-600 dark:text-emerald-500"
              : "text-destructive",
        )}
      >
        {verdict === null
          ? "No EU price on file — can't compare."
          : `${verdict.ok ? "✅" : "❌"} ${verdict.text}`}
      </p>
    </div>
  );
}
