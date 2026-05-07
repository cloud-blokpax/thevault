import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TripStatusToggle } from "@/components/trip-status-toggle";
import { formatCurrency, formatDate } from "@/lib/utils";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const supabase = createClient();
  const [{ data: trips }, { data: totals }] = await Promise.all([
    supabase
      .from("trips")
      .select("*")
      .order("departed_on", { ascending: false, nullsFirst: false }),
    supabase.from("trip_totals").select("*"),
  ]);

  const totalsByTrip = new Map(
    (totals ?? []).map((t) => [t.trip_id ?? "", t]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
          <p className="text-sm text-muted-foreground">
            {trips?.length ?? 0} {trips?.length === 1 ? "trip" : "trips"}
          </p>
        </div>
        <Button asChild>
          <Link href="/trips/new">+ New trip</Link>
        </Button>
      </div>

      {!trips?.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No trips yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => {
            const totals = totalsByTrip.get(trip.id);
            const isOpen = !trip.closed_at;
            const dateLine =
              trip.departed_on || trip.arrived_on
                ? `${formatDate(trip.departed_on)} → ${formatDate(trip.arrived_on)}`
                : null;
            return (
              <Card key={trip.id} className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/trips/${trip.id}`} className="min-w-0 flex-1">
                      <CardTitle className="text-base hover:underline">{trip.label}</CardTitle>
                    </Link>
                    <TripStatusToggle tripId={trip.id} isOpen={isOpen} />
                  </div>
                  {dateLine && (
                    <p className="text-xs text-muted-foreground">{dateLine}</p>
                  )}
                </CardHeader>
                <Link href={`/trips/${trip.id}`} className="block">
                  <CardContent className="pt-0 text-sm">
                    <dl className="space-y-1.5">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Departed</dt>
                        <dd>{formatDate(trip.departed_on)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Arrived</dt>
                        <dd>{formatDate(trip.arrived_on)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Travel cost</dt>
                        <dd className="font-medium tabular-nums">
                          {formatCurrency(
                            totals?.total_travel_cost ?? null,
                            totals?.buy_currency ?? "USD",
                          )}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
