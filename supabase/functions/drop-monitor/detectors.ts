// Retailer-specific in-stock detectors. Each detector returns a
// normalized DetectResult so the dispatch layer doesn't have to
// know about retailer markup quirks.

export type DetectResult = {
  state: "in_stock" | "out_of_stock" | "queue" | "unknown" | "error";
  price?: number;
  currency?: string;
  signals: Record<string, unknown>;
};

export function detect(retailer: string, html: string, url: string): DetectResult {
  const r = (retailer ?? "").toLowerCase();
  if (r.includes("pokemoncenter")) return detectPokemonCenter(html, url);
  if (r.includes("target")) return detectTarget(html, url);
  if (r.includes("bestbuy")) return detectBestBuy(html, url);
  if (r.includes("walmart")) return detectWalmart(html, url);
  if (r.includes("gamestop")) return detectGameStop(html, url);
  return detectGeneric(html, url);
}

function extractJsonLdPrice(html: string): { price?: number; currency?: string } {
  const m = html.match(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/);
  const c = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/);
  return {
    price: m ? parseFloat(m[1]) : undefined,
    currency: c ? c[1] : undefined,
  };
}

function detectPokemonCenter(html: string, url: string): DetectResult {
  if (/virtualwaiting|queue-it/i.test(html) || /queue-it/i.test(url)) {
    return { state: "queue", signals: { matched: "queue-it" } };
  }
  const addToBag = /add to bag|add to cart/i.test(html);
  const outOfStock = /out of stock|sold out|notify me when available/i.test(html);
  const { price } = extractJsonLdPrice(html);

  if (outOfStock && !addToBag) {
    return {
      state: "out_of_stock",
      price,
      currency: "USD",
      signals: { outOfStock, addToBag },
    };
  }
  if (addToBag) {
    return {
      state: "in_stock",
      price,
      currency: "USD",
      signals: { outOfStock, addToBag },
    };
  }
  return { state: "unknown", signals: { outOfStock, addToBag } };
}

function detectTarget(html: string, _url: string): DetectResult {
  const oos = /sold out|out of stock|currently unavailable/i.test(html);
  const addToCart = /add to cart|preorders?\b/i.test(html);
  const priceMatch = html.match(/"current_retail":\s*([0-9]+(?:\.[0-9]+)?)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
  if (oos && !addToCart) {
    return { state: "out_of_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  if (addToCart) {
    return { state: "in_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  return { state: "unknown", signals: { oos, addToCart } };
}

function detectBestBuy(html: string, _url: string): DetectResult {
  const ld = html.match(/"availability"\s*:\s*"https?:\/\/schema\.org\/(\w+)"/i);
  const availability = ld?.[1];
  const priceMatch = html.match(
    /"priceCurrency"\s*:\s*"USD"\s*,\s*"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/,
  );
  const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;
  if (availability === "InStock") {
    return { state: "in_stock", price, currency: "USD", signals: { availability } };
  }
  if (availability === "OutOfStock" || availability === "SoldOut") {
    return { state: "out_of_stock", price, currency: "USD", signals: { availability } };
  }
  return { state: "unknown", signals: { availability } };
}

function detectWalmart(html: string, _url: string): DetectResult {
  const oos = /out of stock|sold out|not available/i.test(html);
  const addToCart = /add to cart|preorder/i.test(html);
  const { price } = extractJsonLdPrice(html);
  if (oos && !addToCart) {
    return { state: "out_of_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  if (addToCart) {
    return { state: "in_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  return { state: "unknown", signals: { oos, addToCart } };
}

function detectGameStop(html: string, _url: string): DetectResult {
  const oos = /not available|sold out|out of stock/i.test(html);
  const addToCart = /add to cart|preorder/i.test(html);
  const { price } = extractJsonLdPrice(html);
  if (oos && !addToCart) {
    return { state: "out_of_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  if (addToCart) {
    return { state: "in_stock", price, currency: "USD", signals: { oos, addToCart } };
  }
  return { state: "unknown", signals: { oos, addToCart } };
}

function detectGeneric(html: string, _url: string): DetectResult {
  const oos =
    /sold out|out of stock|currently unavailable|notify me|temporarily out/i.test(html);
  const inStock = /add to cart|add to basket|add to bag|buy now|preorder now/i.test(html);
  const { price, currency } = extractJsonLdPrice(html);
  if (oos && !inStock) {
    return {
      state: "out_of_stock",
      price,
      currency: currency ?? "USD",
      signals: { oos, inStock, generic: true },
    };
  }
  if (inStock && !oos) {
    return {
      state: "in_stock",
      price,
      currency: currency ?? "USD",
      signals: { oos, inStock, generic: true },
    };
  }
  return { state: "unknown", signals: { oos, inStock, generic: true } };
}
