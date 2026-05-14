"use client";

import { useEffect, useMemo, useState } from "react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { TripStatusToggle } from "@/components/trip-status-toggle";
import { tripActivityLog, type ActivityLogRow } from "@/lib/supabase/rpc";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/utils";
import type { Enums, Tables } from "@/types/database";

export const runtime = "edge";

const DIRECTIONS: { value: Enums<"trip_direction">; label: string }[] = [
  { value: "US_TO_EU", label: "US → EU" },
  { value: "EU_TO_US", label: "EU → US" },
];

const ALLOC_METHODS = [
  { value: "weighted_by_cost", label: "Weighted by cost" },
  { value: "equal", label: "Equal" },
  { value: "manual", label: "Manual" },
] as const;

type Trip = Tables<"trips">;

type TripItem = {
  id: string;
  status: Enums<"inventory_status">;
  buy_cost_local: number;
  buy_currency: Enums<"currency_code">;
  allocated_travel: number;
  listed_price: number | null;
  sell_currency: Enums<"currency_code"> | null;
  cards: { canonical_name: string; set_name: string | null; game: string } | null;
};

type TripTotal = {
  total_travel_cost: number | null;
  buy_currency: Enums<"currency_code"> | null;
};

type FormState = {
  label: string;
  direction: Enums<"trip_direction">;
  allocation_method: string;
  departed_on: string;
  arrived_on: string;
  cost_flight: string;
  cost_shipping: string;
  cost_miles_or_gas: string;
  cost_misc: string;
  fx_rate_locked: string;
  notes: string;
};

function tripToForm(t: Trip): FormState {
  return {
    label: t.label ?? "",
    direction: t.direction,
    allocation_method: t.allocation_method ?? "weighted_by_cost",
    departed_on: t.departed_on ?? "",
    arrived_on: t.arrived_on ?? "",
    cost_flight: String(t.cost_flight ?? 0),
    cost_shipping: String(t.cost_shipping ?? 0),
    cost_miles_or_gas: String(t.cost_miles_or_gas ?? 0),
    cost_misc: String(t.cost_misc ?? 0),
    fx_rate_locked: t.fx_rate_locked != null ? String(t.fx_rate_locked) : "",
    notes: t.notes ?? "",
  };
}

function formsEqual(a: FormState, b: FormState): boolean {
  return (
    a.label === b.label &&
    a.direction === b.direction &&
    a.allocation_method === b.allocation_method &&
    a.departed_on === b.departed_on &&
    a.arrived_on === b.arrived_on &&
    a.cost_flight === b.cost_flight &&
    a.cost_shipping === b.cost_shipping &&
    a.cost_miles_or_gas === b.cost_miles_or_gas &&
    a.cost_misc === b.cost_misc &&
    a.fx_rate_locked === b.fx_rate_locked &&
    a.notes === b.notes
  );
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const tripQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as Trip | null;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["trip-items", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inventory_items")
        .select(
          "id, status, buy_cost_local, buy_currency, allocated_travel, listed_price, sell_currency, cards(canonical_name, set_name, game)",
        )
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TripItem[];
    },
  });

  const totalsQuery = useQuery({
    queryKey: ["trip-totals", tripId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trip_totals")
        .select("total_travel_cost, buy_currency")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TripTotal | null;
    },
  });

  const trip = tripQuery.data ?? null;
  const items = itemsQuery.data ?? [];
  const totals = totalsQuery.data ?? null;
  const isOpen = trip ? !trip.closed_at : true;

  useEffect(() => {
    if (trip && !form) setForm(tripToForm(trip));
  }, [trip, form]);

  const baseline = useMemo(() => (trip ? tripToForm(trip) : null), [trip]);
  const dirty = useMemo(
    () => (form && baseline ? !formsEqual(form, baseline) : false),
    [form, baseline],
  );

  const saveMutation = useMutation({
    mutationFn: async (state: FormState) => {
      const supabase = createClient();
      const payload = {
        label: state.label.trim(),
        direction: state.direction,
        allocation_method: state.allocation_method,
        departed_on: state.departed_on || null,
        arrived_on: state.arrived_on || null,
        cost_flight: state.cost_flight ? Number(state.cost_flight) : 0,
        cost_shipping: state.cost_shipping ? Number(state.cost_shipping) : 0,
        cost_miles_or_gas: state.cost_miles_or_gas ? Number(state.cost_miles_or_gas) : 0,
        cost_misc: state.cost_misc ? Number(state.cost_misc) : 0,
        fx_rate_locked: state.fx_rate_locked ? Number(state.fx_rate_locked) : null,
        notes: state.notes.trim() || null,
      };
      const { error } = await supabase.from("trips").update(payload).eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setSaveError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["trip", tripId] }),
        qc.invalidateQueries({ queryKey: ["trip-items", tripId] }),
        qc.invalidateQueries({ queryKey: ["trip-totals", tripId] }),
        qc.invalidateQueries({ queryKey: ["trip-activity", tripId] }),
      ]);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("inventory_items")
        .update({ trip_id: null })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["trip-items", tripId] }),
        qc.invalidateQueries({ queryKey: ["trip-totals", tripId] }),
        qc.invalidateQueries({ queryKey: ["trip-activity", tripId] }),
      ]);
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function reset() {
    if (baseline) setForm(baseline);
    setSaveError(null);
  }

  if (tripQuery.isLoading || (!trip && !tripQuery.isFetched)) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!trip) {
    return (
      <div className="space-y-4">
        <Link href="/trips" className="text-xs text-muted-foreground hover:underline">
          ← Trips
        </Link>
        <p className="text-sm text-muted-foreground">Trip not found.</p>
      </div>
    );
  }
  if (!form) return null;

  const tripCostsTotal =
    (Number(form.cost_flight) || 0) +
    (Number(form.cost_shipping) || 0) +
    (Number(form.cost_miles_or_gas) || 0) +
    (Number(form.cost_misc) || 0);
  const sumBuy = items.reduce((acc, i) => acc + (i.buy_cost_local ?? 0), 0);
  const sumTravel = items.reduce((acc, i) => acc + (i.allocated_travel ?? 0), 0);
  const buyCcy = totals?.buy_currency ?? items[0]?.buy_currency ?? "USD";

  const editable = isOpen;
  const fieldDisabled = !editable;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/trips" className="text-xs text-muted-foreground hover:underline">
          ← Trips
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
          <h1 className="text-2xl font-bold tracking-tight">{trip.label}</h1>
          <TripStatusToggle
            tripId={tripId}
            isOpen={isOpen}
            refresh={false}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["trip", tripId] });
              qc.invalidateQueries({ queryKey: ["trip-activity", tripId] });
              router.refresh();
            }}
          />
        </div>
      </div>

      {!editable && (
        <ClosedBanner
          tripId={tripId}
          onReopened={() => {
            qc.invalidateQueries({ queryKey: ["trip", tripId] });
            qc.invalidateQueries({ queryKey: ["trip-activity", tripId] });
            router.refresh();
          }}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form && dirty && editable) saveMutation.mutate(form);
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => update("label", e.target.value)}
                disabled={fieldDisabled}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(v) => update("direction", v as Enums<"trip_direction">)}
                disabled={fieldDisabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allocation method</Label>
              <Select
                value={form.allocation_method}
                onValueChange={(v) => update("allocation_method", v)}
                disabled={fieldDisabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOC_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departed on</Label>
              <Input
                type="date"
                value={form.departed_on}
                onChange={(e) => update("departed_on", e.target.value)}
                disabled={fieldDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Arrived on</Label>
              <Input
                type="date"
                value={form.arrived_on}
                onChange={(e) => update("arrived_on", e.target.value)}
                disabled={fieldDisabled}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trip costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <CostInput
                label="Flight"
                value={form.cost_flight}
                onChange={(v) => update("cost_flight", v)}
                disabled={fieldDisabled}
              />
              <CostInput
                label="Shipping"
                value={form.cost_shipping}
                onChange={(v) => update("cost_shipping", v)}
                disabled={fieldDisabled}
              />
              <CostInput
                label="Miles / gas"
                value={form.cost_miles_or_gas}
                onChange={(v) => update("cost_miles_or_gas", v)}
                disabled={fieldDisabled}
              />
              <CostInput
                label="Misc"
                value={form.cost_misc}
                onChange={(v) => update("cost_misc", v)}
                disabled={fieldDisabled}
              />
              <hr className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(tripCostsTotal, "USD")}
                </span>
              </div>
              <div className="space-y-2 pt-1">
                <Label className="text-xs">FX rate locked</Label>
                <Input
                  inputMode="decimal"
                  value={form.fx_rate_locked}
                  onChange={(e) => update("fx_rate_locked", e.target.value)}
                  disabled={fieldDisabled}
                  placeholder="optional"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Amortization summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                <Field label="Items" value={String(items.length)} />
                <Field label="Total buy" value={formatCurrency(sumBuy, buyCcy)} />
                <Field
                  label="Total travel allocated"
                  value={formatCurrency(sumTravel, buyCcy)}
                />
                <Field
                  label="Travel from view"
                  value={formatCurrency(totals?.total_travel_cost ?? null, buyCcy)}
                />
              </dl>
              <div className="mt-4 space-y-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={3}
                  disabled={fieldDisabled}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {saveError && (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        )}

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!dirty || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={saveMutation.isPending}
              >
                Discard
              </Button>
            )}
            {dirty && !saveMutation.isPending && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
          </div>
        )}
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items on this trip</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!items.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No items assigned to this trip.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-accent/40 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:px-6"
                >
                  <Link href={`/inventory/${item.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.cards?.canonical_name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.cards?.set_name ?? titleCase(item.cards?.game)}
                    </p>
                  </Link>
                  <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
                    + {formatCurrency(item.allocated_travel, item.buy_currency)} travel
                  </span>
                  <span className="text-sm tabular-nums">
                    {formatCurrency(item.buy_cost_local, item.buy_currency)}
                  </span>
                  <StatusBadge status={item.status} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!editable || removeItemMutation.isPending}
                    onClick={() => {
                      if (!editable) return;
                      if (
                        window.confirm(
                          `Remove "${item.cards?.canonical_name ?? "this item"}" from the trip?`,
                        )
                      ) {
                        removeItemMutation.mutate(item.id);
                      }
                    }}
                    title={
                      editable ? "Remove from trip" : "Reopen the trip to remove items"
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="text-base">Activity log</CardTitle>
            <span className="text-xs text-muted-foreground">
              {logOpen ? "Hide" : "Show"}
            </span>
          </button>
        </CardHeader>
        {logOpen && (
          <CardContent>
            <ActivityLog tripId={tripId} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ClosedBanner({
  tripId,
  onReopened,
}: {
  tripId: string;
  onReopened: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <span>🔒 This trip is closed. Reopen to edit.</span>
      <TripStatusToggle
        tripId={tripId}
        isOpen={false}
        refresh={false}
        onChange={onReopened}
      />
    </div>
  );
}

function CostInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 max-w-[140px] text-right tabular-nums"
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ActivityLog({ tripId }: { tripId: string }) {
  const query = useQuery({
    queryKey: ["trip-activity", tripId],
    queryFn: async () => {
      const supabase = createClient();
      return await tripActivityLog(supabase, tripId);
    },
  });

  if (query.isLoading)
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (query.error)
    return (
      <p className="text-sm text-destructive">
        Failed to load: {(query.error as Error).message}
      </p>
    );

  const rows = query.data ?? [];
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  const grouped = groupTravelReallocations(rows);

  return (
    <ol className="space-y-3">
      {grouped.map((entry, idx) => (
        <ActivityEntry key={idx} entry={entry} />
      ))}
    </ol>
  );
}

type GroupedEntry =
  | { kind: "single"; row: ActivityLogRow }
  | {
      kind: "reallocation";
      occurred_at: string;
      user_display_name: string | null;
      user_email: string | null;
      rows: ActivityLogRow[];
    };

function isAllocOnlyUpdate(row: ActivityLogRow): boolean {
  if (row.action !== "UPDATE" || row.table_name !== "inventory_items") return false;
  const fc = row.field_changes;
  if (!fc || typeof fc !== "object") return false;
  const keys = Object.keys(fc);
  return keys.length > 0 && keys.every((k) => k === "allocated_travel");
}

function groupTravelReallocations(rows: ActivityLogRow[]): GroupedEntry[] {
  const out: GroupedEntry[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (isAllocOnlyUpdate(r)) {
      const sameSecond = r.occurred_at.slice(0, 19);
      const bucket: ActivityLogRow[] = [r];
      let j = i + 1;
      while (
        j < rows.length &&
        isAllocOnlyUpdate(rows[j]) &&
        rows[j].occurred_at.slice(0, 19) === sameSecond
      ) {
        bucket.push(rows[j]);
        j += 1;
      }
      if (bucket.length > 1) {
        out.push({
          kind: "reallocation",
          occurred_at: r.occurred_at,
          user_display_name: r.user_display_name,
          user_email: r.user_email,
          rows: bucket,
        });
        i = j;
        continue;
      }
    }
    out.push({ kind: "single", row: r });
    i += 1;
  }
  return out;
}

function ActivityEntry({ entry }: { entry: GroupedEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (entry.kind === "reallocation") {
    return (
      <li className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDateTime(entry.occurred_at)}
          </span>
          <UserLabel
            displayName={entry.user_display_name}
            email={entry.user_email}
          />
        </div>
        <p className="mt-1">
          {entry.rows.length} item{entry.rows.length === 1 ? "" : "s"} had travel
          reallocated
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-2 text-xs text-primary hover:underline"
          >
            {expanded ? "[hide]" : "[show all]"}
          </button>
        </p>
        {expanded && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {entry.rows.map((r, idx) => {
              const fc =
                r.field_changes && typeof r.field_changes === "object"
                  ? (r.field_changes as Record<string, { from: unknown; to: unknown }>)
                  : {};
              const change = fc.allocated_travel;
              const from = change?.from;
              const to = change?.to;
              return (
                <li key={idx} className="tabular-nums">
                  {r.item_name ?? "(item)"}: {formatNumber(from)} → {formatNumber(to)}
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  const r = entry.row;
  return (
    <li className="rounded-md border bg-background px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {formatDateTime(r.occurred_at)}
        </span>
        <UserLabel displayName={r.user_display_name} email={r.user_email} />
      </div>
      <div className="mt-1">{renderHeadline(r)}</div>
      {r.action === "UPDATE" && r.field_changes && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {Object.entries(r.field_changes as Record<string, unknown>).map(
            ([key, v]) => {
              const change = v as { from: unknown; to: unknown };
              return (
                <li key={key} className="tabular-nums">
                  {renderFieldDiff(key, change.from, change.to)}
                </li>
              );
            },
          )}
        </ul>
      )}
    </li>
  );
}

function renderHeadline(r: ActivityLogRow): React.ReactNode {
  if (r.action === "INSERT") {
    if (r.table_name === "trips") return "Created the trip";
    if (r.table_name === "inventory_items")
      return `Added "${r.item_name ?? "item"}" to the trip`;
  }
  if (r.action === "DELETE") {
    if (r.table_name === "inventory_items")
      return `Removed "${r.item_name ?? "item"}" from the trip`;
    if (r.table_name === "trips") return "Deleted the trip";
  }
  if (r.action === "UPDATE") {
    if (r.table_name === "inventory_items") {
      const fc = (r.field_changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(fc);
      const name = r.item_name ?? "item";
      if (keys.length === 1) {
        return `${name}: ${humanField(keys[0])} changed`;
      }
      return `${name}: ${keys.length} fields changed`;
    }
    if (r.table_name === "trips") return "Updated the trip";
  }
  return `${r.action} on ${r.table_name}`;
}

function renderFieldDiff(key: string, from: unknown, to: unknown): React.ReactNode {
  if (key === "closed_at") {
    if (from == null && to != null)
      return `closed_at: open → closed at ${formatDateTime(String(to))}`;
    if (from != null && to == null) return "closed_at: closed → reopened";
  }
  const isMoney = key.startsWith("cost_") || key === "allocated_travel";
  const fmt = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (isMoney) {
      const n = Number(v);
      if (!Number.isNaN(n)) return formatCurrency(n, "USD");
    }
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  return `${humanField(key)}: ${fmt(from)} → ${fmt(to)}`;
}

function humanField(key: string): string {
  const map: Record<string, string> = {
    cost_flight: "cost_flight",
    cost_shipping: "cost_shipping",
    cost_miles_or_gas: "cost_miles_or_gas",
    cost_misc: "cost_misc",
    fx_rate_locked: "fx_rate_locked",
    departed_on: "departed_on",
    arrived_on: "arrived_on",
    allocation_method: "allocation_method",
    closed_at: "closed_at",
    direction: "direction",
    label: "label",
    notes: "notes",
    trip_id: "trip_id",
    allocated_travel: "allocated_travel",
    buy_cost_local: "buy_cost_local",
    buy_currency: "buy_currency",
  };
  return map[key] ?? key;
}

function formatNumber(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return formatCurrency(n, "USD");
}

function UserLabel({
  displayName,
  email,
}: {
  displayName: string | null;
  email: string | null;
}) {
  const isSystem =
    !displayName || displayName.toLowerCase() === "system" || !email;
  if (isSystem) {
    return (
      <span className="text-xs italic text-muted-foreground">System</span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground" title={email ?? undefined}>
      {displayName}
    </span>
  );
}

