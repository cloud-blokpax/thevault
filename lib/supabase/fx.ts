type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rpc(client: unknown, name: string, args: Record<string, unknown>) {
  const c = client as { rpc: RpcCall };
  return c.rpc(name, args);
}

export type FxRateOnResult = {
  rate_date: string;
  requested_date: string;
  base_ccy: string;
  quote_ccy: string;
  rate: number;
  source: string | null;
  is_exact_match: boolean;
  days_back: number;
};

export async function fxRateOn(
  supabase: unknown,
  date: string,
  base: string,
  quote: string,
): Promise<FxRateOnResult | null> {
  const { data, error } = await rpc(supabase, "fx_rate_on", {
    p_date: date,
    p_base: base,
    p_quote: quote,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (Array.isArray(data)) {
    return (data[0] as FxRateOnResult | undefined) ?? null;
  }
  return data as FxRateOnResult;
}

export type FxLatest = {
  usd_to_eur: number;
  eur_to_usd: number;
  rate_date: string;
};

export async function fxLatest(supabase: unknown): Promise<FxLatest | null> {
  const client = supabase as {
    from: (t: string) => {
      select: (s: string) => {
        in: (
          col: string,
          vals: string[],
        ) => {
          in: (
            col: string,
            vals: string[],
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data:
                  | {
                      rate_date: string;
                      base_ccy: string;
                      quote_ccy: string;
                      rate: number;
                    }[]
                  | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
  const { data, error } = await client
    .from("fx_rates")
    .select("rate_date, base_ccy, quote_ccy, rate")
    .in("base_ccy", ["USD", "EUR"])
    .in("quote_ccy", ["USD", "EUR"])
    .order("rate_date", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (!rows.length) return null;
  const latestDate = rows[0].rate_date;
  const sameDay = rows.filter((r) => r.rate_date === latestDate);
  const usdToEur = sameDay.find(
    (r) => r.base_ccy === "USD" && r.quote_ccy === "EUR",
  );
  const eurToUsd = sameDay.find(
    (r) => r.base_ccy === "EUR" && r.quote_ccy === "USD",
  );
  if (usdToEur && eurToUsd) {
    return {
      usd_to_eur: Number(usdToEur.rate),
      eur_to_usd: Number(eurToUsd.rate),
      rate_date: latestDate,
    };
  }
  if (usdToEur) {
    return {
      usd_to_eur: Number(usdToEur.rate),
      eur_to_usd: 1 / Number(usdToEur.rate),
      rate_date: latestDate,
    };
  }
  if (eurToUsd) {
    return {
      usd_to_eur: 1 / Number(eurToUsd.rate),
      eur_to_usd: Number(eurToUsd.rate),
      rate_date: latestDate,
    };
  }
  return null;
}
