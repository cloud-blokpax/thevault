import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, titleCase } from "@/lib/utils";
import { PromoteCalendarRow } from "./promote-row";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type CalendarEntry = {
  id: string;
  game: string;
  name: string;
  set_code: string | null;
  set_name: string | null;
  product_type: string | null;
  release_date: string | null;
  msrp_usd: number | null;
  expected_retailers: string[];
  source_url: string | null;
  notes: string | null;
  imported_drop_id: string | null;
};

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/drops");

  const { data: entries } = await supabase
    .from("drop_calendar_entries" as never)
    .select(
      "id, game, name, set_code, set_name, product_type, release_date, msrp_usd, expected_retailers, source_url, notes, imported_drop_id",
    )
    .order("release_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const all = (entries ?? []) as unknown as CalendarEntry[];
  const pending = all.filter((e) => !e.imported_drop_id);
  const imported = all.filter((e) => e.imported_drop_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/drops">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Drops
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarDays className="h-5 w-5" />
            Release calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Curated upcoming releases. Promote to a drop when preorder URLs go live.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/drops/calendar/import">
            <Upload className="mr-1 h-4 w-4" />
            Import CSV
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pending · {pending.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending entries. Use the CSV importer above to load releases.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">Release</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Game</th>
                    <th className="py-2 pr-3 font-medium">Set</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">MSRP</th>
                    <th className="py-2 pr-3 font-medium">Retailers</th>
                    <th className="py-2 pr-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums">
                        {e.release_date ? formatDate(e.release_date) : "TBA"}
                      </td>
                      <td className="py-2 pr-3 font-medium">{e.name}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {titleCase(e.game.replace("_", " "))}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {e.set_code ?? e.set_name ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {e.product_type ?? "—"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-xs">
                        {e.msrp_usd ? `$${e.msrp_usd}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {(e.expected_retailers ?? []).join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <PromoteCalendarRow entryId={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {imported.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Already imported · {imported.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <ul className="space-y-1">
              {imported.slice(0, 50).map((e) => (
                <li key={e.id}>
                  <span className="tabular-nums">
                    {e.release_date ? formatDate(e.release_date) : "TBA"}
                  </span>{" "}
                  · {e.name}{" "}
                  {e.imported_drop_id && (
                    <Link
                      href={`/drops`}
                      className="font-medium text-primary hover:underline"
                    >
                      →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
