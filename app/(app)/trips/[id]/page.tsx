import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: trip, error }, { data: totals }, { data: items }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("trip_totals").select("*").eq("trip_id", params.id).maybeSingle(),
    supabase
      .from("inventory_items")
      .select(
        "id, status, buy_cost_local, buy_currency, allocated_travel, listed_price, sell_currency, cards(name, set_name, game)",
      )
      .eq("trip_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  if (error) throw error;
  if (!trip) notFound();

  const directionLabel = trip.direction === "US_TO_EU" ? "US → EU" : "EU → US";
  const isOpen = !trip.closed_at;

  const sumBuy = (items ?? []).reduce((acc, i) => acc + (i.buy_cost_local ?? 0), 0);
  const sumTravel = (items ?? []).reduce((acc, i) => acc + (i.allocated_travel ?? 0), 0);

  const tripCostsTotal =
    (trip.cost_flight ?? 0) +
    (trip.cost_shipping ?? 0) +
    (trip.cost_miles_or_gas ?? 0) +
    (trip.cost_misc ?? 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/trips" className="text-xs text-muted-foreground hover:underline">
          ← Trips
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{trip.label}</h1>
            <p className="text-sm text-muted-foreground">
              {directionLabel} · {formatDate(trip.departed_on)} → {formatDate(trip.arrived_on)}
            </p>
          </div>
          <Badge variant={isOpen ? "default" : "secondary"}>{isOpen ? "Open" : "Closed"}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip costs</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Flight" value={formatCurrency(trip.cost_flight, "USD")} />
              <Row label="Shipping" value={formatCurrency(trip.cost_shipping, "USD")} />
              <Row label="Miles / gas" value={formatCurrency(trip.cost_miles_or_gas, "USD")} />
              <Row label="Misc" value={formatCurrency(trip.cost_misc, "USD")} />
              <hr className="my-2" />
              <Row label="Total" value={formatCurrency(tripCostsTotal, "USD")} bold />
              <Row
                label="FX locked"
                value={trip.fx_rate_locked != null ? trip.fx_rate_locked.toFixed(4) : "—"}
              />
              <Row label="Allocation" value={titleCase(trip.allocation_method)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Amortization summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Field label="Items" value={String(items?.length ?? 0)} />
              <Field
                label="Total buy"
                value={formatCurrency(sumBuy, totals?.buy_currency ?? "USD")}
              />
              <Field
                label="Total travel allocated"
                value={formatCurrency(sumTravel, totals?.buy_currency ?? "USD")}
              />
              <Field
                label="Travel from view"
                value={formatCurrency(totals?.total_travel_cost ?? null, totals?.buy_currency ?? "USD")}
              />
            </dl>
            {trip.notes && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{trip.notes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items on this trip</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!items?.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No items assigned to this trip.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const card = (item.cards as unknown) as {
                  name: string;
                  set_name: string | null;
                  game: string;
                } | null;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-accent/40 sm:grid-cols-[1fr_auto_auto_auto] sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{card?.name ?? "Unknown"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {card?.set_name ?? titleCase(card?.game)}
                        </p>
                      </div>
                      <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
                        + {formatCurrency(item.allocated_travel, item.buy_currency)} travel
                      </span>
                      <span className="text-sm tabular-nums">
                        {formatCurrency(item.buy_cost_local, item.buy_currency)}
                      </span>
                      <StatusBadge status={item.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
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
