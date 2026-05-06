"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, titleCase } from "@/lib/utils";
import type { Enums } from "@/types/database";

type SortKey = "updated_at" | "name" | "buy_cost_local" | "listed_price";

type Row = {
  id: string;
  status: Enums<"inventory_status">;
  buy_cost_local: number;
  buy_currency: Enums<"currency_code">;
  listed_price: number | null;
  sell_currency: Enums<"currency_code"> | null;
  updated_at: string;
  cards: {
    name: string;
    set_name: string | null;
    set_code: string | null;
    game: Enums<"game_kind">;
    is_foil: boolean;
  } | null;
};

const STATUS_OPTIONS: ("all" | Enums<"inventory_status">)[] = [
  "all",
  "pending",
  "bought",
  "in_transit",
  "landed",
  "listed",
  "sold",
  "cancelled",
];

const GAME_OPTIONS: ("all" | Enums<"game_kind">)[] = [
  "all",
  "pokemon",
  "one_piece",
  "magic",
  "lorcana",
  "yugioh",
  "other",
];

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [game, setGame] = useState<(typeof GAME_OPTIONS)[number]>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", { status, game }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("inventory_items")
        .select(
          "id, status, buy_cost_local, buy_currency, listed_price, sell_currency, updated_at, cards(name, set_name, set_code, game, is_foil)",
        )
        .order("updated_at", { ascending: false })
        .limit(500);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      const filtered = (data as unknown as Row[]).filter((r) =>
        game === "all" ? true : r.cards?.game === game,
      );
      return filtered;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const rows = q
      ? data.filter((r) => {
          const c = r.cards;
          return (
            c?.name.toLowerCase().includes(q) ||
            c?.set_name?.toLowerCase().includes(q) ||
            c?.set_code?.toLowerCase().includes(q)
          );
        })
      : data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "name":
          av = a.cards?.name ?? "";
          bv = b.cards?.name ?? "";
          break;
        case "buy_cost_local":
          av = a.buy_cost_local;
          bv = b.buy_cost_local;
          break;
        case "listed_price":
          av = a.listed_price ?? 0;
          bv = b.listed_price ?? 0;
          break;
        default:
          av = a.updated_at;
          bv = b.updated_at;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or set…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={game} onValueChange={(v) => setGame(v as typeof game)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAME_OPTIONS.map((g) => (
              <SelectItem key={g} value={g}>
                {g === "all" ? "All games" : titleCase(g)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load inventory: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items match.</p>
        ) : (
          filtered.map((row) => (
            <Link
              key={row.id}
              href={`/inventory/${row.id}`}
              className="block rounded-lg border bg-card p-3 active:bg-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.cards?.name ?? "Unknown"}
                    {row.cards?.is_foil && <span className="ml-1 text-amber-600">★</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.cards?.set_name ?? titleCase(row.cards?.game)}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Buy {formatCurrency(row.buy_cost_local, row.buy_currency)}
                </span>
                {row.listed_price != null && (
                  <span className="font-medium">
                    {formatCurrency(row.listed_price, row.sell_currency ?? "USD")}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort("name")} className="font-semibold hover:underline">
                  Card {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="px-3 py-2">Set</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort("buy_cost_local")} className="font-semibold hover:underline">
                  Buy {sortKey === "buy_cost_local" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button onClick={() => toggleSort("listed_price")} className="font-semibold hover:underline">
                  Listed {sortKey === "listed_price" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              </th>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort("updated_at")} className="font-semibold hover:underline">
                  Updated {sortKey === "updated_at" && (sortDir === "asc" ? "↑" : "↓")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No items match.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-accent/40">
                  <td className="px-3 py-2">
                    <Link href={`/inventory/${row.id}`} className="font-medium hover:underline">
                      {row.cards?.name ?? "Unknown"}
                      {row.cards?.is_foil && <span className="ml-1 text-amber-600">★</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.cards?.set_name ?? titleCase(row.cards?.game)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(row.buy_cost_local, row.buy_currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.listed_price != null
                      ? formatCurrency(row.listed_price, row.sell_currency ?? "USD")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(row.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
