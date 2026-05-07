"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { formatCurrency } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const runtime = "edge";

const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];

type Breakdown = Record<string, number | string | null>;

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Estimate floor sell price or max safe buy. Powered by Supabase RPC.
        </p>
      </div>

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
    </div>
  );
}

function resolveBreakdownCurrency(
  data: Breakdown | undefined,
  fallback: Enums<"currency_code">,
): Enums<"currency_code"> {
  const raw = typeof data?.currency === "string" ? data.currency.toUpperCase() : "";
  return (CURRENCIES as readonly string[]).includes(raw)
    ? (raw as Enums<"currency_code">)
    : fallback;
}

function FloorPriceForm() {
  const [buyCost, setBuyCost] = useState("");
  const [buyCcy, setBuyCcy] = useState<Enums<"currency_code">>("EUR");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");

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

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Floor price</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Buy cost (local)</Label>
            <Input inputMode="decimal" value={buyCost} onChange={(e) => setBuyCost(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Buy currency</Label>
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
          <div className="space-y-2">
            <Label>Allocated travel (optional)</Label>
            <Input inputMode="decimal" value={travel} onChange={(e) => setTravel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>FX rate (optional)</Label>
            <Input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="auto from settings" />
          </div>
          <div className="space-y-2">
            <Label>Margin (cards & dealers)</Label>
            <Input inputMode="decimal" value={marginCd} onChange={(e) => setMarginCd(e.target.value)} placeholder="e.g. 0.20" />
          </div>
          <div className="space-y-2">
            <Label>Margin (player-to-player)</Label>
            <Input inputMode="decimal" value={marginPp} onChange={(e) => setMarginPp(e.target.value)} placeholder="e.g. 0.30" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </form>

        {mutation.error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {(mutation.error as Error).message}
          </p>
        )}

        {mutation.data && (
          <ResultBreakdown
            data={mutation.data}
            currency={resolveBreakdownCurrency(mutation.data, buyCcy)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function MaxBuyForm() {
  const [target, setTarget] = useState("");
  const [sellCcy, setSellCcy] = useState<Enums<"currency_code">>("EUR");
  const [travel, setTravel] = useState("");
  const [fx, setFx] = useState("");
  const [marginCd, setMarginCd] = useState("");
  const [marginPp, setMarginPp] = useState("");

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

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Max buy</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label>Target sell price</Label>
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Sell currency</Label>
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
          <div className="space-y-2">
            <Label>Allocated travel (optional)</Label>
            <Input inputMode="decimal" value={travel} onChange={(e) => setTravel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>FX rate (optional)</Label>
            <Input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="auto from settings" />
          </div>
          <div className="space-y-2">
            <Label>Margin (cards & dealers)</Label>
            <Input inputMode="decimal" value={marginCd} onChange={(e) => setMarginCd(e.target.value)} placeholder="e.g. 0.20" />
          </div>
          <div className="space-y-2">
            <Label>Margin (player-to-player)</Label>
            <Input inputMode="decimal" value={marginPp} onChange={(e) => setMarginPp(e.target.value)} placeholder="e.g. 0.30" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending ? "Calculating…" : "Calculate"}
            </Button>
          </div>
        </form>

        {mutation.error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {(mutation.error as Error).message}
          </p>
        )}

        {mutation.data && (
          <ResultBreakdown
            data={mutation.data}
            currency={resolveBreakdownCurrency(mutation.data, sellCcy)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ResultBreakdown({ data, currency }: { data: Breakdown; currency: string }) {
  const entries = Object.entries(data ?? {});
  return (
    <div className="mt-6 rounded-lg border bg-muted/30 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Breakdown
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
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
    </div>
  );
}
