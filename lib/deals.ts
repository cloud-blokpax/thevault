import type { Enums } from "@/types/database";

export type DealConfidence = "high" | "medium" | "low";

export type PriceQuality = "ok" | "trend_above_listings" | "us_market_below_low";

export type Deal = {
  card_id: string;
  game: Enums<"game_kind">;
  name: string;
  set_code: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  image_url: string | null;
  is_sealed: boolean;
  is_foil: boolean;
  us_buy_usd: number | string;
  us_buy_eur: number | string | null;
  us_low_min: number | string | null;
  us_market_min: number | string;
  us_market_avg: number | string;
  us_market_max: number | string;
  us_variant_count: number;
  us_variants: string[] | null;
  eu_sell_eur: number | string;
  eu_sell_usd: number | string | null;
  eu_low_min: number | string | null;
  eu_market_min: number | string;
  eu_market_avg: number | string;
  eu_market_max: number | string;
  eu_avg30_min: number | string | null;
  eu_variant_count: number;
  eu_languages: string[] | null;
  floor_eur: number | string;
  profit_eur: number | string;
  profit_usd: number | string | null;
  profit_at_eu_low_eur: number | string | null;
  margin_pct: number | string;
  margin_pct_at_eu_low: number | string | null;
  strike_conservative_usd: number | string | null;
  strike_realistic_usd: number | string | null;
  strike_aggressive_usd: number | string | null;
  strike_at_eu_low_usd: number | string | null;
  match_confidence: DealConfidence;
  variant_spread_warning: boolean;
  price_quality: PriceQuality | null;
  ebay_active_count: number | string | null;
  ebay_best_total_usd: number | string | null;
  ebay_best_listing_url: string | null;
  ebay_last_fetched_at: string | null;
  us_captured_at: string;
  eu_captured_at: string;
};

export const POTENTIAL_DEALS_SELECT =
  "card_id, game, name, set_code, set_name, card_number, rarity, image_url, is_sealed, is_foil, us_buy_usd, us_buy_eur, us_low_min, us_market_min, us_market_avg, us_market_max, us_variant_count, us_variants, eu_sell_eur, eu_sell_usd, eu_low_min, eu_market_min, eu_market_avg, eu_market_max, eu_avg30_min, eu_variant_count, eu_languages, floor_eur, profit_eur, profit_usd, profit_at_eu_low_eur, margin_pct, margin_pct_at_eu_low, strike_conservative_usd, strike_realistic_usd, strike_aggressive_usd, strike_at_eu_low_usd, match_confidence, variant_spread_warning, price_quality, ebay_active_count, ebay_best_total_usd, ebay_best_listing_url, ebay_last_fetched_at, us_captured_at, eu_captured_at";

export type EbayListing = {
  title: string;
  price_usd: number | string | null;
  shipping_usd: number | string | null;
  total_usd: number | string;
  condition: string | null;
  seller_username: string | null;
  seller_feedback_pct: number | string | null;
  item_url: string;
  is_auction: boolean | null;
};

export type ProvenanceRow = {
  source: string;
  external_id: string | null;
  source_url: string | null;
  variant_name: string | null;
  language: string | null;
  is_foil: boolean | null;
  currency: string;
  price_low: number | string | null;
  price_mid: number | string | null;
  price_market: number | string | null;
  price_high: number | string | null;
  cm_avg30: number | string | null;
  cm_avg7: number | string | null;
  captured_at: string;
  notes: string | null;
};

export function gameLabel(game: string): string {
  if (game === "pokemon") return "Pokémon";
  if (game === "one_piece") return "One Piece";
  return game.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BuyCategory =
  | "top"
  | "sealed-premium"
  | "sealed-other"
  | "premium-singles"
  | "microflips"
  | "verify";

export const CATEGORY_LABELS: Record<BuyCategory, string> = {
  top: "Top deals",
  "sealed-premium": "Sealed premium ($200+)",
  "sealed-other": "Sealed other (under $200)",
  "premium-singles": "Premium singles ($50+)",
  microflips: "Microflips (under $50, ≥30%)",
  verify: "Verify manually",
};

export function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}
