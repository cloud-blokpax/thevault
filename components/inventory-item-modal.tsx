"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZoomableCardImage } from "@/components/ui/zoomable-card-image";
import { CardSearchInput, type CardHit } from "@/components/card-search-input";
import { AlertTriangle } from "lucide-react";
import {
  getInventoryItemDetail,
  inventoryItemActivityLog,
  type ActivityLogRow,
  type InventoryItemDetail,
} from "@/lib/supabase/rpc";
import { fxRateOn } from "@/lib/supabase/fx";
import { cn, formatCurrency, formatDateTime, titleCase } from "@/lib/utils";
import type { Enums } from "@/types/database";

const STATUSES: Enums<"inventory_status">[] = [
  "pending",
  "bought",
  "in_transit",
  "landed",
  "listed",
  "sold",
  "cancelled",
];

const CURRENCIES: Enums<"currency_code">[] = ["USD", "EUR", "GBP", "JPY", "CAD"];

const STATUS_PILL_CLASSES: Record<Enums<"inventory_status">, string> = {
  pending: "bg-slate-200 text-slate-900",
  bought: "bg-amber-200 text-amber-900",
  in_transit: "bg-blue-200 text-blue-900",
  landed: "bg-cyan-200 text-cyan-900",
  listed: "bg-violet-200 text-violet-900",
  sold: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-rose-200 text-rose-900",
};

type OpenTrip = {
  id: string;
  label: string;
  direction: string;
  departed_on: string | null;
  arrived_on: string | null;
  closed_at: string | null;
};

type FormState = {
  status: Enums<"inventory_status">;
  buy_cost_local: string;
  buy_currency: Enums<"currency_code">;
  buy_location: string;
  source: string;
  bought_on: string;
  partner_owner: string;
  trip_id: string;
  target_market: string;
  sell_currency: Enums<"currency_code"> | "";
  listed_price: string;
  listed_at: string;
  sold_price: string;
  sold_at: string;
  sold_to: string;
  allocated_travel: string;
  allocated_travel_manual: boolean;
  fx_rate_locked: string;
  margin_cd_override: string;
  margin_pp_override: string;
  notes: string;
};

const TRIP_NONE = "_none";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDateTimeToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isoToDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : "";
}

function fractionToPercentString(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(Math.round(v * 10000) / 100);
}

function percentStringToFraction(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.round((n / 100) * 10000) / 10000;
}

function detailToForm(detail: InventoryItemDetail): FormState {
  const it = detail.item;
  return {
    status: it.status,
    buy_cost_local: it.buy_cost_local != null ? String(it.buy_cost_local) : "",
    buy_currency: it.buy_currency,
    buy_location: it.buy_location ?? "",
    source: it.source ?? "",
    bought_on: isoToDate(it.bought_on),
    partner_owner: it.partner_owner ?? "",
    trip_id: it.trip_id ?? "",
    target_market: it.target_market ?? "",
    sell_currency: it.sell_currency ?? "",
    listed_price: it.listed_price != null ? String(it.listed_price) : "",
    listed_at: isoToLocalDateTime(it.listed_at),
    sold_price: it.sold_price != null ? String(it.sold_price) : "",
    sold_at: isoToLocalDateTime(it.sold_at),
    sold_to: it.sold_to ?? "",
    allocated_travel:
      it.allocated_travel != null ? String(it.allocated_travel) : "",
    allocated_travel_manual: it.allocated_travel_manual,
    fx_rate_locked:
      it.fx_rate_locked != null ? String(it.fx_rate_locked) : "",
    margin_cd_override: fractionToPercentString(it.margin_cd_override),
    margin_pp_override: fractionToPercentString(it.margin_pp_override),
    notes: it.notes ?? "",
  };
}

function buildPatch(
  original: FormState,
  next: FormState,
): { patch: Record<string, unknown>; changedKeys: string[] } {
  const patch: Record<string, unknown> = {};
  const changed: string[] = [];

  function set(key: string, value: unknown) {
    patch[key] = value;
    changed.push(key);
  }

  if (next.status !== original.status) set("status", next.status);

  if (next.buy_cost_local !== original.buy_cost_local) {
    const n = next.buy_cost_local === "" ? 0 : Number(next.buy_cost_local);
    if (!Number.isNaN(n)) set("buy_cost_local", n);
  }
  if (next.buy_currency !== original.buy_currency) {
    set("buy_currency", next.buy_currency);
  }
  if (next.buy_location !== original.buy_location) {
    set("buy_location", next.buy_location.trim() || null);
  }
  if (next.source !== original.source) {
    set("source", next.source.trim() || null);
  }
  if (next.bought_on !== original.bought_on) {
    set("bought_on", next.bought_on || null);
  }
  if (next.partner_owner !== original.partner_owner) {
    set("partner_owner", next.partner_owner.trim() || null);
  }
  if (next.trip_id !== original.trip_id) {
    set("trip_id", next.trip_id || null);
  }

  if (next.target_market !== original.target_market) {
    set("target_market", next.target_market.trim() || null);
  }
  if (next.sell_currency !== original.sell_currency) {
    set("sell_currency", next.sell_currency || null);
  }
  if (next.listed_price !== original.listed_price) {
    set(
      "listed_price",
      next.listed_price === "" ? null : Number(next.listed_price),
    );
  }
  if (next.listed_at !== original.listed_at) {
    set("listed_at", localDateTimeToISO(next.listed_at));
  }
  if (next.sold_price !== original.sold_price) {
    set(
      "sold_price",
      next.sold_price === "" ? null : Number(next.sold_price),
    );
  }
  if (next.sold_at !== original.sold_at) {
    set("sold_at", localDateTimeToISO(next.sold_at));
  }
  if (next.sold_to !== original.sold_to) {
    set("sold_to", next.sold_to.trim() || null);
  }

  if (next.allocated_travel_manual !== original.allocated_travel_manual) {
    set("allocated_travel_manual", next.allocated_travel_manual);
  }
  if (
    next.allocated_travel_manual &&
    next.allocated_travel !== original.allocated_travel
  ) {
    set(
      "allocated_travel",
      next.allocated_travel === "" ? 0 : Number(next.allocated_travel),
    );
  }
  if (next.fx_rate_locked !== original.fx_rate_locked) {
    set(
      "fx_rate_locked",
      next.fx_rate_locked === "" ? null : Number(next.fx_rate_locked),
    );
  }
  if (next.margin_cd_override !== original.margin_cd_override) {
    set("margin_cd_override", percentStringToFraction(next.margin_cd_override));
  }
  if (next.margin_pp_override !== original.margin_pp_override) {
    set("margin_pp_override", percentStringToFraction(next.margin_pp_override));
  }
  if (next.notes !== original.notes) {
    set("notes", next.notes.trim() || null);
  }

  return { patch, changedKeys: changed };
}

function applyStatusPrefill(
  current: FormState,
  newStatus: Enums<"inventory_status">,
): FormState {
  const next = { ...current, status: newStatus };
  if (newStatus === "bought" && !next.bought_on) {
    const today = new Date();
    next.bought_on = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }
  if (newStatus === "listed" && !next.listed_at) {
    next.listed_at = isoToLocalDateTime(new Date().toISOString());
  }
  if (newStatus === "sold" && !next.sold_at) {
    next.sold_at = isoToLocalDateTime(new Date().toISOString());
  }
  return next;
}

export function InventoryItemModal({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const open = itemId !== null;
  const [dirty, setDirty] = useState(false);

  function attemptClose() {
    if (dirty) {
      const ok = window.confirm("Discard changes?");
      if (!ok) return;
    }
    setDirty(false);
    onClose();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) attemptClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-background shadow-xl focus:outline-none"
        >
          {itemId && (
            <ItemModalBody
              key={itemId}
              itemId={itemId}
              onDirtyChange={setDirty}
              onCloseRequest={attemptClose}
            />
          )}
          <button
            type="button"
            onClick={attemptClose}
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ItemModalBody({
  itemId,
  onDirtyChange,
  onCloseRequest,
}: {
  itemId: string;
  onDirtyChange: (dirty: boolean) => void;
  onCloseRequest: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["inventory-item-detail", itemId],
    queryFn: async () => {
      const supabase = createClient();
      const data = await getInventoryItemDetail(supabase, itemId);
      return data;
    },
  });

  const detail = detailQuery.data ?? null;
  const [showRelink, setShowRelink] = useState(false);
  const [relinkError, setRelinkError] = useState<string | null>(null);

  const relinkMutation = useMutation({
    mutationFn: async (newCardId: string) => {
      const supabase = createClient();
      const client = supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { error } = await client.rpc("relink_inventory_card", {
        p_inventory_id: itemId,
        p_new_card_id: newCardId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setShowRelink(false);
      setRelinkError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory-item-detail", itemId] }),
        qc.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
    },
    onError: (e: Error) => setRelinkError(e.message),
  });

  const tripsQuery = useQuery({
    queryKey: ["open-trips"],
    queryFn: async () => {
      const supabase = createClient();
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => Promise<{
            data: OpenTrip[] | null;
            error: { message: string } | null;
          }>;
        };
      };
      const { data, error } = await client.from("open_trips").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as OpenTrip[];
    },
  });

  useEffect(() => {
    if (detail) {
      const f = detailToForm(detail);
      setForm(f);
      setOriginal(f);
      setSaveError(null);
    }
  }, [detail]);

  const dirty = useMemo(() => {
    if (!form || !original) return false;
    const { changedKeys } = buildPatch(original, form);
    return changedKeys.length > 0;
  }, [form, original]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const saveMutation = useMutation({
    mutationFn: async (state: FormState) => {
      if (!original) throw new Error("Form not initialized");
      const { patch, changedKeys } = buildPatch(original, state);
      if (changedKeys.length === 0) return { changed: 0 };
      const supabase = createClient();

      const lockedAlready = original.fx_rate_locked.trim() !== "";
      const userTouchedLocked = "fx_rate_locked" in patch;
      if (
        !lockedAlready &&
        !userTouchedLocked &&
        state.bought_on &&
        /^\d{4}-\d{2}-\d{2}$/.test(state.bought_on) &&
        state.buy_currency
      ) {
        const otherCcy = state.buy_currency === "USD" ? "EUR" : "USD";
        if (otherCcy !== state.buy_currency) {
          try {
            const fx = await fxRateOn(
              supabase,
              state.bought_on,
              state.buy_currency,
              otherCcy,
            );
            if (fx) {
              patch.fx_rate_locked = Number(fx.rate);
              changedKeys.push("fx_rate_locked");
            }
          } catch {
            /* non-fatal: skip locking */
          }
        }
      }

      const { error } = await supabase
        .from("inventory_items")
        .update(patch as never)
        .eq("id", itemId);
      if (error) throw new Error(error.message);
      return { changed: changedKeys.length };
    },
    onSuccess: async (res) => {
      setSaveError(null);
      if (res.changed > 0) {
        setSavedFlash(
          `Saved · ${res.changed} field${res.changed === 1 ? "" : "s"} updated`,
        );
        window.setTimeout(() => setSavedFlash(null), 2500);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory-item-detail", itemId] }),
        qc.invalidateQueries({ queryKey: ["inventory-item-activity", itemId] }),
        qc.invalidateQueries({ queryKey: ["inventory"] }),
        qc.invalidateQueries({ queryKey: ["open-trips"] }),
      ]);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setStatus(newStatus: Enums<"inventory_status">) {
    setForm((f) => (f ? applyStatusPrefill(f, newStatus) : f));
  }

  if (detailQuery.isLoading || !form || !detail) {
    return (
      <div className="p-6">
        <Dialog.Title className="sr-only">Loading item</Dialog.Title>
        <Dialog.Description className="sr-only">
          Loading inventory item details
        </Dialog.Description>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (detailQuery.error) {
    return (
      <div className="p-6">
        <Dialog.Title className="text-base font-semibold">
          Failed to load item
        </Dialog.Title>
        <Dialog.Description className="text-xs text-muted-foreground">
          {(detailQuery.error as Error).message}
        </Dialog.Description>
      </div>
    );
  }

  const card = detail.card;
  const trip = detail.trip;
  const pricing = detail.pricing;
  const orphan =
    !!card && (!card.image_url || !card.set_name || !card.set_code);

  const openTrips = tripsQuery.data ?? [];
  const tripOptions: { value: string; label: string }[] = [
    { value: TRIP_NONE, label: "— No trip —" },
    ...openTrips.map((t) => ({
      value: t.id,
      label: `${t.label}${t.direction ? ` (${formatDirection(t.direction)})` : ""}`,
    })),
  ];
  if (trip && trip.closed_at && !openTrips.some((t) => t.id === trip.id)) {
    tripOptions.push({
      value: trip.id,
      label: `${trip.label} (Closed)`,
    });
  }

  const tcgUrl = card
    ? `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(
        card.name,
      )}`
    : null;
  const cmGameSlug =
    card?.game === "one_piece" ? "OnePiece" : card?.game === "magic" ? "Magic" : "Pokemon";
  const cmUrl = card
    ? `https://www.cardmarket.com/en/${cmGameSlug}/Products/Search?searchString=${encodeURIComponent(
        card.name,
      )}`
    : null;

  const headerTitle = card
    ? `${card.set_name ?? titleCase(card.game)}${
        card.card_number ? ` #${card.card_number}` : ""
      } ${card.name}${card.is_foil ? " ★" : ""}`
    : "Unknown card";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (form && dirty) saveMutation.mutate(form);
      }}
      className="flex flex-col"
    >
      <div className="flex items-start gap-3 border-b px-5 py-4 pr-12">
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-lg font-bold tracking-tight">
            {headerTitle}
          </Dialog.Title>
          <Dialog.Description className="truncate text-xs text-muted-foreground">
            {card?.rarity ? `${card.rarity} · ` : ""}
            {card?.language?.toUpperCase() ?? ""}
            {card?.is_sealed ? " · Sealed" : ""}
          </Dialog.Description>
        </div>
      </div>

      {orphan && (
        <div className="border-b bg-amber-50 px-5 py-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                This inventory item has limited card data
              </p>
              <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
                The linked card record is missing
                {!card?.image_url ? " image" : ""}
                {!card?.set_name ? ", set name" : ""}
                {!card?.set_code ? ", set code" : ""}
                .
              </p>
              {!showRelink && (
                <button
                  type="button"
                  onClick={() => setShowRelink(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-100"
                >
                  🔗 Link to a richer card record
                </button>
              )}
              {showRelink && (
                <div className="mt-2 rounded-md border border-amber-300 bg-background p-2 dark:border-amber-800">
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    Search for the correct card and pick one to relink.
                  </p>
                  <CardSearchInput
                    onSelect={(c: CardHit) => {
                      if (
                        window.confirm(
                          `Relink this inventory item to "${c.name}"${c.set_name ? ` (${c.set_name})` : ""}? The orphan card record will be deleted if no other items reference it.`,
                        )
                      ) {
                        relinkMutation.mutate(c.id);
                      }
                    }}
                    placeholder="Search cards…"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRelink(false);
                        setRelinkError(null);
                      }}
                      className="text-[11px] text-muted-foreground hover:underline"
                    >
                      Cancel
                    </button>
                    {relinkMutation.isPending && (
                      <span className="text-[11px] text-muted-foreground">
                        Relinking…
                      </span>
                    )}
                    {relinkError && (
                      <span className="text-[11px] text-destructive">
                        {relinkError}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 p-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <div className="flex justify-center md:justify-start">
            <ZoomableCardImage
              src={card?.image_url}
              alt={card?.name ?? "Card image"}
              width={220}
              height={308}
              fallbackText={card?.name ?? "No image"}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{titleCase(card?.game)}</p>
            {card?.set_name && <p>{card.set_name}</p>}
            {card?.set_code && <p>{card.set_code}</p>}
            {card?.card_number && <p>#{card.card_number}</p>}
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            {tcgUrl && (
              <a
                href={tcgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> TCGplayer
              </a>
            )}
            {cmUrl && (
              <a
                href={cmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Cardmarket
              </a>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <SectionHeading>Status</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => {
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      active
                        ? STATUS_PILL_CLASSES[s]
                        : "border bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {titleCase(s)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <SectionHeading>Buy</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cost">
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    value={form.buy_cost_local}
                    onChange={(e) => update("buy_cost_local", e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Select
                    value={form.buy_currency}
                    onValueChange={(v) =>
                      update("buy_currency", v as Enums<"currency_code">)
                    }
                  >
                    <SelectTrigger className="w-[88px]">
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
                <BuyFxPreview
                  amount={form.buy_cost_local}
                  buyCurrency={form.buy_currency}
                  date={form.bought_on}
                  lockedRate={form.fx_rate_locked}
                />
              </Field>
              <Field label="Bought on">
                <Input
                  type="date"
                  value={form.bought_on}
                  onChange={(e) => update("bought_on", e.target.value)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={form.buy_location}
                  onChange={(e) => update("buy_location", e.target.value)}
                />
              </Field>
              <Field label="Source">
                <Input
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                />
              </Field>
              <Field label="Owner (partner)">
                <Input
                  value={form.partner_owner}
                  onChange={(e) => update("partner_owner", e.target.value)}
                  placeholder="cd / pp / …"
                />
              </Field>
              <Field label="Trip">
                <Select
                  value={form.trip_id || TRIP_NONE}
                  onValueChange={(v) =>
                    update("trip_id", v === TRIP_NONE ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tripOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <SectionHeading>Sell</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Target market">
                <Input
                  value={form.target_market}
                  onChange={(e) => update("target_market", e.target.value)}
                  placeholder="EU / US / JP"
                />
              </Field>
              <Field label="Sell currency">
                <Select
                  value={form.sell_currency || "_none"}
                  onValueChange={(v) =>
                    update(
                      "sell_currency",
                      v === "_none" ? "" : (v as Enums<"currency_code">),
                    )
                  }
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
              </Field>
              <Field label="Listed price">
                <Input
                  inputMode="decimal"
                  value={form.listed_price}
                  onChange={(e) => update("listed_price", e.target.value)}
                />
              </Field>
              <Field label="Listed at">
                <Input
                  type="datetime-local"
                  value={form.listed_at}
                  onChange={(e) => update("listed_at", e.target.value)}
                />
              </Field>
              <Field label="Sold price">
                <Input
                  inputMode="decimal"
                  value={form.sold_price}
                  onChange={(e) => update("sold_price", e.target.value)}
                />
              </Field>
              <Field label="Sold at">
                <Input
                  type="datetime-local"
                  value={form.sold_at}
                  onChange={(e) => update("sold_at", e.target.value)}
                />
              </Field>
              <Field label="Sold to" className="sm:col-span-2">
                <Input
                  value={form.sold_to}
                  onChange={(e) => update("sold_to", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeading>Economics</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 sm:col-span-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Travel allocated
                  </span>
                  {form.allocated_travel_manual ? (
                    <Input
                      inputMode="decimal"
                      value={form.allocated_travel}
                      onChange={(e) =>
                        update("allocated_travel", e.target.value)
                      }
                      className="h-8 max-w-[160px] text-right tabular-nums"
                    />
                  ) : (
                    <span className="text-sm font-medium tabular-nums">
                      {formatCurrency(
                        Number(form.allocated_travel || 0),
                        form.buy_currency,
                      )}{" "}
                      <span className="text-xs text-muted-foreground">
                        (auto)
                      </span>
                    </span>
                  )}
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.allocated_travel_manual}
                    onChange={(e) =>
                      update("allocated_travel_manual", e.target.checked)
                    }
                    className="h-3.5 w-3.5"
                  />
                  Override manually
                </label>
                {!form.allocated_travel_manual && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Computed from trip costs and allocation method.
                  </p>
                )}
              </div>
              <Field label="FX rate locked">
                <Input
                  inputMode="decimal"
                  value={form.fx_rate_locked}
                  onChange={(e) => update("fx_rate_locked", e.target.value)}
                  placeholder="optional"
                />
              </Field>
              <div />
              <Field label="CD margin (%)">
                <Input
                  inputMode="decimal"
                  value={form.margin_cd_override}
                  onChange={(e) =>
                    update("margin_cd_override", e.target.value)
                  }
                  placeholder="default 20"
                />
              </Field>
              <Field label="PP margin (%)">
                <Input
                  inputMode="decimal"
                  value={form.margin_pp_override}
                  onChange={(e) =>
                    update("margin_pp_override", e.target.value)
                  }
                  placeholder="default 10"
                />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeading>Live price guidance</SectionHeading>
            <PricingDisplay pricing={pricing} cardId={card?.id ?? null} />
          </div>

          <div>
            <SectionHeading>Notes</SectionHeading>
            <Textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setLogOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40"
            >
              <span className="font-medium">
                {logOpen ? "▾" : "▸"} Activity log
              </span>
              <span className="text-xs text-muted-foreground">
                {logOpen ? "Hide" : "Show"}
              </span>
            </button>
            {logOpen && (
              <div className="mt-2">
                <ActivityLog itemId={itemId} />
              </div>
            )}
          </div>

          {saveError && (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
          {savedFlash && (
            <p className="text-sm text-emerald-600" role="status">
              {savedFlash}
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur">
        <Button
          type="button"
          variant="outline"
          onClick={onCloseRequest}
          disabled={saveMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function BuyFxPreview({
  amount,
  buyCurrency,
  date,
  lockedRate,
}: {
  amount: string;
  buyCurrency: Enums<"currency_code">;
  date: string;
  lockedRate: string;
}) {
  const value = Number(amount);
  const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const otherCcy = buyCurrency === "USD" ? "EUR" : "USD";
  const showLocked = lockedRate.trim() !== "" && !Number.isNaN(Number(lockedRate));

  const fxQuery = useQuery({
    queryKey: ["fx-rate-on", useDate, buyCurrency, otherCcy],
    enabled: !!useDate && !showLocked && buyCurrency !== otherCcy,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      return await fxRateOn(supabase, useDate as string, buyCurrency, otherCcy);
    },
  });

  if (Number.isNaN(value) || amount === "") return null;
  if (buyCurrency === otherCcy) return null;

  let rate: number | null = null;
  let label = "";
  if (showLocked) {
    rate = Number(lockedRate);
    label = "locked";
  } else if (fxQuery.data) {
    rate = Number(fxQuery.data.rate);
    label = fxQuery.data.is_exact_match
      ? `${fxQuery.data.rate_date}`
      : `${fxQuery.data.rate_date} (${fxQuery.data.days_back}d back)`;
  }

  if (rate == null) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {fxQuery.isFetching ? "Looking up FX…" : "Set bought-on date for FX preview"}
      </p>
    );
  }

  const converted = value * rate;
  return (
    <p className="text-[11px] text-muted-foreground">
      ≈ {formatCurrency(converted, otherCcy)}{" "}
      <span className="text-[10px]">
        @ {rate.toFixed(4)} ({label})
      </span>
    </p>
  );
}

function formatDirection(d: string) {
  if (d === "US_TO_EU") return "US → EU";
  if (d === "EU_TO_US") return "EU → US";
  return d;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PricingDisplay({
  pricing,
  cardId,
}: {
  pricing: InventoryItemDetail["pricing"];
  cardId: string | null;
}) {
  const us = pricing?.us_market;
  const eu = pricing?.eu_market;
  if (us == null && eu == null) {
    return (
      <p className="text-sm text-muted-foreground">
        No recent prices for this card.
      </p>
    );
  }
  const parts: string[] = [];
  if (us != null) {
    const date = pricing?.us_captured_at
      ? formatDateShort(pricing.us_captured_at)
      : null;
    parts.push(
      `US market: ${formatCurrency(us, pricing?.us_currency ?? "USD")}${
        date ? ` (${date})` : ""
      }`,
    );
  }
  if (eu != null) {
    const date = pricing?.eu_captured_at
      ? formatDateShort(pricing.eu_captured_at)
      : null;
    parts.push(
      `EU market: ${formatCurrency(eu, pricing?.eu_currency ?? "EUR")}${
        date ? ` (${date})` : ""
      }`,
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <p>{parts.join(" · ")}</p>
      {cardId && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => {
            window.alert("Card detail editor coming soon.");
          }}
        >
          Edit linked card →
        </button>
      )}
    </div>
  );
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(d);
}

function ActivityLog({ itemId }: { itemId: string }) {
  const query = useQuery({
    queryKey: ["inventory-item-activity", itemId],
    queryFn: async () => {
      const supabase = createClient();
      return await inventoryItemActivityLog(supabase, itemId);
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
    <ol className="space-y-2">
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
          Travel reallocated across {entry.rows.length} item
          {entry.rows.length === 1 ? "" : "s"}
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
              return (
                <li key={idx} className="tabular-nums">
                  {r.item_name ?? "(item)"}: {formatNumber(change?.from)} →{" "}
                  {formatNumber(change?.to)}
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
    if (r.table_name === "inventory_items") return "Item created";
    return `Created in ${r.table_name}`;
  }
  if (r.action === "DELETE") {
    if (r.table_name === "inventory_items") return "Item deleted";
    return `Deleted in ${r.table_name}`;
  }
  if (r.action === "UPDATE") {
    if (r.table_name === "inventory_items") {
      const fc = (r.field_changes as Record<string, unknown>) ?? {};
      const keys = Object.keys(fc);
      if (keys.length === 1) {
        return `${keys[0]} changed`;
      }
      return `${keys.length} fields changed`;
    }
    return `Updated ${r.table_name}`;
  }
  return `${r.action} on ${r.table_name}`;
}

function renderFieldDiff(key: string, from: unknown, to: unknown): React.ReactNode {
  const isMoney =
    key.startsWith("cost_") ||
    key === "allocated_travel" ||
    key === "buy_cost_local" ||
    key === "listed_price" ||
    key === "sold_price";
  const fmt = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (isMoney) {
      const n = Number(v);
      if (!Number.isNaN(n)) return formatCurrency(n, "USD");
    }
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  return `${key}: ${fmt(from)} → ${fmt(to)}`;
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
    return <span className="text-xs italic text-muted-foreground">System</span>;
  }
  return (
    <span className="text-xs text-muted-foreground" title={email ?? undefined}>
      {displayName}
    </span>
  );
}
