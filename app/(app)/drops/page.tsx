import Link from "next/link";
import { Calendar, PackagePlus, Sparkles, Plus, Bell, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardImage } from "@/components/ui/card-image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { RetailerLinkPill, type MonitorMode, type MonitorState } from "./retailer-link-pill";
import { DropsFilterTabs } from "./drops-filter-tabs";
import { WatchDropButton } from "./watch-drop-button";

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
  monitor_mode: MonitorMode | null;
  last_state: MonitorState | null;
  last_state_at: string | null;
  last_state_changed_at: string | null;
  next_check_at: string | null;
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

type Suggestion = {
  id: string;
  drop_id: string;
  reason: string | null;
  created_at: string;
  product_drops: Drop | null;
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
  bn: "Barnes & Noble",
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

function todayMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function hasInStockLink(d: Drop): boolean {
  return d.drop_retailer_links.some(
    (l) => l.last_state === "in_stock" || l.in_stock === true,
  );
}

const VALID_FILTERS = ["all", "upcoming", "in_stock", "suggested", "past"] as const;
type FilterKey = (typeof VALID_FILTERS)[number];

export default async function DropsPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const filter: FilterKey =
    (VALID_FILTERS as readonly string[]).includes(searchParams?.filter ?? "")
      ? (searchParams!.filter as FilterKey)
      : "all";

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? "";

  const [{ data: dropsRaw, error }, { data: profile }, { data: suggestionsRaw }] =
    await Promise.all([
      supabase
        .from("product_drops" as never)
        .select(
          "id, game, name, set_code, set_name, product_type, image_url, release_date, msrp_usd, msrp_eur, notes, status, card_id, drop_retailer_links(id, retailer, region, url, price_usd, price_eur, in_stock, stock_checked_at, notes, sort_order, monitor_mode, last_state, last_state_at, last_state_changed_at, next_check_at)",
        )
        .order("release_date", { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle(),
      userId
        ? supabase
            .from("drop_suggestions" as never)
            .select(
              "id, drop_id, reason, created_at, product_drops:drop_id(id, game, name, set_code, set_name, product_type, image_url, release_date, msrp_usd, msrp_eur, notes, status, card_id, drop_retailer_links(id, retailer, region, url, price_usd, price_eur, in_stock, stock_checked_at, notes, sort_order, monitor_mode, last_state, last_state_at, last_state_changed_at, next_check_at))",
            )
            .eq("user_id", userId)
            .eq("dismissed", false)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as Suggestion[] }),
    ]);

  const drops = ((dropsRaw ?? []) as unknown as Drop[]).map((d) => ({
    ...d,
    drop_retailer_links: [...(d.drop_retailer_links ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));

  const suggestions = ((suggestionsRaw ?? []) as unknown as Suggestion[]).filter(
    (s) => s.product_drops != null,
  );

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
  const inStockNow = drops
    .filter(hasInStockLink)
    .sort((a, b) => {
      const aT = mostRecentInStockAt(a);
      const bT = mostRecentInStockAt(b);
      return (bT ?? 0) - (aT ?? 0);
    });

  const isAdmin = profile?.role === "admin";
  const totalCount = drops.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Drops</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount === 0
              ? "Track upcoming product releases and direct buy links."
              : `${totalCount} tracked product${totalCount === 1 ? "" : "s"}`}
            {inStockNow.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-emerald-600 dark:text-emerald-500">
                  {inStockNow.length} in stock now
                </span>
              </>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/drops/calendar">
                <CalendarDays className="mr-1 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/drops/new">
                <Plus className="mr-1 h-4 w-4" />
                Add drop
              </Link>
            </Button>
          </div>
        )}
      </header>

      <DropsFilterTabs
        active={filter}
        counts={{
          all: drops.length,
          upcoming: upcoming.length,
          in_stock: inStockNow.length,
          suggested: suggestions.length,
          past: past.length,
        }}
      />

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

      {filter === "in_stock" && inStockNow.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nothing in stock right now. Watching links will show up here the moment they flip.
          </CardContent>
        </Card>
      )}

      {filter === "suggested" && suggestions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No suggestions yet. Set up watch rules in{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Settings
            </Link>
            .
          </CardContent>
        </Card>
      )}

      {filter === "in_stock" && inStockNow.length > 0 && (
        <Section
          title="Available right now"
          icon={<Sparkles className="h-4 w-4" />}
          drops={inStockNow}
          tone="live"
          isAdmin={isAdmin}
        />
      )}

      {filter === "suggested" && suggestions.length > 0 && (
        <SuggestedSection suggestions={suggestions} isAdmin={isAdmin} />
      )}

      {(filter === "all" || filter === "upcoming") && upcoming.length > 0 && (
        <Section
          title="Dropping soon"
          icon={<Calendar className="h-4 w-4" />}
          drops={upcoming}
          tone="upcoming"
          isAdmin={isAdmin}
        />
      )}
      {filter === "all" && live.length > 0 && (
        <Section
          title="Available now"
          icon={<Sparkles className="h-4 w-4" />}
          drops={live}
          tone="live"
          isAdmin={isAdmin}
        />
      )}
      {(filter === "all" || filter === "past") && past.length > 0 && (
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

function mostRecentInStockAt(d: Drop): number | null {
  let best: number | null = null;
  for (const l of d.drop_retailer_links) {
    if (l.last_state === "in_stock" && l.last_state_changed_at) {
      const t = new Date(l.last_state_changed_at).getTime();
      if (best == null || t > best) best = t;
    }
  }
  return best;
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

function SuggestedSection({
  suggestions,
  isAdmin,
}: {
  suggestions: Suggestion[];
  isAdmin: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
        <Bell className="h-4 w-4" />
        Suggested for you
        <span className="font-normal text-muted-foreground">· {suggestions.length}</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {suggestions.map((s) =>
          s.product_drops ? (
            <DropCard
              key={s.id}
              drop={s.product_drops}
              tone="upcoming"
              isAdmin={isAdmin}
              suggestionReason={s.reason ?? "Matched a watch rule"}
              suggestionId={s.id}
            />
          ) : null,
        )}
      </div>
    </section>
  );
}

function DropCard({
  drop,
  tone,
  isAdmin,
  suggestionReason,
  suggestionId,
}: {
  drop: Drop;
  tone: "upcoming" | "live" | "past";
  isAdmin: boolean;
  suggestionReason?: string;
  suggestionId?: string;
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
          <CardImage src={drop.image_url} alt="" width={70} height={98} fallbackText="" />
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

          {suggestionReason && (
            <p className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary">
              {suggestionReason}
            </p>
          )}

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
            {isAdmin && drop.drop_retailer_links.length > 0 && (
              <WatchDropButton
                dropId={drop.id}
                linkIds={drop.drop_retailer_links.filter((l) => l.url).map((l) => l.id)}
                suggestionId={suggestionId}
              />
            )}
          </div>

          {drop.notes && <p className="text-xs text-muted-foreground">{drop.notes}</p>}

          {drop.drop_retailer_links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {drop.drop_retailer_links.map((link) => (
                <RetailerLinkPill
                  key={link.id}
                  link={{
                    ...link,
                    monitor_mode: (link.monitor_mode as MonitorMode | null) ?? "off",
                    last_state: (link.last_state as MonitorState | null) ?? "unknown",
                  }}
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
