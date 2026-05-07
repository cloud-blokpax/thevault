"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Star, Target, X } from "lucide-react";
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
import { CardSearchInput, type CardHit } from "@/components/card-search-input";
import { cn, formatCurrency, titleCase } from "@/lib/utils";
import {
  type BuyCategory,
  type Deal,
  type DealConfidence,
  POTENTIAL_DEALS_SELECT,
  num,
} from "@/lib/deals";

export const runtime = "edge";

type Confidence = DealConfidence;

type GameFilter = "all" | "pokemon" | "one_piece";
type TypeFilter = "all" | "sealed" | "singles";
type SortKey =
  | "profit_desc"
  | "margin_desc"
  | "buy_asc"
  | "buy_desc"
  | "profit_aggressive_desc";


const PROFIT_SNAPS = [0, 5, 25, 100, 500];
const MARGIN_SNAPS = [0, 10, 20, 30, 50, 100, 200, 500];

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
        sort: "profit_desc",
        confidence: ["high", "medium", "low"],
      };
    case "sealed-other":
      return {
        type: "sealed",
        minMargin: 0,
        minBuy: "",
        maxBuy: "200",
        showWarnings: false,
        sort: "profit_desc",
        confidence: ["high", "medium", "low"],
      };
    case "premium-singles":
      return {
        type: "singles",
        minMargin: 0,
        minBuy: "50",
        maxBuy: "",
        showWarnings: false,
        sort: "profit_desc",
        confidence: ["high", "medium", "low"],
      };
    case "microflips":
      return {
        type: "singles",
        minMargin: 30,
        minBuy: "",
        maxBuy: "50",
        showWarnings: false,
        sort: "margin_desc",
        confidence: ["high", "medium", "low"],
      };
    case "verify":
      return {
        type: "all",
        minMargin: 0,
        minBuy: "",
        maxBuy: "",
        showWarnings: true,
        sort: "profit_aggressive_desc",
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
        sort: "profit_desc",
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
      sort,
    }),
    [game, type, minMargin, minProfit, debouncedMinBuy, debouncedMaxBuy, confidence, showWarnings, sort],
  );

  const dealsQuery = useQuery<Deal[]>({
    queryKey: ["potential_deals", filterKey],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("potential_deals" as never)
        .select(POTENTIAL_DEALS_SELECT)
        .gt("profit_eur", 0)
        .limit(50);

      if (!showWarnings) q = q.eq("variant_spread_warning", false);
      if (game !== "all") q = q.eq("game", game);
      if (type === "sealed") q = q.eq("is_sealed", true);
      if (type === "singles") q = q.eq("is_sealed", false);
      if (minMargin > 0) q = q.gte("margin_pct", minMargin);
      if (minProfit > 0) q = q.gte("profit_eur", minProfit);
      const minB = Number(debouncedMinBuy);
      if (debouncedMinBuy && !Number.isNaN(minB) && minB > 0) q = q.gte("us_buy_usd", minB);
      const maxB = Number(debouncedMaxBuy);
      if (debouncedMaxBuy && !Number.isNaN(maxB) && maxB > 0) q = q.lte("us_buy_usd", maxB);
      if (confidence.length > 0 && confidence.length < 3) {
        q = q.in("match_confidence", confidence);
      }
      switch (sort) {
        case "margin_desc":
          q = q.order("margin_pct", { ascending: false });
          break;
        case "buy_asc":
          q = q.order("us_buy_usd", { ascending: true });
          break;
        case "buy_desc":
          q = q.order("us_buy_usd", { ascending: false });
          break;
        case "profit_aggressive_desc":
          q = q.order("profit_aggressive_eur", { ascending: false });
          break;
        default:
          q = q.order("profit_eur", { ascending: false });
      }

      const { data, error } = (await q) as unknown as { data: Deal[] | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const [openDeal, setOpenDeal] = useState<Deal | null>(null);

  const deals = dealsQuery.data ?? [];

  function toggleConfidence(c: Confidence) {
    setConfidence((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
        <p className="text-sm text-muted-foreground">
          US→EU arbitrage opportunities, refreshed nightly. Profit estimates apply your default margins, travel, and FX.
        </p>
      </div>

      <QuickEvaluator />

      <div className="sticky top-12 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:top-0 md:mx-0 md:rounded-lg md:border md:px-4">
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
                <SelectItem value="profit_desc">Profit (high→low)</SelectItem>
                <SelectItem value="profit_aggressive_desc">Aggressive profit</SelectItem>
                <SelectItem value="margin_desc">Margin (high→low)</SelectItem>
                <SelectItem value="buy_asc">Buy (low→high)</SelectItem>
                <SelectItem value="buy_desc">Buy (high→low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
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
      </div>

      <p className="text-xs text-muted-foreground">
        {dealsQuery.isLoading
          ? "Loading…"
          : `Showing ${deals.length} deal${deals.length === 1 ? "" : "s"}`}
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
          <DealRow key={deal.card_id} deal={deal} onOpen={() => setOpenDeal(deal)} />
        ))}
      </div>

      <DealDetailDialog deal={openDeal} onClose={() => setOpenDeal(null)} />
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

function MarginStars({ marginPct }: { marginPct: number }) {
  if (marginPct >= 100) {
    return (
      <span className="text-amber-500" title="100%+ margin">
        <Star className="inline h-3.5 w-3.5 fill-current" />
        <Star className="inline h-3.5 w-3.5 fill-current" />
      </span>
    );
  }
  if (marginPct >= 30) {
    return (
      <span className="text-amber-500" title="30%+ margin">
        <Star className="inline h-3.5 w-3.5 fill-current" />
      </span>
    );
  }
  return null;
}

function DealRow({ deal, onOpen }: { deal: Deal; onOpen: () => void }) {
  const buyUsd = num(deal.us_buy_usd);
  const sellEur = num(deal.eu_sell_eur);
  const profitEur = num(deal.profit_eur);
  const marginPct = num(deal.margin_pct);
  const strikeUsd = deal.strike_conservative_usd != null ? num(deal.strike_conservative_usd) : null;

  const titleParts = [deal.name];
  if (deal.set_code) titleParts.push(deal.set_code);
  const numberSuffix = deal.card_number ? ` (${deal.card_number})` : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-lg border bg-card text-left transition-colors hover:bg-accent/40 active:bg-accent"
    >
      <div className="flex gap-3 p-3">
        <div className="shrink-0">
          {deal.image_url ? (
            <Image
              src={deal.image_url}
              alt=""
              width={80}
              height={112}
              loading="lazy"
              unoptimized
              className="h-[112px] w-20 rounded border bg-muted object-contain"
            />
          ) : (
            <div className="h-[112px] w-20 rounded border bg-muted" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="truncate text-sm font-semibold">
              {titleParts.join(" · ")}
              {numberSuffix}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{titleCase(deal.game)}</span>
              <span>·</span>
              <span>{deal.is_sealed ? "Sealed" : "Single"}</span>
              <span>·</span>
              <span>
                {deal.us_variant_count} US, {deal.eu_variant_count} EU
              </span>
              <ConfidenceBadge confidence={deal.match_confidence} />
              {deal.variant_spread_warning && (
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-500"
                  aria-label="Variant spread warning"
                />
              )}
            </p>
          </div>
          <StrikeLine
            strikeUsd={strikeUsd}
            buyUsd={buyUsd}
            sellEur={sellEur}
            profitEur={profitEur}
            marginPct={marginPct}
          />
        </div>
      </div>
    </button>
  );
}

function StrikeLine({
  strikeUsd,
  buyUsd,
  sellEur,
  profitEur,
  marginPct,
}: {
  strikeUsd: number | null;
  buyUsd: number;
  sellEur: number;
  profitEur: number;
  marginPct: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Buy up to
        </span>
        <span className="text-xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
          {strikeUsd != null ? formatStrikeUsd(strikeUsd) : "—"}
        </span>
        <MarginStars marginPct={marginPct} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        Currently {formatCurrency(buyUsd, "USD")} US → {formatCurrency(sellEur, "EUR")} EU
      </p>
      <p className="text-xs tabular-nums">
        <span className="font-semibold text-emerald-600 dark:text-emerald-500">
          +{formatCurrency(profitEur, "EUR")}
        </span>
        <span className="ml-1 text-muted-foreground">({marginPct.toFixed(1)}%)</span>
      </p>
    </div>
  );
}

function formatStrikeUsd(value: number): string {
  return formatCurrency(value, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function DealDetailDialog({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  const open = deal !== null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-6 shadow-xl focus:outline-none">
          {deal && <DealDetailContent deal={deal} />}
          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DealDetailContent({ deal }: { deal: Deal }) {
  const buyUsd = num(deal.us_buy_usd);
  const sellEur = num(deal.eu_sell_eur);
  const floorEur = num(deal.floor_eur);
  const profitEur = num(deal.profit_eur);
  const marginPct = num(deal.margin_pct);

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
          {deal.image_url ? (
            <Image
              src={deal.image_url}
              alt={deal.name}
              width={200}
              height={280}
              unoptimized
              className="rounded border bg-muted object-contain"
            />
          ) : (
            <div className="h-[280px] w-[200px] rounded border bg-muted" aria-hidden />
          )}
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
              min={num(deal.eu_market_min)}
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

      <ProfitTable deal={deal} />

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Floor breakdown
        </p>
        <p className="font-mono text-xs">
          ({formatCurrency(buyUsd, "USD")} buy + travel) × FX × (1 + margins) ={" "}
          <span className="font-semibold">{formatCurrency(floorEur, "EUR")}</span> floor
        </p>
        <p className="mt-2 text-sm">
          Sell at {formatCurrency(sellEur, "EUR")} → profit{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-500">
            +{formatCurrency(profitEur, "EUR")}
          </span>{" "}
          ({marginPct.toFixed(1)}%)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={inventoryHref}>Add to inventory</Link>
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
  const conservative = deal.strike_conservative_usd;
  const realistic = deal.strike_realistic_usd;
  const aggressive = deal.strike_aggressive_usd;
  if (conservative == null && realistic == null && aggressive == null) return null;
  return (
    <div className="rounded-md border bg-amber-50/40 p-3 dark:bg-amber-950/20">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Price strike (max USD to pay)
      </p>
      <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        <StrikeRow label="Conservative" sub="sell at EU min" value={conservative} />
        <StrikeRow label="Realistic" sub="sell at EU avg" value={realistic} />
        <StrikeRow label="Aggressive" sub="sell at EU max" value={aggressive} />
      </dl>
    </div>
  );
}

function StrikeRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub: string;
  value: number | string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-0">
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
        {value != null ? formatStrikeUsd(num(value)) : "—"}
      </p>
    </div>
  );
}

function ProfitTable({ deal }: { deal: Deal }) {
  const conservative = deal.profit_conservative_eur;
  const realistic = deal.profit_realistic_eur;
  const aggressive = deal.profit_aggressive_eur;
  if (conservative == null && realistic == null && aggressive == null) return null;
  const floor = num(deal.floor_eur);
  function rowMargin(profitVal: number | string | null): string {
    if (profitVal == null || floor <= 0) return "—";
    const p = num(profitVal);
    return `${((p / floor) * 100).toFixed(1)}%`;
  }
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Profit potential (€)
      </p>
      <dl className="space-y-1 text-sm">
        <ProfitRow label="At EU min" value={conservative} marginText={rowMargin(conservative)} />
        <ProfitRow label="At EU avg" value={realistic} marginText={rowMargin(realistic)} />
        <ProfitRow label="At EU max" value={aggressive} marginText={rowMargin(aggressive)} />
      </dl>
    </div>
  );
}

function ProfitRow({
  label,
  value,
  marginText,
}: {
  label: string;
  value: number | string | null;
  marginText: string;
}) {
  const v = value != null ? num(value) : null;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {v != null ? (
          <span
            className={cn(
              "font-semibold",
              v >= 0
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-destructive",
            )}
          >
            {v >= 0 ? "+" : ""}
            {formatCurrency(v, "EUR")}
          </span>
        ) : (
          "—"
        )}
        <span className="ml-2 text-xs text-muted-foreground">{marginText}</span>
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
