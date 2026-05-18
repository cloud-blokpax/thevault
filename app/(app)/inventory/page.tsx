"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { InventoryItemModal } from "@/components/inventory-item-modal";
import { DataTable } from "@/components/data-table/data-table";
import { BulkActionsBar } from "@/components/data-table/bulk-actions-bar";
import { ColumnPicker } from "@/components/data-table/column-picker";
import { usePersistedPreference } from "@/components/data-table/use-persisted-state";
import type { ColumnDef, TableState } from "@/components/data-table/types";
import { fxLatest } from "@/lib/supabase/fx";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const runtime = "edge";

type Row = {
  id: string;
  status: Enums<"inventory_status">;
  buy_cost_local: number;
  buy_currency: Enums<"currency_code">;
  buy_location: string | null;
  source: string | null;
  partner_owner: string | null;
  bought_on: string | null;
  trip_id: string | null;
  listed_price: number | null;
  sell_currency: Enums<"currency_code"> | null;
  sold_price: number | null;
  sold_at: string | null;
  sold_to: string | null;
  allocated_travel: number | null;
  fx_rate_locked: number | null;
  margin_cd_override: number | null;
  margin_pp_override: number | null;
  notes: string | null;
  is_foil: boolean | null;
  updated_at: string;
  cards: {
    canonical_name: string;
    set_name: string | null;
    set_code: string | null;
    game: Enums<"game_kind">;
  } | null;
  trips: { label: string | null } | null;
};

type Settings = {
  margin_cd_default: number | null;
  margin_pp_default: number | null;
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

const TABLE_STATE_KEY = "inventory_table_state";
const COLUMNS_KEY = "inventory_columns_v1";

const DEFAULT_VISIBLE: string[] = [
  "card",
  "set",
  "status",
  "buy_cost",
  "listed_price",
  "updated_at",
];

const DEFAULT_TABLE_STATE: TableState = {
  sort: { columnId: "updated_at", dir: "desc" },
  filters: {},
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [game, setGame] = useState<(typeof GAME_OPTIONS)[number]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "single"; id: string; label: string }
    | { kind: "bulk"; ids: string[] }
    | null
  >(null);

  const [tableState, setTableState] = usePersistedPreference<TableState>(
    TABLE_STATE_KEY,
    DEFAULT_TABLE_STATE,
  );
  const [visibleColumns, setVisibleColumns] = usePersistedPreference<string[]>(
    COLUMNS_KEY,
    DEFAULT_VISIBLE,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", { statusFilter, game }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("inventory_items")
        .select(
          "id, status, buy_cost_local, buy_currency, buy_location, source, partner_owner, bought_on, trip_id, listed_price, sell_currency, sold_price, sold_at, sold_to, allocated_travel, fx_rate_locked, margin_cd_override, margin_pp_override, notes, is_foil, updated_at, cards(canonical_name, set_name, set_code, game), trips!inventory_items_trip_id_fkey(label)",
        )
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      const filtered = (data as unknown as Row[]).filter((r) =>
        game === "all" ? true : r.cards?.game === game,
      );
      return filtered;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["settings-defaults"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => Promise<{
            data: { key: string; value_num: number | null }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
      const { data, error } = await client
        .from("settings")
        .select("key, value_num");
      if (error) throw new Error(error.message);
      const map = new Map((data ?? []).map((r) => [r.key, r.value_num]));
      return {
        margin_cd_default: map.get("margin_cd_default") ?? 0.2,
        margin_pp_default: map.get("margin_pp_default") ?? 0.1,
      } as Settings;
    },
  });

  const fxQuery = useQuery({
    queryKey: ["fx-widget"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      return await fxLatest(supabase);
    },
  });

  const todaysFx = fxQuery.data;

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const previous = qc.getQueryData<Row[]>([
        "inventory",
        { statusFilter, game },
      ]);
      qc.setQueryData<Row[]>(
        ["inventory", { statusFilter, game }],
        (old) => (old ?? []).filter((r) => !ids.includes(r.id)),
      );
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["inventory", { statusFilter, game }], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const updateCell = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("inventory_items")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const previous = qc.getQueryData<Row[]>([
        "inventory",
        { statusFilter, game },
      ]);
      qc.setQueryData<Row[]>(
        ["inventory", { statusFilter, game }],
        (old) =>
          (old ?? []).map((r) =>
            r.id === id ? ({ ...r, ...payload } as Row) : r,
          ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["inventory", { statusFilter, game }], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const handleCellEdit = async (
    row: Row,
    payload: Record<string, unknown>,
  ) => {
    await updateCell.mutateAsync({ id: row.id, payload });
  };

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => {
      const c = r.cards;
      return (
        c?.canonical_name.toLowerCase().includes(q) ||
        c?.set_name?.toLowerCase().includes(q) ||
        c?.set_code?.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => buildColumns(settingsQuery.data, todaysFx),
    [settingsQuery.data, todaysFx],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {filteredRows.length}{" "}
            {filteredRows.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/inventory/new">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Link>
        </Button>
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
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as typeof statusFilter)
          }
        >
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
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items match.</p>
        ) : (
          filteredRows.map((row) => (
            <div
              key={row.id}
              className="relative rounded-lg border bg-card active:bg-accent"
            >
              <button
                type="button"
                onClick={() => setEditingId(row.id)}
                className="block w-full p-3 pr-10 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.cards?.canonical_name ?? "Unknown"}
                      {row.is_foil && (
                        <span className="ml-1 text-amber-600">★</span>
                      )}
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
                      {formatCurrency(
                        row.listed_price,
                        row.sell_currency ?? "EUR",
                      )}
                    </span>
                  )}
                </div>
              </button>
              <button
                type="button"
                aria-label="Delete row"
                onClick={() =>
                  setDeleteTarget({
                    kind: "single",
                    id: row.id,
                    label: row.cards?.canonical_name ?? "this item",
                  })
                }
                className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <InventoryItemModal
        itemId={editingId}
        onClose={() => setEditingId(null)}
      />

      {/* Desktop sortable/filterable table */}
      <div className="hidden md:block">
        <BulkActionsBar
          count={selectedIds.length}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              {selectedIds.length === 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(selectedIds[0]);
                    setSelectedIds([]);
                  }}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() =>
                  setDeleteTarget({ kind: "bulk", ids: selectedIds })
                }
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete {selectedIds.length}
              </Button>
            </>
          }
        />
        <DataTable<Row>
          columns={columns}
          rows={filteredRows}
          visibleColumnIds={visibleColumns}
          state={tableState}
          onStateChange={setTableState}
          onColumnsClick={() => setColumnPickerOpen(true)}
          rowKey={(r) => r.id}
          onRowClick={(r) => setEditingId(r.id)}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onCellEdit={handleCellEdit}
          rowActions={(r) => (
            <div className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                aria-label="Edit row"
                onClick={() => setEditingId(r.id)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Delete row"
                onClick={() =>
                  setDeleteTarget({
                    kind: "single",
                    id: r.id,
                    label: r.cards?.canonical_name ?? "this item",
                  })
                }
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          loading={isLoading}
          empty="No items match."
        />
      </div>

      <Dialog.Root
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg">
            <Dialog.Title className="text-base font-semibold">
              {deleteTarget?.kind === "bulk"
                ? `Delete ${deleteTarget.ids.length} items?`
                : `Delete ${deleteTarget?.kind === "single" ? deleteTarget.label : "item"}?`}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              This permanently removes the inventory row. Card catalog data is
              not affected.
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={del.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={del.isPending}
                onClick={async () => {
                  const ids =
                    deleteTarget?.kind === "bulk"
                      ? deleteTarget.ids
                      : deleteTarget?.kind === "single"
                        ? [deleteTarget.id]
                        : [];
                  try {
                    await del.mutateAsync(ids);
                    setSelectedIds((prev) =>
                      prev.filter((x) => !ids.includes(x)),
                    );
                    setDeleteTarget(null);
                  } catch {
                    /* error already in mutation state */
                  }
                }}
              >
                {del.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
            {del.error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {(del.error as Error).message}
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ColumnPicker
        open={columnPickerOpen}
        onOpenChange={setColumnPickerOpen}
        columns={columns}
        visibleColumnIds={visibleColumns}
        defaultVisibleIds={DEFAULT_VISIBLE}
        onChange={setVisibleColumns}
      />
    </div>
  );
}

function buildColumns(
  settings: Settings | undefined,
  todaysFx:
    | { usd_to_eur: number; eur_to_usd: number; rate_date: string }
    | null
    | undefined,
): ColumnDef<Row>[] {
  function fxFor(buyCcy: Enums<"currency_code"> | null | undefined): number {
    if (!buyCcy || buyCcy === "EUR") return 1;
    if (buyCcy === "USD") return todaysFx?.usd_to_eur ?? 1;
    return 1;
  }

  function computeFloor(row: Row): number | null {
    const buy = row.buy_cost_local;
    if (buy == null) return null;
    const travel = row.allocated_travel ?? 0;
    const fx =
      row.fx_rate_locked != null && row.fx_rate_locked > 0
        ? Number(row.fx_rate_locked)
        : fxFor(row.buy_currency);
    const cd =
      row.margin_cd_override != null
        ? Number(row.margin_cd_override)
        : (settings?.margin_cd_default ?? 0.2);
    const pp =
      row.margin_pp_override != null
        ? Number(row.margin_pp_override)
        : (settings?.margin_pp_default ?? 0.1);
    return (buy + travel) * fx * (1 + cd + pp);
  }

  return [
    {
      id: "card",
      label: "Card",
      type: "text",
      accessor: (r) => r.cards?.canonical_name ?? "",
      hideable: false,
      render: (r) => (
        <span className="font-medium">
          {r.cards?.canonical_name ?? "Unknown"}
          {r.is_foil && <span className="ml-1 text-amber-600">★</span>}
        </span>
      ),
    },
    {
      id: "set",
      label: "Set",
      type: "text",
      accessor: (r) => r.cards?.set_name ?? r.cards?.game ?? "",
      render: (r) => (
        <span className="text-muted-foreground">
          {r.cards?.set_name ?? titleCase(r.cards?.game)}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      type: "enum",
      accessor: (r) => r.status,
      enumOptions: STATUS_OPTIONS.filter((s) => s !== "all").map((s) => ({
        value: s as string,
        label: titleCase(s as string),
      })),
      render: (r) => <StatusBadge status={r.status} />,
      editable: {
        type: "enum",
        enumOptions: STATUS_OPTIONS.filter((s) => s !== "all").map((s) => ({
          value: s as string,
          label: titleCase(s as string),
        })),
        toUpdate: (_row, raw) => (raw ? { status: raw } : null),
      },
    },
    {
      id: "buy_cost",
      label: "Buy",
      type: "number",
      align: "right",
      accessor: (r) => r.buy_cost_local,
      render: (r) => formatCurrency(r.buy_cost_local, r.buy_currency),
    },
    {
      id: "buy_currency",
      label: "Buy ccy",
      type: "enum",
      accessor: (r) => r.buy_currency,
      enumOptions: ["USD", "EUR", "GBP", "JPY", "CAD"].map((c) => ({
        value: c,
        label: c,
      })),
    },
    {
      id: "listed_price",
      label: "Listed",
      type: "number",
      align: "right",
      accessor: (r) => r.listed_price,
      render: (r) =>
        r.listed_price != null
          ? formatCurrency(r.listed_price, r.sell_currency ?? "EUR")
          : "—",
      editable: {
        type: "number",
        initialValue: (r) =>
          r.listed_price != null ? String(r.listed_price) : "",
        toUpdate: (row, raw) => {
          const trimmed = raw.trim();
          if (trimmed === "") return { listed_price: null };
          const n = Number(trimmed);
          if (Number.isNaN(n)) return null;
          const payload: Record<string, unknown> = { listed_price: n };
          if (!row.sell_currency) payload.sell_currency = "EUR";
          return payload;
        },
      },
    },
    {
      id: "sold_price",
      label: "Sold",
      type: "number",
      align: "right",
      accessor: (r) => r.sold_price,
      render: (r) =>
        r.sold_price != null
          ? formatCurrency(r.sold_price, r.sell_currency ?? "EUR")
          : "—",
      editable: {
        type: "number",
        initialValue: (r) =>
          r.sold_price != null ? String(r.sold_price) : "",
        toUpdate: (row, raw) => {
          const trimmed = raw.trim();
          if (trimmed === "") return { sold_price: null };
          const n = Number(trimmed);
          if (Number.isNaN(n)) return null;
          const payload: Record<string, unknown> = { sold_price: n };
          if (!row.sell_currency) payload.sell_currency = "EUR";
          return payload;
        },
      },
    },
    {
      id: "sold_at",
      label: "Sold at",
      type: "date",
      accessor: (r) => (r.sold_at ? r.sold_at.slice(0, 10) : null),
      render: (r) => formatDate(r.sold_at),
    },
    {
      id: "sold_to",
      label: "Sold to",
      type: "text",
      accessor: (r) => r.sold_to,
      editable: {
        type: "text",
        initialValue: (r) => r.sold_to ?? "",
        toUpdate: (_row, raw) => ({
          sold_to: raw.trim() === "" ? null : raw.trim(),
        }),
      },
    },
    {
      id: "bought_on",
      label: "Bought on",
      type: "date",
      accessor: (r) => r.bought_on,
      render: (r) => formatDate(r.bought_on),
    },
    {
      id: "buy_location",
      label: "Buy location",
      type: "text",
      accessor: (r) => r.buy_location,
    },
    {
      id: "source",
      label: "Source",
      type: "text",
      accessor: (r) => r.source,
    },
    {
      id: "partner_owner",
      label: "Owner",
      type: "text",
      accessor: (r) => r.partner_owner,
    },
    {
      id: "trip",
      label: "Trip",
      type: "text",
      accessor: (r) => r.trips?.label ?? "",
    },
    {
      id: "allocated_travel",
      label: "Travel allocated",
      type: "number",
      align: "right",
      accessor: (r) => r.allocated_travel,
      render: (r) =>
        r.allocated_travel != null
          ? formatCurrency(r.allocated_travel, r.buy_currency)
          : "—",
    },
    {
      id: "floor_price",
      label: "Floor",
      type: "number",
      align: "right",
      accessor: (r) => computeFloor(r),
      render: (r) => {
        const v = computeFloor(r);
        return v == null
          ? "—"
          : formatCurrency(v, r.sell_currency ?? "EUR");
      },
    },
    {
      id: "realized_pnl",
      label: "Realized P&L",
      type: "number",
      align: "right",
      accessor: (r) => {
        if (r.sold_price == null) return null;
        const f = computeFloor(r);
        if (f == null) return null;
        return r.sold_price - f;
      },
      render: (r) => {
        if (r.sold_price == null) return "—";
        const f = computeFloor(r);
        if (f == null) return "—";
        const pnl = r.sold_price - f;
        return (
          <span
            className={
              pnl >= 0 ? "text-emerald-600" : "text-rose-600"
            }
          >
            {formatCurrency(pnl, r.sell_currency ?? "EUR")}
          </span>
        );
      },
    },
    {
      id: "notes",
      label: "Notes",
      type: "text",
      accessor: (r) => r.notes,
      render: (r) =>
        r.notes ? (
          <span className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
            {r.notes}
          </span>
        ) : (
          "—"
        ),
      editable: {
        type: "textarea",
        initialValue: (r) => r.notes ?? "",
        toUpdate: (_row, raw) => ({ notes: raw === "" ? null : raw }),
      },
    },
    {
      id: "updated_at",
      label: "Updated",
      type: "date",
      accessor: (r) => r.updated_at?.slice(0, 10),
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.updated_at).toLocaleDateString()}
        </span>
      ),
    },
  ];
}
