import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  } | null;
  const trip = (item.trips as unknown) as {
    id: string;
    label: string;
    direction: string;
    departed_on: string | null;
  } | null;

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
                    ? formatCurrency(item.listed_price, item.sell_currency ?? "USD")
                    : "—"
                }
              />
              <Field
                label="Sold"
                value={
                  item.sold_price != null
                    ? formatCurrency(item.sold_price, item.sell_currency ?? "USD")
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
            {card?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image_url}
                alt={card.name}
                className="mb-3 max-h-64 w-full rounded-md border object-contain"
              />
            )}
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
