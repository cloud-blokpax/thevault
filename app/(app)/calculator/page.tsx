"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import {
  Calculator as CalculatorIcon,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardImage } from "@/components/ui/card-image";
import { CardSearchInput, type CardHit, formatSetLine } from "@/components/card-search-input";
import { type ProvenanceRow, num } from "@/lib/deals";
import { cn, formatCurrency, titleCase } from "@/lib/utils";
import { fxRateOn } from "@/lib/supabase/fx";
import type { Enums } from "@/types/database";

export const runtime = "edge";

const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];

type Breakdown = Record<string, number | string | null>;

type CardPricing = {
  us_low: number | null;
  us_market: number | null;
  us_high: number | null;
  us_currency: string;
  eu_low: number | null;
  eu_market: number | null;
  eu_avg30: number | null;
  eu_currency: string;
};

function summarizePricing(rows: ProvenanceRow[]): CardPricing {
  const us = rows.find((r) => r.source.toLowerCase().includes("tcgplayer"));
  const eu = rows.find((r) => r.source.toLowerCase().includes("cardmarket"));
  return {
    us_low: us?.price_low != null ? num(us.price_low) : null,
    us_market: us?.price_market != null ? num(us.price_market) : null,
    us_high: us?.price_high != null ? num(us.price_high) : null,
    us_currency: us?.currency || "USD",
    eu_low: eu?.price_low != null ? num(eu.price_low) : null,
    eu_market: eu?.price_market != null ? num(eu.price_market) : null,
    eu_avg30: eu?.cm_avg30 != null ? num(eu.cm_avg30) : null,
    eu_currency: eu?.currency || "EUR",
  };
}

function resolveBreakdownCurrency(
  data: Breakdown | undefined,
  fallback: Enums<"currency_code">,
): Enums<"currency_code"> {
  const candidates = [
    typeof data?.sell_currency === "string" ? data.sell_currency : "",
    typeof data?.currency === "string" ? data.currency : "",
  ].map((c) => c.toUpperCase());
  for (const c of candidates) {
    if ((CURRENCIES as readonly string[]).includes(c)) {
      return c as Enums<"currency_code">;
    }
  }
  return fallback;
}

function useHistoricalFx(
  date: string,
  base: Enums<"currency_code">,
  quote: Enums<"currency_code">,
) {
  const enabled =
    !!date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    base !== quote;
  return useQuery({
    queryKey: ["calc-fx", date || "today", base, quote],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      return await fxRateOn(supabase, date, base, quote);
    },
  });
}

function FxHint({
  date,
  base,
  quote,
  fxOverride,
  onResolved,
}: {
  date: string;
  base: Enums<"currency_code">;
  quote: Enums<"currency_code">;
  fxOverride: string;
  onResolved: (rate: number | null) => void;
}) {
  const fx = useHistoricalFx(date, base, quote);

  useEffect(() => {
    if (fxOverride.trim() !== "") {
      onResolved(null);
      return;
    }
    if (!date) {
      onResolved(null);
      return;
    }
    if (fx.data) {
      onResolved(Number(fx.data.rate));
    }
  }, [fx.data, fxOverride, date, onResolved]);

  if (fxOverride.trim() !== "") {
    return (
      <p className="text-[11px] text-muted-foreground">
        FX rate: {Number(fxOverride).toFixed(4)} (manual override)
      </p>
    );
  }
  if (base === quote) {
    return (
      <p className="text-[11px] text-muted-foreground">
        FX rate: 1.0000 (same currency)
      </p>
    );
  }
  if (!date) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Using today&apos;s FX (no date set).
      </p>
    );
  }
  if (fx.isLoading) {
    return <p className="text-[11px] text-muted-foreground">Looking up FX…</p>;
  }
  if (fx.data) {
    const tag = fx.data.is_exact_match
      ? `${fx.data.rate_date} — historical`
      : `${fx.data.rate_date} (${fx.data.days_back}d back) — historical`;
    return (
      <p className="text-[11px] text-muted-foreground">
        FX rate: {Number(fx.data.rate).toFixed(4)} ({tag})
      </p>
    );
  }
  return null;
}

export default function CalculatorPage() {
  const [selected, setSelected] = useState<CardHit | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Look up a card to auto-fill pricing, or use manual mode for scratch math.
        </p>
      </div>

      <Tabs defaultValue="lookup" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="lookup">Card lookup</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <CardSearchInput
                placeholder="Search any card or sealed product…"
                onSelect={(c) => setSelected(c)}
                limit={20}
              />
              {!selected && (
                <p className="px-1 text-xs text-muted-foreground">
                  Pick a card to see US and EU pricing, then auto-calculate floor sell price and
                  max safe buy.
                </p>
              )}
            </CardContent>
          </Card>

          {selected && <CardWorkspace card={selected} onClear={() => setSelected(null)} />}
        </TabsContent>

        <TabsContent value="manual">
          <ManualMode />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CardWorkspace({ card, onClear }: { card: CardHit; onClear: () => void }) {
  const provenance = useQuery<ProvenanceRow[]>({
    queryKey: ["calc.card_price_provenance", card.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = (await supabase.rpc(
        "card_price_provenance" as never,
        { p_card_id: card.id } as never,
      )) as unknown as { data: ProvenanceRow[] | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const pricing = useMemo<CardPricing | null>(
    () => (provenance.data ? summarizePricing(provenance.data) : null),
    [provenance.data],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex gap-4 p-4">
          <CardImage src={card.image_url} alt="" width={80} height={112} fallbackText="" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{card.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    titleCase(card.game === "one_piece" ? "One Piece" : card.game),
                    formatSetLine(card),
                    card.card_number ? `#${card.card_number}` : null,
                    card.rarity,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={onClear}>
                Clear
              </Button>
            </div>

            {provenance.isLoading ? (
              <p className="pt-2 text-xs text-muted-foreground">Loading pricing…</p>
            ) : provenance.error ? (
              <p className="pt-2 text-xs text-destructive">
                Couldn&apos;t load pricing: {(provenance.error as Error).message}
              </p>
            ) : pricing ? (
              <PricingSummary pricing={pricing} />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <FloorPriceForm pricing={pricing} cardId={card.id} />
        <MaxBuyForm pricing={pricing} cardId={card.id} />
      </div>
    </div>
  );
}

function PricingSummary({ pricing }: { pricing: CardPricing }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
      <div className="rounded-md border bg-muted/30 p-2">
        <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
          US (TCGplayer)
        </p>
        <dl className="space-y-0.5">
          <Row label="Lowest" value={pricing.us_low} currency={pricing.us_currency} />
          <Row label="Market" value={pricing.us_market} currency={pricing.us_currency} highlight />
          <Row label="High" value={pricing.us_high} currency={pricing.us_currency} />
        </dl>
      </div>
      <div className="rounded-md border bg-muted/30 p-2">
        <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
          EU (Cardmarket)
        </p>
        <dl className="space-y-0.5">
          <Row label="Lowest" value={pricing.eu_low} currency={pricing.eu_currency} highlight />
          <Row label="Trend" value={pricing.eu_market} currency={pricing.eu_currency} />
          <Row label="30-day avg" value={pricing.eu_avg30} currency={pricing.eu_currency} />
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  highlight,
}: {
  label: string;
  value: number | null;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={highlight ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value != null ? formatCurrency(value, currency) : "—"}
      </dd>
    </div>
  );
}

function FloorPriceForm({
  pricing,
  cardId,
}: {
  pricing?: CardPricing | null;
  cardId?: string;
}) {
  const [buyCost, setBuyCost] = useState("");
  const [buyCcy, setBuyCcy] = useState<Enums<"currency_code">>("USD");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [resolvedFx, setResolvedFx] = useState<number | null>(null);

  const sellCcy: Enums<"currency_code"> = buyCcy === "USD" ? "EUR" : "USD";

  // Auto-fill buy cost from US market when pricing arrives, but only if the
  // user hasn't typed.
  useEffect(() => {
    if (pricing?.us_market != null && buyCost === "") {
      setBuyCost(String(pricing.us_market));
      setBuyCcy("USD");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing?.us_market]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const fxToUse =
        fx.trim() !== ""
          ? Number(fx)
          : resolvedFx != null
            ? resolvedFx
            : undefined;
      const { data, error } = await supabase.rpc("calc_floor_price", {
        p_buy_cost_local: Number(buyCost),
        p_buy_currency: buyCcy,
        p_allocated_travel: travel ? Number(travel) : 0,
        p_fx_rate: fxToUse,
        p_margin_cd: marginCd ? Number(marginCd) : undefined,
        p_margin_pp: marginPp ? Number(marginPp) : undefined,
      });
      if (error) throw error;
      return data as Breakdown;
    },
  });

  // Auto-recalc when the US market price arrives (so the breakdown is filled in).
  useEffect(() => {
    if (buyCost && Number(buyCost) > 0 && !mutation.data && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing?.us_market]);

  const inventoryHref = cardId
    ? `/inventory/new?card_id=${encodeURIComponent(cardId)}&buy_cost_local=${buyCost}&buy_currency=${buyCcy}&sell_currency=EUR`
    : null;

  const buyCostNum = Number(buyCost);
  const showSensitivity = buyCostNum > 0 && !!mutation.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalculatorIcon className="h-4 w-4" />
          Floor sell price
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {pricing?.us_market != null
            ? "Auto-filled with US market price. Edit to model other scenarios."
            : "Enter a buy cost to see the minimum sell price needed to clear margins."}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Buy cost (local)</Label>
            <Input
              inputMode="decimal"
              value={buyCost}
              onChange={(e) => setBuyCost(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buy currency</Label>
            <Select value={buyCcy} onValueChange={(v) => setBuyCcy(v as Enums<"currency_code">)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Purchase date (optional)</Label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
            <FxHint
              date={purchaseDate}
              base={buyCcy}
              quote={sellCcy}
              fxOverride={fx}
              onResolved={setResolvedFx}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Allocated travel</Label>
            <Input
              inputMode="decimal"
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FX rate</Label>
            <Input
              inputMode="decimal"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
              placeholder="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margin C&amp;D</Label>
            <Input
              inputMode="decimal"
              value={marginCd}
              onChange={(e) => setMarginCd(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margin P-to-P</Label>
            <Input
              inputMode="decimal"
              value={marginPp}
              onChange={(e) => setMarginPp(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={mutation.isPending} size="sm">
              <RefreshCw className={`mr-1 h-3 w-3 ${mutation.isPending ? "animate-spin" : ""}`} />
              {mutation.isPending ? "Calculating…" : "Recalculate"}
            </Button>
            {inventoryHref && (
              <Button asChild size="sm" variant="ghost">
                <Link href={inventoryHref}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add to inventory
                </Link>
              </Button>
            )}
          </div>
        </form>

        {mutation.error && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {(mutation.error as Error).message}
          </p>
        )}

        {mutation.data && (
          <ResultBreakdown
            data={mutation.data}
            currency={resolveBreakdownCurrency(mutation.data, sellCcy)}
          />
        )}

        {pricing?.eu_low != null && mutation.data && (
          <ProfitHint
            floor={typeof mutation.data.floor_price === "number" ? mutation.data.floor_price : null}
            euLow={pricing.eu_low}
          />
        )}

        {showSensitivity && (
          <SensitivityPanel
            buyCost={buyCostNum}
            buyCcy={buyCcy}
            travel={travel ? Number(travel) : 0}
            baselineFx={
              typeof mutation.data?.fx_rate === "number" ? mutation.data.fx_rate : undefined
            }
            referencePrice={pricing?.eu_low ?? null}
            referenceCurrency={pricing?.eu_currency ?? "EUR"}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Sensitivity Panel ----------

const MARGIN_PROFILES = [
  { id: "tight", label: "Tight", cd: 0.05, pp: 0.05, total: 0.1 },
  { id: "standard", label: "Standard", cd: 0.1, pp: 0.1, total: 0.2 },
  { id: "conservative", label: "Conservative", cd: 0.2, pp: 0.1, total: 0.3 },
] as const;

const FX_SCENARIOS = [
  { id: "down", label: "FX −3%", multiplier: 0.97 },
  { id: "base", label: "Baseline", multiplier: 1 },
  { id: "up", label: "FX +3%", multiplier: 1.03 },
] as const;

type CellKey = `${(typeof MARGIN_PROFILES)[number]["id"]}-${(typeof FX_SCENARIOS)[number]["id"]}`;

function SensitivityPanel({
  buyCost,
  buyCcy,
  travel,
  baselineFx,
  referencePrice,
  referenceCurrency,
}: {
  buyCost: number;
  buyCcy: Enums<"currency_code">;
  travel: number;
  baselineFx?: number;
  referencePrice: number | null;
  referenceCurrency: string;
}) {
  // Build the 9 cells (3 margin profiles × 3 FX scenarios). React Query
  // batches and caches them keyed off all inputs, so editing any field
  // re-runs only the cells that changed.
  const cells = useMemo(() => {
    const out: Array<{
      key: CellKey;
      margin: (typeof MARGIN_PROFILES)[number];
      fx: (typeof FX_SCENARIOS)[number];
    }> = [];
    for (const margin of MARGIN_PROFILES) {
      for (const fx of FX_SCENARIOS) {
        out.push({ key: `${margin.id}-${fx.id}` as CellKey, margin, fx });
      }
    }
    return out;
  }, []);

  const queries = useQueries({
    queries: cells.map(({ margin, fx }) => ({
      queryKey: [
        "calc.sensitivity",
        buyCost,
        buyCcy,
        travel,
        baselineFx ?? null,
        margin.id,
        fx.id,
      ],
      queryFn: async () => {
        const supabase = createClient();
        const fxRate = baselineFx != null ? baselineFx * fx.multiplier : undefined;
        const { data, error } = await supabase.rpc("calc_floor_price", {
          p_buy_cost_local: buyCost,
          p_buy_currency: buyCcy,
          p_allocated_travel: travel,
          p_fx_rate: fxRate,
          p_margin_cd: margin.cd,
          p_margin_pp: margin.pp,
        });
        if (error) throw error;
        return data as Breakdown;
      },
      staleTime: 30_000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const anyError = queries.find((q) => q.error)?.error as Error | undefined;

  // Pick the canonical sell currency from the first successful cell.
  const sellCurrency = (() => {
    const firstSuccess = queries.find((q) => q.data);
    const ccy = firstSuccess?.data?.sell_currency ?? firstSuccess?.data?.currency;
    return typeof ccy === "string" ? ccy : "EUR";
  })();

  // Identify the standard/baseline cell so we can express others relative to it.
  const baselineIdx = cells.findIndex(
    (c) => c.margin.id === "standard" && c.fx.id === "base",
  );
  const baselineFloor = (() => {
    const v = queries[baselineIdx]?.data?.floor_price;
    return typeof v === "number" ? v : null;
  })();

  // Decide green/red for cells based on whether they survive vs reference EU price.
  // If no reference price, color by headroom against the baseline cell.
  const evaluate = (floor: number | null) => {
    if (floor == null) return { tone: "neutral" as const, deltaPct: null as number | null };
    if (referencePrice != null && referencePrice > 0) {
      const deltaPct = ((referencePrice - floor) / floor) * 100;
      const tone = deltaPct >= 5 ? "good" : deltaPct >= 0 ? "ok" : "bad";
      return { tone, deltaPct };
    }
    if (baselineFloor != null && baselineFloor > 0) {
      const deltaPct = ((floor - baselineFloor) / baselineFloor) * 100;
      const tone = deltaPct === 0 ? "neutral" : deltaPct < 0 ? "good" : "bad";
      return { tone, deltaPct };
    }
    return { tone: "neutral" as const, deltaPct: null };
  };

  return (
    <div className="mt-5 rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-2 border-b p-3">
        <div>
          <p className="text-sm font-semibold">Sensitivity</p>
          <p className="text-xs text-muted-foreground">
            {referencePrice != null
              ? `Floor vs current EU lowest (${formatCurrency(referencePrice, referenceCurrency)})`
              : "Floor across margin profiles and FX scenarios"}
          </p>
        </div>
        {anyError && (
          <p className="text-xs text-destructive">{anyError.message}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Margin
              </th>
              {FX_SCENARIOS.map((fx) => (
                <th
                  key={fx.id}
                  className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {fx.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARGIN_PROFILES.map((margin) => (
              <tr key={margin.id} className="border-t">
                <th className="px-3 py-2 text-left">
                  <div className="font-semibold">{margin.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {(margin.total * 100).toFixed(0)}% combined
                  </div>
                </th>
                {FX_SCENARIOS.map((fx) => {
                  const idx = cells.findIndex(
                    (c) => c.margin.id === margin.id && c.fx.id === fx.id,
                  );
                  const q = queries[idx];
                  const floor =
                    typeof q?.data?.floor_price === "number"
                      ? q.data.floor_price
                      : null;
                  const { tone, deltaPct } = evaluate(floor);
                  const isBaseline =
                    margin.id === "standard" && fx.id === "base";
                  return (
                    <td
                      key={fx.id}
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        tone === "good" &&
                          "bg-emerald-50 dark:bg-emerald-950/30",
                        tone === "bad" &&
                          "bg-rose-50 dark:bg-rose-950/30",
                        isBaseline && "ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      {q?.isLoading ? (
                        <span className="text-muted-foreground">…</span>
                      ) : floor == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="font-semibold">
                            {formatCurrency(floor, sellCurrency)}
                          </div>
                          {deltaPct != null && (
                            <div
                              className={cn(
                                "flex items-center justify-end gap-0.5 text-[10px] font-medium",
                                tone === "good" &&
                                  "text-emerald-700 dark:text-emerald-400",
                                tone === "bad" &&
                                  "text-rose-700 dark:text-rose-400",
                                tone === "ok" &&
                                  "text-amber-700 dark:text-amber-400",
                                tone === "neutral" && "text-muted-foreground",
                              )}
                            >
                              {referencePrice != null ? (
                                <>
                                  {deltaPct >= 0 ? (
                                    <TrendingUp className="h-2.5 w-2.5" />
                                  ) : (
                                    <TrendingDown className="h-2.5 w-2.5" />
                                  )}
                                  {deltaPct >= 0 ? "+" : ""}
                                  {deltaPct.toFixed(1)}%
                                </>
                              ) : (
                                <>
                                  {deltaPct === 0
                                    ? "baseline"
                                    : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
        {referencePrice != null ? (
          <>
            <span className="font-semibold text-foreground">Green</span> = floor is at least 5% under
            EU lowest (genuine cushion).{" "}
            <span className="font-semibold text-foreground">Amber</span> = barely covers (0–5%
            cushion).{" "}
            <span className="font-semibold text-foreground">Red</span> = floor exceeds EU lowest;
            this deal doesn&apos;t survive the scenario.
          </>
        ) : (
          <>
            Cells show the floor sell price at each margin/FX combination. Edit your buy cost or
            margin overrides above to see how the matrix shifts.
          </>
        )}
        {isLoading && <span className="ml-2 italic">Computing…</span>}
      </div>
    </div>
  );
}

// ---------- Result breakdown ----------

function ResultBreakdown({
  data,
  currency,
}: {
  data: Breakdown;
  currency: string;
}) {
  const headline =
    typeof data.floor_price === "number"
      ? { label: "Floor sell", value: data.floor_price }
      : typeof data.max_buy_local === "number"
        ? { label: "Max buy", value: data.max_buy_local }
        : null;

  return (
    <div className="mt-4 space-y-3">
      {headline && (
        <div className="rounded-md border bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {headline.label}
          </p>
          <p className="text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(headline.value, currency)}
          </p>
        </div>
      )}
      <details className="rounded-md border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Breakdown
        </summary>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 pt-0 text-xs sm:grid-cols-3">
          {Object.entries(data ?? {}).map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">
                {typeof v === "number" &&
                k !== "fx_rate" &&
                k !== "floor_multiplier" &&
                !k.startsWith("margin")
                  ? formatCurrency(v, currency)
                  : v == null
                    ? "—"
                    : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function ProfitHint({ floor, euLow }: { floor: number | null; euLow: number }) {
  if (floor == null) return null;
  const diff = euLow - floor;
  const pct = floor > 0 ? (diff / floor) * 100 : 0;
  const ok = diff >= 0;
  return (
    <p className="mt-2 text-xs">
      EU lowest listing is {formatCurrency(euLow, "EUR")}.{" "}
      <span
        className={
          ok
            ? "font-semibold text-emerald-600 dark:text-emerald-500"
            : "font-semibold text-destructive"
        }
      >
        {ok ? "+" : ""}
        {formatCurrency(diff, "EUR")} ({pct.toFixed(1)}%) vs floor.
      </span>
    </p>
  );
}

// ---------- MaxBuyForm ----------

function MaxBuyForm({
  pricing,
  cardId,
}: {
  pricing?: CardPricing | null;
  cardId?: string;
}) {
  const [target, setTarget] = useState("");
  const [sellCcy, setSellCcy] = useState<Enums<"currency_code">>("EUR");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [resolvedFx, setResolvedFx] = useState<number | null>(null);

  const buyCcy: Enums<"currency_code"> = sellCcy === "USD" ? "EUR" : "USD";

  useEffect(() => {
    if (pricing?.eu_low != null && target === "") {
      setTarget(String(pricing.eu_low));
      setSellCcy("EUR");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing?.eu_low]);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const fxToUse =
        fx.trim() !== ""
          ? Number(fx)
          : resolvedFx != null
            ? resolvedFx
            : undefined;
      const { data, error } = await supabase.rpc("calc_max_buy_price", {
        p_target_sell_price: Number(target),
        p_sell_currency: sellCcy,
        p_allocated_travel: travel ? Number(travel) : 0,
        p_fx_rate: fxToUse,
        p_margin_cd: marginCd ? Number(marginCd) : undefined,
        p_margin_pp: marginPp ? Number(marginPp) : undefined,
      });
      if (error) throw error;
      return data as Breakdown;
    },
  });

  useEffect(() => {
    if (target && Number(target) > 0 && !mutation.data && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing?.eu_low]);

  const maxBuy = mutation.data?.max_buy_local;
  const inventoryHref =
    cardId && typeof maxBuy === "number"
      ? `/inventory/new?card_id=${encodeURIComponent(cardId)}&buy_cost_local=${maxBuy}&buy_currency=USD&listed_price=${target}&sell_currency=${sellCcy}`
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalculatorIcon className="h-4 w-4" />
          Max safe buy
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {pricing?.eu_low != null
            ? "Auto-filled with EU lowest listing. Edit to model other targets."
            : "Enter a target sell price to see the maximum safe buy."}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Target sell price</Label>
            <Input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sell currency</Label>
            <Select value={sellCcy} onValueChange={(v) => setSellCcy(v as Enums<"currency_code">)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Sale date (optional)</Label>
            <Input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
            <FxHint
              date={saleDate}
              base={buyCcy}
              quote={sellCcy}
              fxOverride={fx}
              onResolved={setResolvedFx}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Allocated travel</Label>
            <Input
              inputMode="decimal"
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FX rate</Label>
            <Input
              inputMode="decimal"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
              placeholder="auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margin C&amp;D</Label>
            <Input
              inputMode="decimal"
              value={marginCd}
              onChange={(e) => setMarginCd(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Margin P-to-P</Label>
            <Input
              inputMode="decimal"
              value={marginPp}
              onChange={(e) => setMarginPp(e.target.value)}
              placeholder="default"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={mutation.isPending} size="sm">
              <RefreshCw className={`mr-1 h-3 w-3 ${mutation.isPending ? "animate-spin" : ""}`} />
              {mutation.isPending ? "Calculating…" : "Recalculate"}
            </Button>
            {inventoryHref && (
              <Button asChild size="sm" variant="ghost">
                <Link href={inventoryHref}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add to inventory
                </Link>
              </Button>
            )}
          </div>
        </form>

        {mutation.error && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {(mutation.error as Error).message}
          </p>
        )}

        {mutation.data && (
          <ResultBreakdown
            data={mutation.data}
            currency={resolveBreakdownCurrency(mutation.data, buyCcy)}
          />
        )}

        {pricing?.us_market != null && mutation.data && (
          <BuyHint
            maxBuy={
              typeof mutation.data.max_buy_local === "number"
                ? mutation.data.max_buy_local
                : null
            }
            usMarket={pricing.us_market}
          />
        )}
      </CardContent>
    </Card>
  );
}

function BuyHint({ maxBuy, usMarket }: { maxBuy: number | null; usMarket: number }) {
  if (maxBuy == null) return null;
  const headroom = maxBuy - usMarket;
  const pct = usMarket > 0 ? (headroom / usMarket) * 100 : 0;
  const ok = headroom >= 0;
  return (
    <p className="mt-2 text-xs">
      Current US market is {formatCurrency(usMarket, "USD")}.{" "}
      <span
        className={
          ok
            ? "font-semibold text-emerald-600 dark:text-emerald-500"
            : "font-semibold text-destructive"
        }
      >
        {ok ? "+" : ""}
        {formatCurrency(headroom, "USD")} ({pct.toFixed(1)}%) headroom.
      </span>
    </p>
  );
}

// ---------- Manual Mode ----------

function ManualMode() {
  return (
    <Tabs defaultValue="floor" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="floor">Floor price</TabsTrigger>
        <TabsTrigger value="max">Max buy</TabsTrigger>
      </TabsList>
      <TabsContent value="floor">
        <FloorPriceForm />
      </TabsContent>
      <TabsContent value="max">
        <MaxBuyForm />
      </TabsContent>
    </Tabs>
  );
}
