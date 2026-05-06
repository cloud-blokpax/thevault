"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import type { Enums, Tables } from "@/types/database";

const STATUS: Enums<"inventory_status">[] = [
  "pending",
  "bought",
  "in_transit",
  "landed",
  "listed",
  "sold",
  "cancelled",
];
const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];

type FormState = {
  status: Enums<"inventory_status">;
  buy_cost_local: string;
  buy_currency: Enums<"currency_code">;
  buy_location: string;
  source: string;
  partner_owner: string;
  allocated_travel: string;
  fx_rate_locked: string;
  listed_price: string;
  sell_currency: Enums<"currency_code"> | "";
  sold_price: string;
  sold_to: string;
  target_market: string;
  notes: string;
  visibility_buyer: boolean;
};

function toForm(item: Tables<"inventory_items">): FormState {
  return {
    status: item.status,
    buy_cost_local: String(item.buy_cost_local ?? ""),
    buy_currency: item.buy_currency,
    buy_location: item.buy_location ?? "",
    source: item.source ?? "",
    partner_owner: item.partner_owner ?? "",
    allocated_travel: String(item.allocated_travel ?? ""),
    fx_rate_locked: item.fx_rate_locked != null ? String(item.fx_rate_locked) : "",
    listed_price: item.listed_price != null ? String(item.listed_price) : "",
    sell_currency: item.sell_currency ?? "",
    sold_price: item.sold_price != null ? String(item.sold_price) : "",
    sold_to: item.sold_to ?? "",
    target_market: item.target_market ?? "",
    notes: item.notes ?? "",
    visibility_buyer: item.visibility_buyer,
  };
}

export default function InventoryEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ["inventory", params.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("id", params.id)
        .single();
      if (error) throw error;
      return data as Tables<"inventory_items">;
    },
  });

  useEffect(() => {
    if (item && !form) setForm(toForm(item));
  }, [item, form]);

  const mutation = useMutation({
    mutationFn: async (state: FormState) => {
      const supabase = createClient();
      const payload = {
        status: state.status,
        buy_cost_local: Number(state.buy_cost_local),
        buy_currency: state.buy_currency,
        buy_location: state.buy_location || null,
        source: state.source || null,
        partner_owner: state.partner_owner || null,
        allocated_travel: state.allocated_travel ? Number(state.allocated_travel) : 0,
        fx_rate_locked: state.fx_rate_locked ? Number(state.fx_rate_locked) : null,
        listed_price: state.listed_price ? Number(state.listed_price) : null,
        sell_currency: state.sell_currency || null,
        sold_price: state.sold_price ? Number(state.sold_price) : null,
        sold_to: state.sold_to || null,
        target_market: state.target_market || null,
        notes: state.notes || null,
        visibility_buyer: state.visibility_buyer,
      };
      const { error } = await supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      router.push(`/inventory/${params.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/inventory/${params.id}`} className="text-xs text-muted-foreground hover:underline">
          ← Cancel
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Edit item</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form) mutation.mutate(form);
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status & cost</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v as Enums<"inventory_status">)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {titleCase(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => update("source", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Buy cost (local)</Label>
              <Input
                inputMode="decimal"
                value={form.buy_cost_local}
                onChange={(e) => update("buy_cost_local", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Buy currency</Label>
              <Select value={form.buy_currency} onValueChange={(v) => update("buy_currency", v as Enums<"currency_code">)}>
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
              <Label>Buy location</Label>
              <Input value={form.buy_location} onChange={(e) => update("buy_location", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Partner owner</Label>
              <Input value={form.partner_owner} onChange={(e) => update("partner_owner", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Allocated travel</Label>
              <Input
                inputMode="decimal"
                value={form.allocated_travel}
                onChange={(e) => update("allocated_travel", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>FX rate locked</Label>
              <Input
                inputMode="decimal"
                value={form.fx_rate_locked}
                onChange={(e) => update("fx_rate_locked", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sell</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Listed price</Label>
              <Input
                inputMode="decimal"
                value={form.listed_price}
                onChange={(e) => update("listed_price", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sell currency</Label>
              <Select
                value={form.sell_currency || "_none"}
                onValueChange={(v) => update("sell_currency", v === "_none" ? "" : (v as Enums<"currency_code">))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sold price</Label>
              <Input
                inputMode="decimal"
                value={form.sold_price}
                onChange={(e) => update("sold_price", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sold to</Label>
              <Input value={form.sold_to} onChange={(e) => update("sold_to", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Target market</Label>
              <Input value={form.target_market} onChange={(e) => update("target_market", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.visibility_buyer}
                onChange={(e) => update("visibility_buyer", e.target.checked)}
                className="h-4 w-4"
              />
              Visible to buyer
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={4} />
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/inventory/${params.id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
