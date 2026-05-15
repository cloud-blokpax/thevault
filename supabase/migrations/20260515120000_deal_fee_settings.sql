-- Settings for the deals "Source data" dialog math breakdown:
-- fees and shipping needed to compute realistic net profit.
INSERT INTO public.settings (key, value, description)
VALUES
  ('default_cardmarket_fee_pct',
   to_jsonb(0.05::numeric),
   'Cardmarket seller commission (default 5% for unregistered/casual sellers)'),
  ('default_payment_fee_pct',
   to_jsonb(0.03::numeric),
   'Payment processing + FX fees applied to buy cost (e.g. PayPal ~3%)'),
  ('default_shipping_us_to_eu_usd',
   to_jsonb(18::numeric),
   'Typical shipping cost US to EU per single card with tracking (USD)')
ON CONFLICT (key) DO NOTHING;
