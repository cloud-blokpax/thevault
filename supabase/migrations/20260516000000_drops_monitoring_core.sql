-- ============================================================
-- Drops monitoring infrastructure (Part 1 of the drops feature).
--
-- Adds per-link monitoring state, check history, per-domain
-- rate-limit, daily call quota, mode→interval settings, claim
-- + record RPCs, and the dispatch / prune cron jobs.
-- ============================================================

-- Enum types ---------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'monitor_mode') THEN
    CREATE TYPE monitor_mode AS ENUM ('off', 'manual', 'cold', 'warm', 'hot');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'monitor_state') THEN
    CREATE TYPE monitor_state AS ENUM ('unknown', 'in_stock', 'out_of_stock', 'queue', 'error');
  END IF;
END$$;

-- Per-link monitoring state -----------------------------------
ALTER TABLE public.drop_retailer_links
  ADD COLUMN IF NOT EXISTS monitor_mode monitor_mode NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS last_state monitor_state NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_state_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_state_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS hot_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_errors int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS detector_hint text,
  ADD COLUMN IF NOT EXISTS alert_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS drop_retailer_links_due_idx
  ON public.drop_retailer_links (next_check_at)
  WHERE monitor_mode IN ('cold', 'warm', 'hot');

CREATE INDEX IF NOT EXISTS drop_retailer_links_last_state_idx
  ON public.drop_retailer_links (last_state, last_state_changed_at DESC);

-- History (one row per check) ---------------------------------
CREATE TABLE IF NOT EXISTS public.drop_check_history (
  id bigserial PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.drop_retailer_links(id) ON DELETE CASCADE,
  drop_id uuid NOT NULL,
  state monitor_state NOT NULL,
  price_observed numeric,
  currency_observed text,
  http_status int,
  duration_ms int,
  signals jsonb,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drop_check_history_link_at_idx
  ON public.drop_check_history (link_id, checked_at DESC);

-- Per-domain politeness lock -----------------------------------
CREATE TABLE IF NOT EXISTS public.monitor_domain_locks (
  domain text PRIMARY KEY,
  last_call_at timestamptz NOT NULL DEFAULT now()
);

-- Daily call usage ledger --------------------------------------
CREATE TABLE IF NOT EXISTS public.monitor_api_usage (
  call_date date PRIMARY KEY,
  call_count int NOT NULL DEFAULT 0,
  cap_hit_count int NOT NULL DEFAULT 0,
  first_call_at timestamptz,
  last_call_at timestamptz
);

-- Per-user manual-check ledger (for the on-demand button) -----
CREATE TABLE IF NOT EXISTS public.monitor_user_check_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.drop_retailer_links(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitor_user_check_log_user_at_idx
  ON public.monitor_user_check_log (user_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS monitor_user_check_log_link_at_idx
  ON public.monitor_user_check_log (link_id, checked_at DESC);

-- Settings keys ------------------------------------------------
INSERT INTO public.settings (key, value, description) VALUES
  ('monitor_daily_call_cap',          '5000'::jsonb,  'Max retailer fetches per day across all monitors'),
  ('monitor_daily_safety_buffer',     '100'::jsonb,   'Reserved headroom under the cap'),
  ('monitor_domain_min_gap_s',        '10'::jsonb,    'Min seconds between calls to the same domain'),
  ('monitor_user_hourly_check_limit', '30'::jsonb,    'Manual "Check now" calls per user per hour'),
  ('monitor_link_cooldown_s',         '30'::jsonb,    'Cooldown between manual checks of the same link'),
  ('monitor_history_retention_days',  '7'::jsonb,     'Days of drop_check_history kept hot'),
  ('monitor_hot_auto_decay_h',        '24'::jsonb,    'Hours after which Hot mode auto-decays to Warm'),
  ('monitor_interval_cold_s',         '14400'::jsonb, 'Cold mode interval in seconds (default 4h)'),
  ('monitor_interval_warm_s',         '1800'::jsonb,  'Warm mode interval in seconds (default 30m)'),
  ('monitor_interval_hot_s',          '300'::jsonb,   'Hot mode interval in seconds (default 5m)'),
  ('monitor_dispatch_batch_size',     '10'::jsonb,    'Links claimed per dispatch tick')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RPCs
-- ============================================================

-- monitor_claim_due_links: atomically claim the next N due links.
-- The temp `next_check_at` push (90s) prevents concurrent crons
-- from double-firing; the edge function rewrites it on completion.
CREATE OR REPLACE FUNCTION public.monitor_claim_due_links(p_limit int DEFAULT 10)
RETURNS TABLE (
  link_id uuid,
  drop_id uuid,
  url text,
  retailer text,
  detector_hint text,
  monitor_mode monitor_mode
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM drop_retailer_links
    WHERE monitor_mode IN ('cold', 'warm', 'hot')
      AND (next_check_at IS NULL OR next_check_at <= now())
    ORDER BY next_check_at NULLS FIRST
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE drop_retailer_links l
    SET next_check_at = now() + interval '90 seconds'
    WHERE l.id IN (SELECT id FROM due)
    RETURNING l.id, l.drop_id, l.url, l.retailer, l.detector_hint, l.monitor_mode
  )
  SELECT c.id, c.drop_id, c.url, c.retailer, c.detector_hint, c.monitor_mode FROM claimed c;
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_claim_due_links(int) TO service_role;

-- monitor_record_result: persist a check, compute next_check_at,
-- decay Hot → Warm, update parent link, and return whether to
-- fire an alert.
CREATE OR REPLACE FUNCTION public.monitor_record_result(
  p_link_id uuid,
  p_state monitor_state,
  p_price numeric DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_http_status int DEFAULT NULL,
  p_duration_ms int DEFAULT NULL,
  p_signals jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link drop_retailer_links%ROWTYPE;
  v_prev_state monitor_state;
  v_state_changed boolean;
  v_interval_s int;
  v_mode monitor_mode;
  v_decay_h int;
  v_should_alert boolean := false;
BEGIN
  SELECT * INTO v_link FROM drop_retailer_links WHERE id = p_link_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_not_found');
  END IF;

  v_prev_state := v_link.last_state;
  v_state_changed := (v_prev_state IS DISTINCT FROM p_state);
  v_mode := v_link.monitor_mode;

  SELECT (value::text)::int INTO v_decay_h FROM settings WHERE key = 'monitor_hot_auto_decay_h';
  v_decay_h := COALESCE(v_decay_h, 24);
  IF v_mode = 'hot' AND v_link.hot_expires_at IS NOT NULL AND v_link.hot_expires_at <= now() THEN
    v_mode := 'warm';
  END IF;

  SELECT (value::text)::int INTO v_interval_s FROM settings WHERE key =
    CASE v_mode
      WHEN 'cold' THEN 'monitor_interval_cold_s'
      WHEN 'warm' THEN 'monitor_interval_warm_s'
      WHEN 'hot'  THEN 'monitor_interval_hot_s'
      ELSE 'monitor_interval_cold_s'
    END;
  v_interval_s := COALESCE(v_interval_s, 14400);

  IF p_state = 'error' THEN
    v_interval_s := v_interval_s * LEAST(POWER(2, v_link.consecutive_errors + 1)::int, 16);
  END IF;

  -- 0-2s jitter to avoid herding
  v_interval_s := v_interval_s + floor(random() * 3)::int;

  UPDATE drop_retailer_links
  SET
    last_state = p_state,
    last_state_at = now(),
    last_state_changed_at = CASE WHEN v_state_changed THEN now() ELSE v_link.last_state_changed_at END,
    next_check_at = now() + (v_interval_s || ' seconds')::interval,
    consecutive_errors = CASE WHEN p_state = 'error'
                              THEN v_link.consecutive_errors + 1
                              ELSE 0 END,
    last_error = CASE WHEN p_state = 'error' THEN p_error ELSE NULL END,
    in_stock = CASE WHEN p_state = 'in_stock' THEN true
                    WHEN p_state = 'out_of_stock' THEN false
                    ELSE v_link.in_stock END,
    stock_checked_at = now(),
    price_usd = COALESCE(CASE WHEN p_currency = 'USD' THEN p_price END, v_link.price_usd),
    price_eur = COALESCE(CASE WHEN p_currency = 'EUR' THEN p_price END, v_link.price_eur),
    monitor_mode = v_mode
  WHERE id = p_link_id;

  INSERT INTO drop_check_history
    (link_id, drop_id, state, price_observed, currency_observed,
     http_status, duration_ms, signals, error)
  VALUES
    (p_link_id, v_link.drop_id, p_state, p_price, p_currency,
     p_http_status, p_duration_ms, p_signals, p_error);

  v_should_alert := v_state_changed AND p_state = 'in_stock';

  RETURN jsonb_build_object(
    'ok', true,
    'state_changed', v_state_changed,
    'should_alert', v_should_alert,
    'previous_state', v_prev_state,
    'alert_user_ids', to_jsonb(v_link.alert_user_ids),
    'next_check_at', now() + (v_interval_s || ' seconds')::interval
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_record_result(uuid, monitor_state, numeric, text, int, int, jsonb, text)
  TO service_role;

-- monitor_try_consume_call: daily quota gate (mirrors ebay_try_consume_call).
CREATE OR REPLACE FUNCTION public.monitor_try_consume_call(p_calls int DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap int; v_buffer int; v_effective int; v_current int;
BEGIN
  SELECT (value::text)::int INTO v_cap FROM settings WHERE key = 'monitor_daily_call_cap';
  SELECT (value::text)::int INTO v_buffer FROM settings WHERE key = 'monitor_daily_safety_buffer';
  v_effective := COALESCE(v_cap, 5000) - COALESCE(v_buffer, 100);

  INSERT INTO monitor_api_usage (call_date, call_count, first_call_at, last_call_at)
  VALUES (current_date, 0, now(), now())
  ON CONFLICT (call_date) DO NOTHING;

  SELECT call_count INTO v_current FROM monitor_api_usage WHERE call_date = current_date;

  IF v_current + p_calls > v_effective THEN
    UPDATE monitor_api_usage SET cap_hit_count = cap_hit_count + 1 WHERE call_date = current_date;
    RETURN jsonb_build_object('allowed', false, 'used', v_current, 'cap', v_effective);
  END IF;

  UPDATE monitor_api_usage SET call_count = call_count + p_calls, last_call_at = now()
  WHERE call_date = current_date;
  RETURN jsonb_build_object('allowed', true, 'used', v_current + p_calls, 'cap', v_effective);
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_try_consume_call(int) TO authenticated, service_role;

-- monitor_try_user_check: per-user hourly + per-link cooldown gate
-- for the on-demand "Check now" button. Returns {allowed, reason?}.
CREATE OR REPLACE FUNCTION public.monitor_try_user_check(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hourly_limit int;
  v_cooldown_s int;
  v_hourly_used int;
  v_last_link_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  SELECT (value::text)::int INTO v_hourly_limit FROM settings WHERE key = 'monitor_user_hourly_check_limit';
  SELECT (value::text)::int INTO v_cooldown_s   FROM settings WHERE key = 'monitor_link_cooldown_s';
  v_hourly_limit := COALESCE(v_hourly_limit, 30);
  v_cooldown_s   := COALESCE(v_cooldown_s, 30);

  SELECT count(*) INTO v_hourly_used
  FROM monitor_user_check_log
  WHERE user_id = v_user_id AND checked_at > now() - interval '1 hour';
  IF v_hourly_used >= v_hourly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'hourly_limit',
                              'used', v_hourly_used, 'limit', v_hourly_limit);
  END IF;

  SELECT max(checked_at) INTO v_last_link_at
  FROM monitor_user_check_log
  WHERE link_id = p_link_id;
  IF v_last_link_at IS NOT NULL
     AND v_last_link_at > now() - (v_cooldown_s || ' seconds')::interval THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'link_cooldown',
                              'retry_after_s', v_cooldown_s -
                                 EXTRACT(EPOCH FROM (now() - v_last_link_at))::int);
  END IF;

  INSERT INTO monitor_user_check_log (user_id, link_id) VALUES (v_user_id, p_link_id);
  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_try_user_check(uuid) TO authenticated;

-- monitor_set_link_mode: set monitor_mode on a link (and stamp hot_expires_at when Hot).
-- Wrapped so the frontend doesn't have to compute hot_expires_at.
CREATE OR REPLACE FUNCTION public.monitor_set_link_mode(
  p_link_id uuid,
  p_mode monitor_mode
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_h int;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;
  SELECT is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT (value::text)::int INTO v_decay_h FROM settings WHERE key = 'monitor_hot_auto_decay_h';
  v_decay_h := COALESCE(v_decay_h, 24);

  UPDATE drop_retailer_links
  SET monitor_mode = p_mode,
      hot_expires_at = CASE WHEN p_mode = 'hot'
                            THEN now() + (v_decay_h || ' hours')::interval
                            ELSE NULL END,
      next_check_at = CASE WHEN p_mode IN ('cold', 'warm', 'hot')
                           THEN now()  -- check immediately on enable
                           ELSE NULL END,
      consecutive_errors = 0,
      last_error = NULL,
      alert_user_ids = CASE
        WHEN p_mode IN ('cold', 'warm', 'hot') AND NOT (v_user_id = ANY(alert_user_ids))
          THEN array_append(alert_user_ids, v_user_id)
        ELSE alert_user_ids
      END
  WHERE id = p_link_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitor_set_link_mode(uuid, monitor_mode) TO authenticated;

-- ============================================================
-- Cron jobs (pg_cron + pg_net)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop any prior versions before re-scheduling
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drop-monitor-dispatch') THEN
      PERFORM cron.unschedule('drop-monitor-dispatch');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drop-history-prune') THEN
      PERFORM cron.unschedule('drop-history-prune');
    END IF;

    PERFORM cron.schedule(
      'drop-monitor-dispatch',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://oclhdvxktfvkmjkdfeic.supabase.co/functions/v1/drop-monitor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT get_vault_secret('cron_secret'))
        ),
        body := jsonb_build_object('mode', 'dispatch',
                                   'batch_size',
                                   COALESCE((SELECT (value::text)::int FROM settings WHERE key='monitor_dispatch_batch_size'), 10))
      );
      $cron$
    );

    PERFORM cron.schedule(
      'drop-history-prune',
      '0 3 * * *',
      $cron$
      DELETE FROM drop_check_history
      WHERE checked_at < now() - (
        COALESCE((SELECT (value::text)::int FROM settings WHERE key='monitor_history_retention_days'), 7)::text || ' days'
      )::interval;
      $cron$
    );
  END IF;
END$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.drop_check_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drop_check_history_read" ON public.drop_check_history;
CREATE POLICY "drop_check_history_read"
  ON public.drop_check_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE public.monitor_user_check_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monitor_user_check_log_own" ON public.monitor_user_check_log;
CREATE POLICY "monitor_user_check_log_own"
  ON public.monitor_user_check_log
  FOR SELECT
  USING (auth.uid() = user_id);
