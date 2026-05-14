"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  CardSearchInput,
  formatSetLine,
  gameLabel,
  type CardHit,
} from "@/components/card-search-input";
import { CardImage } from "@/components/ui/card-image";
import type { Enums } from "@/types/database";

export const runtime = "edge";

const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];
const GAMES: ("all" | Enums<"game_kind">)[] = [
  "all",
  "pokemon",
  "one_piece",
  "magic",
  "lorcana",
  "yugioh",
  "other",
];

export default function NewInventoryItemPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const prefillCardId = searchParams.get("card_id");
  const prefillBuyCost = searchParams.get("buy_cost_local") ?? "";
  const prefillBuyCcyRaw = searchParams.get("buy_currency");
  const prefillBuyCcy = (CURRENCIES as readonly string[]).includes(prefillBuyCcyRaw ?? "")
    ? (prefillBuyCcyRaw as Enums<"currency_code">)
    : "EUR";

  const [game, setGame] = useState<(typeof GAMES)[number]>("all");
  const [picked, setPicked] = useState<CardHit | null>(null);
  const [buyCost, setBuyCost] = useState(prefillBuyCost);
  const [buyCcy, setBuyCcy] = useState<Enums<"currency_code">>(prefillBuyCcy);
  const [source, setSource] = useState("");

  useQuery({
    queryKey: ["prefill-card", prefillCardId],
    enabled: !!prefillCardId && !picked,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cards")
        .select(
          "id, game, canonical_name, set_name, set_code, card_number, rarity, language, attributes, is_sealed, image_url",
        )
        .eq("id", prefillCardId!)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const attrs = (data.attributes ?? {}) as Record<string, unknown>;
        const foil =
          typeof attrs.is_foil === "boolean" ? attrs.is_foil : null;
        setPicked({
          id: data.id,
          game: data.game,
          name: data.canonical_name,
          set_name: data.set_name,
          set_code: data.set_code,
          card_number: data.card_number,
          rarity: data.rarity,
          language: data.language,
          is_foil: foil,
          is_sealed: data.is_sealed,
          image_url: data.image_url,
          release_year: null,
          release_date: null,
        });
      }
      return data;
    },
  });

  useEffect(() => {
    if (prefillBuyCost && !buyCost) setBuyCost(prefillBuyCost);
  }, [prefillBuyCost, buyCost]);

  const create = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error("Pick a card first.");
      if (!buyCost) throw new Error("Buy cost is required.");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          user_id: user.id,
          card_id: picked.id,
          buy_cost_local: Number(buyCost),
          buy_currency: buyCcy,
          source: source || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      router.push(`/inventory/${id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/inventory" className="text-xs text-muted-foreground hover:underline">
          ← Inventory
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add inventory</h1>
        <p className="text-sm text-muted-foreground">
          Search the catalog, then enter your buy details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1">
              <Label className="text-xs">Game</Label>
              <Select value={game} onValueChange={(v) => setGame(v as typeof game)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAMES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === "all" ? "All games" : gameLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Card</Label>
              <CardSearchInput
                game={game === "all" ? undefined : (game as Enums<"game_kind">)}
                onSelect={(c) => setPicked(c)}
                placeholder="Type a card name…"
              />
            </div>
          </div>

          {picked && (
            <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
              <CardImage
                src={picked.image_url}
                alt={picked.name}
                width={56}
                height={78}
                fallbackText=""
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{picked.name}</p>
                <p className="truncate text-xs text-foreground/80">
                  {formatSetLine(picked) || gameLabel(picked.game)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    gameLabel(picked.game),
                    picked.card_number ? `#${picked.card_number}` : null,
                    picked.rarity,
                    picked.set_code,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buy details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Buy cost (local)</Label>
              <Input
                inputMode="decimal"
                value={buyCost}
                onChange={(e) => setBuyCost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Buy currency</Label>
              <Select
                value={buyCcy}
                onValueChange={(v) => setBuyCcy(v as Enums<"currency_code">)}
              >
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Source (optional)</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Shop, dealer, marketplace…"
              />
            </div>
            {create.error && (
              <p className="sm:col-span-2 text-sm text-destructive" role="alert">
                {(create.error as Error).message}
              </p>
            )}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={!picked || create.isPending}>
                {create.isPending ? "Adding…" : "Add to inventory"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/inventory">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
