# TCG Observation Schema v1

> Canonical row shapes for trading-card price observations across all
> Anthropic-Org TCG apps (card-scanner, TheVault, future). Every app's
> archived data SHOULD conform to one of two schemas defined here.
> Conformance is what makes cross-app DuckDB queries trivial.

**Status:** v1 — initial release. Versioned via `archive_version` field on
every archived row. Future revisions bump that field.

**Scope:** Defines the row shape that lands in long-term R2 archives. Live
Postgres tables MAY have additional columns for app-specific concerns
(e.g., `success` / `error_message` flags on harvest logs); the archive
writer is responsible for projecting them down to the canonical shape.

**Why this exists:** Without a shared schema, "show me median price for
Strongboy across all sources I've ever observed" requires per-app
column-mapping logic at query time. With this schema, the same query is a
single DuckDB UNION across `card-scanner/` and `thevault/` prefixes — no
mapping logic, no data-engineering tax on every analytical question.

-----

## Table of Contents

1. [The two grains](#the-two-grains)
1. [Schema A — Observation grain](#schema-a--observation-grain)
1. [Schema B — Aggregate grain](#schema-b--aggregate-grain)
1. [Field reference](#field-reference)
1. [Enrichment fields (universal)](#enrichment-fields-universal)
1. [Existing source mapping](#existing-source-mapping)
1. [Adding new sources](#adding-new-sources)
1. [Schema evolution](#schema-evolution)

-----

## The two grains

TCG price data comes in two fundamentally different grains. Forcing them
into a single schema either bloats aggregate rows with per-listing fields
or strips per-listing detail that makes observations valuable. Two
schemas, with documented relationship between them, is the right shape.

**Observation grain** — one row = one specific marketplace listing
observed at a specific moment.

- "On 2026-05-08 14:30 UTC, eBay item 1234567890 was listed at $14.99"
- "On 2026-05-09 06:00 UTC, Cardmarket SKU XYZ had 17 copies for sale,
  lowest at €8.50"
- High volume, fine grain, supports listing-level analytics like
  "average asking price for graded slabs of card X over time"

**Aggregate grain** — one row = one summary of multiple observations,
captured at a specific moment.

- "On 2026-05-08, across 23 active eBay listings of card X, the median
  was $14.99 with a 5th-95th percentile range of $8 to $42"
- "On 2026-05-09, Cardmarket reported a single 'market price' of €12.30
  for card X" (third-party-aggregated already; we treat it as one
  atomic snapshot)
- Lower volume, summary-level, ideal for pricing displays and trend
  charts.

**Relationship:** Aggregate rows can be (re)derived from observation rows
by grouping on (card_id, source, capture_date, condition). When both
exist, observation grain is canonical and aggregate grain is a derived
projection. When only aggregate grain exists (Cardmarket "market price"
is provided pre-aggregated by the source), it's a primary record.

-----

## Schema A — Observation grain

For per-listing snapshots. One row per (card_id, marketplace_listing_id,
observation_timestamp).

```jsonc
{
  // ── Enrichment (added by archive writer; see Enrichment section) ──
  "app_id": "card-scanner",                    // required, see enum below
  "source_table": "ebay_listing_observations", // required, app-internal table name
  "archive_version": 1,                        // required, this schema version

  // ── Card identity ─────────────────────────────────────────────────
  "card_id": "018f8849-8158-455c-af4b-48d35687cec6",  // required, UUID, links to app's cards table
  "game_id": "boba",                            // required, see game_id enum
  "card_canonical_key": "BOBA:GLBF-250:Chiller:Grandma's Linoleum BF",
                                                // optional, human-readable
                                                // (game:number:hero:parallel)
                                                // for cross-app dedup when card_id
                                                // doesn't exist in target app

  // ── Marketplace identity ──────────────────────────────────────────
  "source": "ebay",                             // required, see source enum
  "source_listing_id": "1234567890",            // required, source-native listing ID
  "source_seller_id": "comc_consignment",       // optional

  // ── Observation timestamp ────────────────────────────────────────
  "observed_at": "2026-05-08T14:30:00Z",        // required, ISO 8601 UTC

  // ── Price ────────────────────────────────────────────────────────
  "price_value": 14.99,                         // required for non-auction; numeric
  "currency": "USD",                            // required, see currency enum
  "price_kind": "fixed",                        // required, see price_kind enum

  // For auctions:
  "current_bid": 8.50,                          // optional
  "bid_count": 3,                               // optional
  "buy_now_price": 25.00,                       // optional
  "auction_ends_at": "2026-05-10T03:00:00Z",   // optional, ISO 8601 UTC

  // ── Condition / variant ──────────────────────────────────────────
  "condition_label": "Ungraded",                // required, see condition enum
  "condition_grade_value": null,                // optional, numeric grade if graded (e.g., 9.5 for PSA 9.5)
  "condition_grader": null,                     // optional, see grader enum
  "is_foil": false,                             // optional; null if unknowable
  "variant_label": null,                        // optional, free-text source-specific variant

  // ── Provenance ───────────────────────────────────────────────────
  "title": "2024 Strongboy Holographic Battlefoil PSA 9 ...",  // optional, source-provided title
  "image_url": "https://i.ebayimg.com/...",     // optional
  "source_url": "https://www.ebay.com/itm/...", // optional, canonical URL
  "affiliate_url": "https://...campid=5339108029",  // optional, affiliate-tagged

  // ── Filter / acceptance metadata (app-specific, optional) ────────
  "accepted_by_filter": true,                   // optional
  "rejection_reason": null,                     // optional, app-specific token

  // ── Source-specific extras (escape hatch) ────────────────────────
  "source_payload": { /* free-form */ }         // optional, source-native fields not yet canonized
}
```

-----

## Schema B — Aggregate grain

For per-(card, capture-moment) summary snapshots. One row per (card_id,
source, captured_at, condition_label).

```jsonc
{
  // ── Enrichment ────────────────────────────────────────────────────
  "app_id": "card-scanner",
  "source_table": "external_pricing_history",
  "archive_version": 1,

  // ── Card identity ─────────────────────────────────────────────────
  "card_id": "...",
  "game_id": "wonders",
  "card_canonical_key": "WONDERS:E-12:Sage:Stonefoil",  // optional

  // ── Source ────────────────────────────────────────────────────────
  "source": "wonderstradingpost",
  "captured_at": "2026-05-09T05:00:00Z",        // required

  // ── Aggregate price ──────────────────────────────────────────────
  "currency": "USD",
  "price_low": 8.00,
  "price_mid": 14.99,                           // typically median
  "price_high": 42.00,
  "price_mean": 17.65,                          // optional
  "price_market": 14.99,                        // optional (source's official "market price")

  // ── Sample metadata ──────────────────────────────────────────────
  "listings_count": 23,                         // n underlying observations
  "outliers_filtered": 4,                       // optional, n excluded as outliers

  // ── Condition / variant ──────────────────────────────────────────
  "condition_label": "Ungraded",
  "is_foil": false,
  "variant_label": null,

  // ── Time series additions (when source provides) ────────────────
  "total_sales_lifetime": 11,                   // optional
  "sales_30d": 3,                               // optional
  "avg_sale_price_30d": 13.50,                  // optional
  "last_sale_date": "2026-05-04",               // optional, ISO 8601 date

  // ── Source-specific extras ───────────────────────────────────────
  "source_payload": { /* free-form */ }
}
```

-----

## Field reference

### Required on both schemas

|Field            |Type       |Notes                                            |
|-----------------|-----------|-------------------------------------------------|
|`app_id`         |enum string|`card-scanner` | `thevault` | (future)           |
|`source_table`   |string     |Internal app table name; documents row provenance|
|`archive_version`|integer    |This schema version (currently `1`)              |
|`card_id`        |UUID string|App-local identifier                             |
|`game_id`        |enum string|See [game_id enum](#game_id-enum)                |
|`source`         |enum string|See [source enum](#source-enum)                  |
|`currency`       |enum string|See [currency enum](#currency-enum)              |

### Required on Schema A only

|Field              |Type              |Notes                                    |
|-------------------|------------------|-----------------------------------------|
|`source_listing_id`|string            |Source-native listing/item ID            |
|`observed_at`      |ISO 8601 timestamp|When the listing was observed            |
|`price_value`      |numeric           |Asked price (or current bid for auctions)|
|`price_kind`       |enum string       |See [price_kind enum](#price_kind-enum)  |
|`condition_label`  |enum string       |See [condition enum](#condition-enum)    |

### Required on Schema B only

|Field            |Type              |Notes                                          |
|-----------------|------------------|-----------------------------------------------|
|`captured_at`    |ISO 8601 timestamp|When this aggregate was computed/observed      |
|`price_mid`      |numeric           |Median or central tendency; what apps display  |
|`condition_label`|enum string       |"Ungraded" if mixed/unknown; otherwise specific|

### Enums

#### `app_id` enum

Open-ended; current values:

- `card-scanner` — boba.cards
- `thevault` — TheVault
- *(others added as more apps go live; one PR to update this doc + the enum file in each app)*

#### `game_id` enum

|Value      |Notes                              |
|-----------|-----------------------------------|
|`boba`     |BoBA — card-scanner                |
|`wonders`  |Wonders of the First — card-scanner|
|`pokemon`  |TheVault                           |
|`one_piece`|TheVault                           |
|`magic`    |TheVault                           |
|`lorcana`  |TheVault                           |
|`yugioh`   |TheVault                           |
|`other`    |TheVault — uncategorized           |

#### `source` enum

|Value               |Apps that use it|
|--------------------|----------------|
|`ebay`              |card-scanner    |
|`wonderstradingpost`|card-scanner    |
|`cardmarket`        |TheVault        |
|`tcgplayer`         |TheVault        |
|`pricecharting`     |TheVault        |
|`scrydex`           |TheVault        |
|`justtcg`           |TheVault        |
|`manual`            |both            |

`source` is granular at the platform level. **Not** at the
"specific-feed-of-that-platform" level — TheVault's existing
`tcgplayer_market` vs `tcgplayer_low` distinction lives in `source_payload`,
not as separate `source` values. This keeps cross-source comparison clean
("show me the lowest tcgplayer price across all snapshots").

For sources where the same platform offers buy-now and auction (like
eBay), use `price_kind` to differentiate.

#### `currency` enum

ISO 4217 codes. Currently used: `USD`, `EUR`, `GBP`, `JPY`, `CAD`. Open
to extension as TheVault expands geographically.

#### `price_kind` enum

|Value      |Notes                                                     |
|-----------|----------------------------------------------------------|
|`fixed`    |Buy It Now / fixed-price listing                          |
|`auction`  |Live auction (use `current_bid` + `auction_ends_at`)      |
|`aggregate`|Source-provided aggregate (Schema B only — implicit)      |
|`sold`     |Confirmed completed sale (rare today; future Schema A use)|

#### `condition_label` enum

Aligned with TheVault's existing `condition_grade` enum, plus card-scanner
distinctions:

|Value              |Notes                                                         |
|-------------------|--------------------------------------------------------------|
|`mint`             |TheVault label, raw card                                      |
|`near_mint`        |TheVault, raw                                                 |
|`lightly_played`   |TheVault, raw                                                 |
|`moderately_played`|TheVault, raw                                                 |
|`heavily_played`   |TheVault, raw                                                 |
|`damaged`          |TheVault, raw                                                 |
|`graded`           |Slabbed; populate `condition_grade_value` + `condition_grader`|
|`ungraded`         |Card-scanner default — raw, not professionally graded         |
|`sealed`           |Factory sealed (booster pack, box, etc.)                      |

Card-scanner currently emits exactly `Ungraded`, `Used`, `New/Factory Sealed`, `Graded` (capitalized). v1 of this spec uses lowercase
snake_case for forward-compat. Card-scanner archive writer should
normalize at archive time:

|eBay-source label   |Canonical                                                                |
|--------------------|-------------------------------------------------------------------------|
|`Ungraded`          |`ungraded`                                                               |
|`Used`              |`lightly_played` (best approximation; eBay "Used" is roughly NM-LP equiv)|
|`New/Factory Sealed`|`sealed`                                                                 |
|`Graded`            |`graded`                                                                 |

#### `condition_grader` enum (when condition is `graded`)

|Value  |
|-------|
|`psa`  |
|`bgs`  |
|`cgc`  |
|`sgc`  |
|`tag`  |
|`other`|

Free-text override allowed via `source_payload.grader_raw` if needed.

-----

## Enrichment fields (universal)

All archived rows MUST include:

```jsonc
{
  "app_id":          "card-scanner",
  "source_table":    "ebay_listing_observations",
  "archive_version": 1
}
```

The archive writer in each app is responsible for prepending these. The
existing `archive-to-r2` cron in card-scanner already does this for v1.

`source_table` is the LIVE table name as of the archive moment.
Card-scanner's renames (e.g., `scraping_test_history` →
`external_pricing_history`) are reflected in newer archive files, but
older archive files retain the names that were in effect when they were
written. Cross-archive queries need to be aware of this for older data —
or apps can run a one-shot rewrite job over the archive to normalize old
names. Card-scanner does NOT plan to rewrite historical archives;
`source_table` is treated as descriptive metadata, not a join key.

-----

## Existing source mapping

How current card-scanner and TheVault tables map onto Schema A or B:

### card-scanner

|Source table               |Schema                      |Notes                                                                                                                                                                                                                                         |
|---------------------------|----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|`ebay_listing_observations`|A (observation)             |Direct map; archive writer projects to canonical fields. `accepted_by_filter` and `rejection_reason` are app-specific extras kept in canonical fields — they happen to fit cleanly.                                                           |
|`price_harvest_log`        |Neither (operational)       |Not really price observations — these are "we tried to fetch prices for card X, here's what happened." Archive writer keeps current shape; future v2 may split out the few rows that contain useful aggregate data into a Schema B projection.|
|`external_pricing_history` |B (aggregate)               |Direct map; `ep_*` fields rename to canonical equivalents at archive time.                                                                                                                                                                    |
|`price_cache`              |Not archived (live snapshot)|Most-recent aggregate per card; sell view reads it. Phase 2 considers whether to snapshot it daily into Schema B.                                                                                                                             |

### TheVault (future, when archive cron is added)

|Source table     |Schema       |Notes                                                                                                                             |
|-----------------|-------------|----------------------------------------------------------------------------------------------------------------------------------|
|`prices`         |B (aggregate)|Direct map; column names already align (`price_low`, `price_mid`, `price_high`, `currency`, `condition`, `source`, `captured_at`).|
|`inventory_items`|Not archived |Operational data, not a price observation.                                                                                        |

-----

## Adding new sources

When a new platform comes online (say, Mercari or Buyee for Japanese
sales):

1. **Open a PR adding the new value to the `source` enum** in this doc
1. **Update both apps' Postgres enums** in their next migration to match
1. **Update the archive writer** in the app that uses it (typically a
   one-line addition to the SOURCE_TABLES array if the source has its own
   table, or just a new value emitted from an existing source-multiplexed
   table)
1. **No version bump needed** — adding enum values is forward-compatible
   for v1 readers (DuckDB will just see new strings)

When a new app comes online:

1. **Open a PR adding the new value to the `app_id` enum** in this doc
1. **Update the new app's archive writer** to use this canonical shape
1. **Use a separate R2 prefix** for the new app, same bucket
   (`tcg-archive`)

-----

## Schema evolution

### Forward-compatible changes (no version bump)

- Adding new optional fields
- Adding new enum values
- Adding new `source_payload` keys

Old readers ignore new fields. Old archive files keep working.

### Breaking changes (version bump to v2)

- Removing fields
- Renaming fields
- Tightening field types (e.g., string → enum)
- Changing semantics of existing fields

Process:

1. **Bump the spec to v2** in this doc, with explicit changelog
1. **All apps update writers** to emit `archive_version: 2`
1. **Old data stays at `archive_version: 1`** — never rewrite historical
   archives
1. **Mining queries handle both versions** by branching on
   `archive_version` (DuckDB's CASE WHEN works fine for this)

Don't bump v2 lightly. The whole point of canonical schema is
stability — once readers and writers agree, the data flowing through is
durable. v2 only happens when the cost of the breaking change is clearly
worth the migration burden.

-----

## Verification queries

DuckDB SQL that proves a given archive file conforms to v1:

```sql
-- All required Schema A fields present and non-null
SELECT COUNT(*) FROM read_json_auto('s3://tcg-archive/card-scanner/2026/05/08/ebay_listing_observations.jsonl.gz')
WHERE app_id IS NULL
   OR source_table IS NULL
   OR archive_version IS NULL
   OR card_id IS NULL
   OR game_id IS NULL
   OR source IS NULL
   OR source_listing_id IS NULL
   OR observed_at IS NULL
   OR price_value IS NULL  -- only fails for auctions; if auction, current_bid required instead
   OR currency IS NULL
   OR price_kind IS NULL
   OR condition_label IS NULL;
-- Expect: 0
```

```sql
-- Cross-app cross-source query that demonstrates schema power
-- "Across all sources I've ever observed, what was the median price for
--  a Strongboy card on each day in May 2026?"
SELECT
  DATE(COALESCE(observed_at, captured_at)) AS day,
  source,
  app_id,
  COUNT(*) AS n_observations,
  PERCENTILE_CONT(price_value, 0.5) AS median_price
FROM read_json_auto(
  's3://tcg-archive/*/2026/05/*/ebay_listing_observations.jsonl.gz',
  hive_partitioning = 1
)
WHERE card_canonical_key LIKE '%Strongboy%'
GROUP BY 1, 2, 3
ORDER BY day, source;
```

The fact that this is a single query, not a per-app routine, IS the
value of the canonical schema.

-----

## Changelog

### v1 — 2026-05-09

Initial release. Defines two schemas (observation, aggregate),
enrichment fields, source/condition/grader enums, and existing-source
mapping. Card-scanner is currently writing pre-canonical rows
(direct passthrough of source-table columns); a future PR will
project to canonical at archive time. TheVault has not yet shipped
archives; whenever it does, it should write canonical from day one.
