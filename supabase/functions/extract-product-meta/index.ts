// extract-product-meta: given a product URL, fetches the page and
// pulls a best-effort {title, image_url, price, currency, retailer, msrp?}
// from OpenGraph + JSON-LD + <title>. Used to auto-fill the add-drop
// and add-retailer-link forms.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const RETAILER_MAP: Array<[RegExp, string]> = [
  [/(^|\.)pokemoncenter\.com$/i, "pokemoncenter"],
  [/(^|\.)target\.com$/i, "target"],
  [/(^|\.)bestbuy\.com$/i, "bestbuy"],
  [/(^|\.)walmart\.com$/i, "walmart"],
  [/(^|\.)gamestop\.com$/i, "gamestop"],
  [/(^|\.)costco\.com$/i, "costco"],
  [/(^|\.)samsclub\.com$/i, "samsclub"],
  [/(^|\.)barnesandnoble\.com$/i, "bn"],
  [/(^|\.)amazon\.[a-z.]+$/i, "amazon"],
  [/(^|\.)tcgplayer\.com$/i, "tcgplayer"],
  [/(^|\.)trollandtoad\.com$/i, "troll_and_toad"],
  [/(^|\.)collectorscache\.com$/i, "collectorscache"],
  [/(^|\.)cardmarket\.com$/i, "cardmarket"],
  [/(^|\.)ebay\.[a-z.]+$/i, "ebay"],
];

function retailerFromHost(host: string): string {
  for (const [re, slug] of RETAILER_MAP) {
    if (re.test(host)) return slug;
  }
  return "other";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta\\s+[^>]*?(?:property|name)=["']${name}["'][^>]*?content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
  const re2 = new RegExp(
    `<meta\\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']${name}["']`,
    "i",
  );
  return html.match(re2) ? decodeEntities(html.match(re2)![1]) : undefined;
}

function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      /* ignore malformed JSON-LD blocks */
    }
  }
  return blocks;
}

type ProductMeta = {
  title?: string;
  image_url?: string;
  price?: number;
  currency?: string;
  retailer: string;
  msrp_usd?: number;
};

function pickProduct(blocks: unknown[]): {
  name?: string;
  image?: string;
  price?: number;
  currency?: string;
} {
  const walk = (node: unknown): {
    name?: string;
    image?: string;
    price?: number;
    currency?: string;
  } | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      for (const item of node) {
        const r = walk(item);
        if (r) return r;
      }
      return undefined;
    }
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isProduct = Array.isArray(type)
      ? (type as string[]).includes("Product")
      : type === "Product";
    if (isProduct) {
      const offers = obj["offers"] as Record<string, unknown> | unknown[] | undefined;
      let price: number | undefined;
      let currency: string | undefined;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      if (offer && typeof offer === "object") {
        const o = offer as Record<string, unknown>;
        const p = o["price"] ?? o["lowPrice"];
        if (typeof p === "number") price = p;
        else if (typeof p === "string" && p) price = parseFloat(p);
        const c = o["priceCurrency"];
        if (typeof c === "string") currency = c;
      }
      const image = obj["image"];
      const imgStr = Array.isArray(image) ? (image[0] as string) : (image as string);
      return {
        name: typeof obj["name"] === "string" ? (obj["name"] as string) : undefined,
        image: typeof imgStr === "string" ? imgStr : undefined,
        price,
        currency,
      };
    }
    if (obj["@graph"]) return walk(obj["@graph"]);
    return undefined;
  };
  for (const b of blocks) {
    const r = walk(b);
    if (r) return r;
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Require an authenticated user so we don't expose a public URL fetcher.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Invalid token" }, 401);

  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || !url) return json({ error: "url required" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad scheme");
  } catch {
    return json({ error: "invalid_url" }, 400);
  }

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TheVaultBot/1.0; +https://thevault.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return json({ error: `fetch_failed_${res.status}` }, 502);
    html = await res.text();
  } catch (e) {
    return json({ error: `fetch_error`, detail: String(e).slice(0, 200) }, 502);
  }

  const retailer = retailerFromHost(parsed.hostname);
  const ogTitle = metaContent(html, "og:title");
  const ogImage = metaContent(html, "og:image");
  const ogPriceAmount = metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount");
  const ogPriceCurrency =
    metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency");
  const docTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const docTitle = docTitleMatch ? decodeEntities(docTitleMatch[1]).trim() : undefined;

  const ld = pickProduct(jsonLdBlocks(html));

  const meta: ProductMeta = {
    title: ogTitle ?? ld.name ?? docTitle,
    image_url: ogImage ?? ld.image,
    price:
      ld.price ??
      (ogPriceAmount && !Number.isNaN(parseFloat(ogPriceAmount))
        ? parseFloat(ogPriceAmount)
        : undefined),
    currency: ld.currency ?? ogPriceCurrency,
    retailer,
  };

  return json(meta);
});
