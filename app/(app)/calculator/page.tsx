"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator as CalculatorIcon, Plus, RefreshCw } from "lucide-react";
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
import { formatCurrency, titleCase } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const runtime = "edge";

const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];

type Breakdown = Record<string, number | string | null>;

type CardPricing = {
  us_low: number | null;
  us_market: number | null;
  us_high: number | null;
  us_currency: string;
  us_captured_at: string | null;
  eu_low: number | null;
  eu_market: number | null;
  eu_avg30: number | null;
  eu_currency: string;
  eu_captured_at: string | null;
};

function summarizePricing(rows: ProvenanceRow[]): CardPricing {
  const us = rows.find((r) => r.source.toLowerCase().includes("tcgplayer"));
  const eu = rows.find((r) => r.source.toLowerCase().includes("cardmarket"));
  return {
    us_low: us?.price_low != null ? num(us.price_low) : null,
    us_market: us?.price_market != null ? num(us.price_market) : null,
    us_high: us?.price_high != null ? num(us.price_high) : null,
    us_currency: us?.currency || "USD",
    us_captured_at: us?.captured_at ?? null,
    eu_low: eu?.price_low != null ? num(eu.price_low) : null,
    eu_market: eu?.price_market != null ? num(eu.price_market) : null,
    eu_avg30: eu?.cm_avg30 != null ? num(eu.cm_avg30) : null,
    eu_currency: eu?.currency || "EUR",
    eu_captured_at: eu?.captured_at ?? null,
  };
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
          <Row label="Lowest list" value={pricing.us_low} currency={pricing.us_currency} />
          <Row label="Market" value={pricing.us_market} currency={pricing.us_currency} highlight />
          <Row label="High" value={pricing.us_high} currency={pricing.us_currency} />
        </dl>
      </div>
      <div className="rounded-md border bg-muted/30 p-2">
        <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
          EU (Cardmarket)
        </p>
        <dl className="space-y-0.5">
          <Row label="Lowest list" value={pricing.eu_low} currency={pricing.eu_currency} highlight />
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
  pricing: CardPricing | null;
  cardId?: string;
}) {
  const [buyCost, setBuyCost] = useState("");
  const [buyCcy, setBuyCcy] = useState<Enums<"currency_code">>("USD");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");

  // Auto-fill from US market when pricing arrives, but only if user hasn't typed.
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
      const { data, error } = await supabase.rpc("calc_floor_price", {
        p_buy_cost_local: Number(buyCost),
        p_buy_currency: buyCcy,
        p_allocated_travel: travel ? Number(travel) : 0,
        p_fx_rate: fx ? Number(fx) : undefined,
        p_margin_cd: marginCd ? Number(marginCd) : undefined,
        p_margin_pp: marginPp ? Number(marginPp) : undefined,
      });
      if (error) throw error;
      return data as Breakdown;
    },
  });

  // Auto-recalc when buy cost is auto-populated
  useEffect(() => {
    if (buyCost && Number(buyCost) > 0 && !mutation.data && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing?.us_market]);

  const inventoryHref = cardId
    ? `/inventory/new?card_id=${encodeURIComponent(cardId)}&buy_cost_local=${buyCost}&buy_currency=${buyCcy}&sell_currency=EUR`
    : null;

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
          <ResultBreakdown data={mutation.data} fallbackCurrency="EUR" />
        )}

        {pricing?.eu_low != null && mutation.data && (
          <ProfitHint
            floor={typeof mutation.data.floor === "number" ? mutation.data.floor : null}
            euLow={pricing.eu_low}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MaxBuyForm({
  pricing,
  cardId,
}: {
  pricing: CardPricing | null;
  cardId?: string;
}) {
  const [target, setTarget] = useState("");
  const [sellCcy, setSellCcy] = useState<Enums<"currency_code">>("EUR");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");

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
      const { data, error } = await supabase.rpc("calc_max_buy_price", {
        p_target_sell_price: Number(target),
        p_sell_currency: sellCcy,
        p_allocated_travel: travel ? Number(travel) : 0,
        p_fx_rate: fx ? Number(fx) : undefined,
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
          <ResultBreakdown data={mutation.data} fallbackCurrency="USD" />
        )}

        {pricing?.us_market != null && mutation.data && (
          <BuyHint
            maxBuy={typeof mutation.data.max_buy_local === "number" ? mutation.data.max_buy_local : null}
            usMarket={pricing.us_market}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ResultBreakdown({
  data,
  fallbackCurrency,
}: {
  data: Breakdown;
  fallbackCurrency: string;
}) {
  const currency =
    typeof data?.currency === "string"
      ? String(data.currency).toUpperCase()
      : fallbackCurrency;
  const entries = Object.entries(data ?? {});
  const headline =
    typeof data.floor === "number"
      ? { label: "Floor sell", value: data.floor }
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
          {entries.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">
                {typeof v === "number" && k !== "fx_rate" && !k.startsWith("margin")
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

// ---------- Manual Mode (preserves the old calc-from-scratch flow) ----------

function ManualMode() {
  return (
    <Tabs defaultValue="floor" className="w-full">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="floor">Floor price</TabsTrigger>
        <TabsTrigger value="max">Max buy</TabsTrigger>
      </TabsList>
      <TabsContent value="floor">
        <FloorPriceForm pricing={null} />
      </TabsContent>
      <TabsContent value="max">
        <MaxBuyForm pricing={null} />
      </TabsContent>
    </Tabs>
  );
}
