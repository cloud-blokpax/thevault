import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Enums } from "@/types/database";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const STATUSES: Enums<"inventory_status">[] = [
  "pending",
  "bought",
  "in_transit",
  "landed",
  "listed",
  "sold",
];

export default async function DashboardPage() {
  const supabase = createClient();

  const [{ data: itemsByStatus }, { data: recentItems }, { data: openTrips }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("status, buy_cost_local, buy_currency"),
    supabase
      .from("inventory_items")
      .select("id, status, buy_cost_local, buy_currency, listed_price, sell_currency, updated_at, cards(canonical_name, set_name, game)")
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("trips")
      .select("id, label, direction, departed_on, arrived_on, closed_at")
      .is("closed_at", null)
      .order("departed_on", { ascending: false })
      .limit(5),
  ]);

  const counts = STATUSES.map((s) => ({
    status: s,
    count: (itemsByStatus ?? []).filter((i) => i.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Quick view of inventory and active trips.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ status, count }) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                {titleCase(status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-bold">{count}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Recent activity
              <Link href="/inventory" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!recentItems?.length ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No items yet.</p>
            ) : (
              <ul className="divide-y">
                {recentItems.map((item) => {
                  const card = (item.cards as unknown) as { canonical_name: string; set_name: string | null; game: string } | null;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/inventory/${item.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{card?.canonical_name ?? "Unknown card"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {card?.set_name ?? titleCase(card?.game)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-medium tabular-nums">
                            {formatCurrency(item.buy_cost_local, item.buy_currency)}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Open trips
              <Link href="/trips" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!openTrips?.length ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No open trips.</p>
            ) : (
              <ul className="divide-y">
                {openTrips.map((trip) => (
                  <li key={trip.id}>
                    <Link
                      href={`/trips/${trip.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50 sm:px-6"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{trip.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {trip.direction === "US_TO_EU" ? "US → EU" : "EU → US"} ·{" "}
                          {formatDate(trip.departed_on)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
