import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/utils";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ATTRIBUTE_LABELS: Record<string, string> = {
  gh_hp: "HP",
  gh_supertype: "Type",
  gh_subtype: "Subtype",
  gh_rarity: "Rarity",
  gh_attacks: "Attacks",
  gh_artist: "Artist",
  optcg_color: "Color",
  optcg_type: "Type",
  optcg_cost: "Cost",
  optcg_power: "Power",
  optcg_counter: "Counter",
  optcg_attribute: "Attribute",
};

const ATTRIBUTE_KEYS_BY_GAME: Record<string, string[]> = {
  pokemon: ["gh_hp", "gh_supertype", "gh_subtype", "gh_rarity", "gh_attacks", "gh_artist"],
  one_piece: ["optcg_color", "optcg_type", "optcg_cost", "optcg_power", "optcg_counter", "optcg_attribute"],
};

function attributePills(
  game: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
): { key: string; label: string; value: string }[] {
  if (!attributes) return [];
  const keys = ATTRIBUTE_KEYS_BY_GAME[game ?? ""] ?? [];
  return keys
    .map((k) => {
      const raw = (attributes as Record<string, unknown>)[k];
      if (raw === null || raw === undefined || raw === "") return null;
      let value: string;
      if (Array.isArray(raw)) {
        if (raw.length === 0) return null;
        value = raw
          .map((item) => {
            if (item && typeof item === "object" && "name" in (item as object)) {
              const o = item as { name?: unknown; damage?: unknown };
              const n = typeof o.name === "string" ? o.name : "";
              const d = typeof o.damage === "string" || typeof o.damage === "number" ? ` (${o.damage})` : "";
              return `${n}${d}`.trim();
            }
            return String(item);
          })
          .filter(Boolean)
          .join(", ");
        if (!value) return null;
      } else if (typeof raw === "object") {
        value = JSON.stringify(raw);
      } else {
        value = String(raw);
      }
      return { key: k, label: ATTRIBUTE_LABELS[k] ?? k, value };
    })
    .filter((p): p is { key: string; label: string; value: string } => p !== null);
}

export default async function InventoryDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: item, error } = await supabase
    .from("inventory_items")
    .select(
      "*, cards(*), trips(id, label, direction, departed_on), profiles!inventory_items_consignor_id_fkey(display_name, email)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw error;
  if (!item) notFound();

  const card = (item.cards as unknown) as {
    name: string;
    set_name: string | null;
    set_code: string | null;
    card_number: string | null;
    rarity: string | null;
    language: string;
    is_foil: boolean;
    is_sealed: boolean;
    image_url: string | null;
    game: string;
    attributes: Record<string, unknown> | null;
  } | null;
  const trip = (item.trips as unknown) as {
    id: string;
    label: string;
    direction: string;
    departed_on: string | null;
  } | null;
  const pills = attributePills(card?.game, card?.attributes);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/inventory" className="text-xs text-muted-foreground hover:underline">
            ← Inventory
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {card?.name ?? "Unknown card"}
            {card?.is_foil && <span className="ml-1 text-amber-600">★</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {card?.set_name ?? titleCase(card?.game)}
            {card?.set_code ? ` · ${card.set_code}` : ""}
            {card?.card_number ? ` · #${card.card_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.status} />
          <Button asChild size="sm">
            <Link href={`/inventory/${item.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 justify-center sm:justify-start">
            {card?.image_url ? (
              <Image
                src={card.image_url}
                alt={card.name}
                width={240}
                height={336}
                unoptimized
                className="rounded-md border bg-muted object-contain"
                style={{ width: 240, height: "auto" }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-md border bg-muted p-3 text-center text-sm font-medium text-muted-foreground"
                style={{ width: 240, height: 336 }}
              >
                {card?.name ?? "No image"}
              </div>
            )}
          </div>
          {pills.length > 0 && (
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Card attributes
              </p>
              <div className="flex flex-wrap gap-2">
                {pills.map((p) => (
                  <span
                    key={p.key}
                    className="inline-flex items-baseline gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                  >
                    <span className="font-medium uppercase tracking-wide text-muted-foreground">
                      {p.label}
                    </span>
                    <span className="font-medium">{p.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cost & price</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Field label="Buy cost" value={formatCurrency(item.buy_cost_local, item.buy_currency)} />
              <Field label="Allocated travel" value={formatCurrency(item.allocated_travel, item.buy_currency)} />
              <Field
                label="FX locked"
                value={item.fx_rate_locked != null ? item.fx_rate_locked.toFixed(4) : "—"}
              />
              <Field label="Source" value={item.source ?? "—"} />
              <Field
                label="Listed"
                value={
                  item.listed_price != null
                    ? formatCurrency(item.listed_price, item.sell_currency ?? "EUR")
                    : "—"
                }
              />
              <Field
                label="Sold"
                value={
                  item.sold_price != null
                    ? formatCurrency(item.sold_price, item.sell_currency ?? "EUR")
                    : "—"
                }
              />
              <Field label="Sold to" value={item.sold_to ?? "—"} />
              <Field label="Sold at" value={formatDateTime(item.sold_at)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Card details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Field label="Game" value={titleCase(card?.game)} />
              <Field label="Rarity" value={card?.rarity ?? "—"} />
              <Field label="Language" value={card?.language?.toUpperCase() ?? "—"} />
              <Field label="Foil" value={card?.is_foil ? "Yes" : "No"} />
              <Field label="Sealed" value={card?.is_sealed ? "Yes" : "No"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip & ownership</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Field
                label="Trip"
                value={
                  trip ? (
                    <Link href={`/trips/${trip.id}`} className="text-primary hover:underline">
                      {trip.label}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Partner owner" value={item.partner_owner ?? "—"} />
              <Field label="Bought on" value={formatDate(item.bought_on)} />
              <Field label="Buy location" value={item.buy_location ?? "—"} />
              <Field label="Target market" value={item.target_market ?? "—"} />
              <Field label="Visibility (buyer)" value={item.visibility_buyer ? "Yes" : "No"} />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {item.notes ?? "No notes."}
            </p>
          </CardContent>
        </Card>
      </div>
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
