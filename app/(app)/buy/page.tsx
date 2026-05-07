import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Boxes, Gem, Package, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCurrency, titleCase } from "@/lib/utils";
import {
  type BuyCategory,
  type Deal,
  POTENTIAL_DEALS_SELECT,
  num,
} from "@/lib/deals";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type SupabaseLike = ReturnType<typeof createClient>;

const SECTION_LIMIT = 5;

async function fetchSections(supabase: SupabaseLike) {
  const base = () =>
    supabase
      .from("potential_deals" as never)
      .select(POTENTIAL_DEALS_SELECT)
      .gt("profit_at_eu_low_eur", 0);

  const top = base()
    .eq("variant_spread_warning" as never, false as never)
    .in("match_confidence" as never, ["high", "medium"] as never)
    .order("profit_at_eu_low_eur", { ascending: false })
    .limit(SECTION_LIMIT);

  const sealedPremium = base()
    .eq("is_sealed" as never, true as never)
    .gte("us_buy_usd", 200)
    .eq("variant_spread_warning" as never, false as never)
    .order("profit_at_eu_low_eur", { ascending: false })
    .limit(SECTION_LIMIT);

  const sealedOther = base()
    .eq("is_sealed" as never, true as never)
    .lt("us_buy_usd", 200)
    .eq("variant_spread_warning" as never, false as never)
    .order("profit_at_eu_low_eur", { ascending: false })
    .limit(SECTION_LIMIT);

  const premiumSingles = base()
    .eq("is_sealed" as never, false as never)
    .gte("us_buy_usd", 50)
    .eq("variant_spread_warning" as never, false as never)
    .order("profit_at_eu_low_eur", { ascending: false })
    .limit(SECTION_LIMIT);

  const microflips = base()
    .eq("is_sealed" as never, false as never)
    .lt("us_buy_usd", 50)
    .gte("margin_pct_at_eu_low", 30)
    .eq("variant_spread_warning" as never, false as never)
    .order("margin_pct_at_eu_low", { ascending: false })
    .limit(SECTION_LIMIT);

  const verify = supabase
    .from("potential_deals" as never)
    .select(POTENTIAL_DEALS_SELECT)
    .gt("profit_eur", 0)
    .eq("variant_spread_warning" as never, true as never)
    .order("profit_eur", { ascending: false, nullsFirst: false })
    .limit(SECTION_LIMIT);

  const totals = supabase
    .from("potential_deals" as never)
    .select("profit_at_eu_low_eur" as never)
    .gt("profit_at_eu_low_eur", 0)
    .eq("variant_spread_warning" as never, false as never)
    .limit(1000);

  const [topRes, spRes, soRes, psRes, mfRes, vRes, totalsRes] = (await Promise.all([
    top,
    sealedPremium,
    sealedOther,
    premiumSingles,
    microflips,
    verify,
    totals,
  ])) as unknown as Array<{
    data: Deal[] | { profit_at_eu_low_eur: number | string | null }[] | null;
    error: { message: string } | null;
  }>;

  const allRows = (totalsRes.data ?? []) as { profit_at_eu_low_eur: number | string | null }[];
  const totalProfit = allRows.reduce((acc, row) => acc + num(row.profit_at_eu_low_eur), 0);
  const totalCount = allRows.length;

  return {
    top: (topRes.data ?? []) as Deal[],
    sealedPremium: (spRes.data ?? []) as Deal[],
    sealedOther: (soRes.data ?? []) as Deal[],
    premiumSingles: (psRes.data ?? []) as Deal[],
    microflips: (mfRes.data ?? []) as Deal[],
    verify: (vRes.data ?? []) as Deal[],
    totalProfit,
    totalCount,
    error:
      topRes.error?.message ??
      spRes.error?.message ??
      soRes.error?.message ??
      psRes.error?.message ??
      mfRes.error?.message ??
      vRes.error?.message ??
      totalsRes.error?.message ??
      null,
  };
}

export default async function BuyPage() {
  const supabase = createClient();
  const data = await fetchSections(supabase);

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Today&apos;s Buys</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.totalCount} opportunit{data.totalCount === 1 ? "y" : "ies"} ·{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-500">
            {formatCurrency(data.totalProfit, "EUR")}
          </span>{" "}
          total profit potential
        </p>
      </header>

      {data.error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load deals: {data.error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Top deals"
          icon={<Sparkles className="h-4 w-4" />}
          category="top"
          deals={data.top}
          empty="No qualifying deals right now."
        />
        <Section
          title="Sealed premium ($200+)"
          subtitle="Booster boxes, ETBs"
          icon={<Boxes className="h-4 w-4" />}
          category="sealed-premium"
          deals={data.sealedPremium}
          empty="No premium sealed deals."
        />
        <Section
          title="Sealed other (under $200)"
          subtitle="Bundles, blisters, mini-tins"
          icon={<Package className="h-4 w-4" />}
          category="sealed-other"
          deals={data.sealedOther}
          empty="No sub-$200 sealed deals."
        />
        <Section
          title="Premium singles ($50+)"
          subtitle="High-value individual cards"
          icon={<Gem className="h-4 w-4" />}
          category="premium-singles"
          deals={data.premiumSingles}
          empty="No premium singles."
        />
        <Section
          title="Microflips (under $50, ≥30%)"
          subtitle="Quantity plays, bulk"
          icon={<Zap className="h-4 w-4" />}
          category="microflips"
          deals={data.microflips}
          empty="No microflips meeting the bar."
        />
        <Section
          title="Verify manually"
          subtitle="Variant spread suspected — could be huge winners"
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          category="verify"
          deals={data.verify}
          empty="No flagged deals."
        />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  category,
  deals,
  empty,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  category: BuyCategory;
  deals: Deal[];
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide">
            {icon}
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Link
          href={`/deals?category=${category}`}
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          See all →
        </Link>
      </div>
      <div className="space-y-2">
        {deals.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              {empty}
            </CardContent>
          </Card>
        ) : (
          deals.map((deal) => <BuyDealCard key={deal.card_id} deal={deal} />)
        )}
      </div>
    </section>
  );
}

function BuyDealCard({ deal }: { deal: Deal }) {
  const buyUsd = num(deal.us_buy_usd);
  const isFloorDeal = deal.profit_at_eu_low_eur != null && num(deal.profit_at_eu_low_eur) > 0;
  const profitEur = isFloorDeal ? num(deal.profit_at_eu_low_eur) : num(deal.profit_eur);
  const marginPct = isFloorDeal && deal.margin_pct_at_eu_low != null
    ? num(deal.margin_pct_at_eu_low)
    : num(deal.margin_pct);
  const strikeUsd = isFloorDeal && deal.strike_at_eu_low_usd != null
    ? num(deal.strike_at_eu_low_usd)
    : deal.strike_conservative_usd != null ? num(deal.strike_conservative_usd) : null;
  const trendProfit =
    deal.profit_eur != null && !isFloorDeal ? null : num(deal.profit_eur);

  const inventoryHref = `/inventory/new?card_id=${encodeURIComponent(deal.card_id)}&buy_cost_local=${buyUsd}&buy_currency=USD&listed_price=${num(deal.eu_market_min)}&sell_currency=EUR`;

  const titleParts = [deal.name];
  if (deal.set_code) titleParts.push(deal.set_code);
  const numberSuffix = deal.card_number ? ` (${deal.card_number})` : "";

  return (
    <div className="rounded-lg border bg-card transition-colors hover:bg-accent/30">
      <div className="flex gap-3 p-3">
        <div className="shrink-0">
          {deal.image_url ? (
            <Image
              src={deal.image_url}
              alt=""
              width={60}
              height={84}
              loading="lazy"
              unoptimized
              className="h-[84px] w-[60px] rounded border bg-muted object-contain"
            />
          ) : (
            <div className="h-[84px] w-[60px] rounded border bg-muted" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-xs font-semibold">
            {titleParts.join(" · ")}
            {numberSuffix}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Buy up to
            </span>
            <span className="text-lg font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
              {strikeUsd != null
                ? formatCurrency(strikeUsd, "USD", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })
                : "—"}
            </span>
          </div>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            currently {formatCurrency(buyUsd, "USD")} ·{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-500">
              +{formatCurrency(profitEur, "EUR")}
            </span>{" "}
            <span>({marginPct.toFixed(1)}%)</span>
          </p>
          {isFloorDeal && trendProfit !== null && trendProfit > profitEur * 1.3 && (
            <p className="text-[10px] text-muted-foreground">
              Up to +{formatCurrency(trendProfit, "EUR")} if EU trend holds
            </p>
          )}
          {!isFloorDeal && (
            <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Trend-based — verify EU listings
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <ConfidencePill confidence={deal.match_confidence} />
            <span className="text-[10px] text-muted-foreground">
              {titleCase(deal.game)}
            </span>
            <Link
              href={inventoryHref}
              className="ml-auto text-[10px] font-medium text-primary hover:underline"
            >
              Add to inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: Deal["match_confidence"] }) {
  const styles: Record<Deal["match_confidence"], string> = {
    high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        styles[confidence],
      )}
    >
      {confidence}
    </span>
  );
}

