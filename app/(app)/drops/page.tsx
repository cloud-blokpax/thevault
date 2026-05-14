import Link from "next/link";
import { Calendar, PackagePlus, Sparkles, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardImage } from "@/components/ui/card-image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { RetailerLinkPill } from "./retailer-link-pill";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type RetailerLink = {
  id: string;
  retailer: string;
  region: string;
  url: string;
  price_usd: number | null;
  price_eur: number | null;
  in_stock: boolean | null;
  stock_checked_at: string | null;
  notes: string | null;
  sort_order: number;
};

type Drop = {
  id: string;
  game: "pokemon" | "one_piece" | "magic" | "lorcana" | "yugioh" | "other";
  name: string;
  set_code: string | null;
  set_name: string | null;
  product_type: string | null;
  image_url: string | null;
  release_date: string | null;
  msrp_usd: number | null;
  msrp_eur: number | null;
  notes: string | null;
  status: "upcoming" | "live" | "released";
  card_id: string | null;
  drop_retailer_links: RetailerLink[];
};

const RETAILER_LABELS: Record<string, string> = {
  pokemoncenter: "Pokémon Center",
  target: "Target",
  bestbuy: "Best Buy",
  amazon: "Amazon",
  walmart: "Walmart",
  gamestop: "GameStop",
  costco: "Costco",
  samsclub: "Sam's Club",
  cardmarket: "Cardmarket",
  tcgplayer: "TCGplayer",
  ebay: "eBay",
  collectorscache: "Collector's Cache",
  troll_and_toad: "Troll and Toad",
};

function retailerLabel(slug: string) {
  return RETAILER_LABELS[slug] ?? titleCase(slug);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00").getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function DropsPage() {
  const supabase = createClient();

  const [{ data: dropsRaw, error }, { data: profile }] = await Promise.all([
    supabase
      .from("product_drops" as never)
      .select(
        "id, game, name, set_code, set_name, product_type, image_url, release_date, msrp_usd, msrp_eur, notes, status, card_id, drop_retailer_links(id, retailer, region, url, price_usd, price_eur, in_stock, stock_checked_at, notes, sort_order)",
      )
      .order("release_date", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle(),
  ]);

  const drops = ((dropsRaw ?? []) as unknown as Drop[]).map((d) => ({
    ...d,
    drop_retailer_links: [...(d.drop_retailer_links ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = drops.filter(
    (d) => d.status === "upcoming" || (d.release_date && d.release_date > today),
  );
  const live = drops.filter(
    (d) =>
      d.status === "live" ||
      (d.status === "released" && d.release_date && d.release_date >= todayMinusDays(30)),
  );
  const past = drops.filter(
    (d) => d.status === "released" && (!d.release_date || d.release_date < todayMinusDays(30)),
  );

  const isAdmin = profile?.role === "admin";
  const totalCount = drops.length;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Drops</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? "Track upcoming product releases and direct buy links."
              : `${totalCount} tracked product${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm">
            <Link href="/drops/new">
              <Plus className="mr-1 h-4 w-4" />
              Add drop
            </Link>
          </Button>
        )}
      </header>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load drops: {error.message}
          </CardContent>
        </Card>
      )}

      {totalCount === 0 && !error && (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <PackagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-base font-semibold">No drops tracked yet</p>
              <p className="text-sm text-muted-foreground">
                Add upcoming Pokémon or One Piece products with retailer links to keep them on
                your radar.
              </p>
            </div>
            {isAdmin && (
              <Button asChild size="sm">
                <Link href="/drops/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Add your first drop
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Section
          title="Dropping soon"
          icon={<Calendar className="h-4 w-4" />}
          drops={upcoming}
          tone="upcoming"
          isAdmin={isAdmin}
        />
      )}
      {live.length > 0 && (
        <Section
          title="Available now"
          icon={<Sparkles className="h-4 w-4" />}
          drops={live}
          tone="live"
          isAdmin={isAdmin}
        />
      )}
      {past.length > 0 && (
        <Section
          title="Past releases"
          icon={<PackagePlus className="h-4 w-4" />}
          drops={past}
          tone="past"
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function todayMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function Section({
  title,
  icon,
  drops,
  tone,
  isAdmin,
}: {
  title: string;
  icon: React.ReactNode;
  drops: Drop[];
  tone: "upcoming" | "live" | "past";
  isAdmin: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
        {icon}
        {title}
        <span className="font-normal text-muted-foreground">· {drops.length}</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {drops.map((d) => (
          <DropCard key={d.id} drop={d} tone={tone} isAdmin={isAdmin} />
        ))}
      </div>
    </section>
  );
}

function DropCard({
  drop,
  tone,
  isAdmin,
}: {
  drop: Drop;
  tone: "upcoming" | "live" | "past";
  isAdmin: boolean;
}) {
  const days = daysUntil(drop.release_date);
  const releaseLabel =
    drop.release_date && days != null
      ? days > 0
        ? `${formatDate(drop.release_date)} · in ${days} day${days === 1 ? "" : "s"}`
        : days === 0
          ? `${formatDate(drop.release_date)} · today`
          : formatDate(drop.release_date)
      : drop.release_date
        ? formatDate(drop.release_date)
        : "TBA";

  return (
    <article className="rounded-lg border bg-card transition-colors hover:bg-accent/30">
      <div className="flex gap-3 p-3">
        <div className="shrink-0">
          <CardImage
            src={drop.image_url}
            alt=""
            width={70}
            height={98}
            fallbackText=""
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <p className="truncate text-sm font-semibold">
              {drop.name}
              {drop.set_code && (
                <span className="ml-1 text-xs font-mono uppercase text-muted-foreground">
                  · {drop.set_code}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                titleCase(drop.game === "one_piece" ? "One Piece" : drop.game),
                drop.set_name,
                drop.product_type,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                tone === "upcoming"
                  ? "text-amber-600 dark:text-amber-400"
                  : tone === "live"
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" />
              {releaseLabel}
            </span>
            {drop.msrp_usd != null && (
              <span className="text-muted-foreground tabular-nums">
                MSRP {formatCurrency(drop.msrp_usd, "USD")}
                {drop.msrp_eur != null && ` / ${formatCurrency(drop.msrp_eur, "EUR")}`}
              </span>
            )}
          </div>

          {drop.notes && (
            <p className="text-xs text-muted-foreground">{drop.notes}</p>
          )}

          {drop.drop_retailer_links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {drop.drop_retailer_links.map((link) => (
                <RetailerLinkPill
                  key={link.id}
                  link={link}
                  retailerLabel={retailerLabel(link.retailer)}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}

          {drop.card_id && (
            <Link
              href={`/inventory/new?card_id=${encodeURIComponent(drop.card_id)}${drop.msrp_usd ? `&buy_cost_local=${drop.msrp_usd}&buy_currency=USD` : ""}`}
              className="inline-flex text-xs font-medium text-primary hover:underline"
            >
              + Add to inventory
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

