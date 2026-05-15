-- ============================================================
-- Drops feature: push subscriptions (Part 1.8), calendar
-- imports (Part 3), and the watch-rules engine (Part 4).
-- ============================================================

-- ============================================================
-- 1. Web Push subscription storage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs_own" ON public.push_subscriptions;
CREATE POLICY "push_subs_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Curated release calendar
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drop_calendar_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game game_kind NOT NULL,
  name text NOT NULL,
  set_code text,
  set_name text,
  product_type text,
  release_date date,
  msrp_usd numeric,
  msrp_eur numeric,
  expected_retailers text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_url text,
  notes text,
  imported_drop_id uuid REFERENCES public.product_drops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (game, name, release_date)
);

CREATE INDEX IF NOT EXISTS drop_calendar_pending_idx
  ON public.drop_calendar_entries (release_date)
  WHERE imported_drop_id IS NULL;

ALTER TABLE public.drop_calendar_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drop_calendar_read_auth" ON public.drop_calendar_entries;
DROP POLICY IF EXISTS "drop_calendar_admin_write" ON public.drop_calendar_entries;
CREATE POLICY "drop_calendar_read_auth"
  ON public.drop_calendar_entries
  FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "drop_calendar_admin_write"
  ON public.drop_calendar_entries
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- promote_calendar_entry: create a product_drops row + skeleton
-- retailer links from a calendar entry. Returns the new drop id.
CREATE OR REPLACE FUNCTION public.promote_calendar_entry(p_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry drop_calendar_entries%ROWTYPE;
  v_drop_id uuid;
  v_retailer text;
  v_idx int := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_entry FROM drop_calendar_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'calendar entry not found';
  END IF;
  IF v_entry.imported_drop_id IS NOT NULL THEN
    RETURN v_entry.imported_drop_id;
  END IF;

  INSERT INTO product_drops (
    game, name, set_code, set_name, product_type, release_date,
    msrp_usd, msrp_eur, notes, status, source
  ) VALUES (
    v_entry.game, v_entry.name, v_entry.set_code, v_entry.set_name,
    v_entry.product_type, v_entry.release_date,
    v_entry.msrp_usd, v_entry.msrp_eur, v_entry.notes, 'upcoming', 'calendar'
  ) RETURNING id INTO v_drop_id;

  FOREACH v_retailer IN ARRAY COALESCE(v_entry.expected_retailers, ARRAY[]::text[])
  LOOP
    INSERT INTO drop_retailer_links (drop_id, retailer, region, url, sort_order, monitor_mode)
    VALUES (v_drop_id, v_retailer, 'US', '', v_idx, 'off');
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE drop_calendar_entries
  SET imported_drop_id = v_drop_id
  WHERE id = p_entry_id;

  RETURN v_drop_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_calendar_entry(uuid) TO authenticated;

-- ============================================================
-- 3. Watch rules + suggestions
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_action') THEN
    CREATE TYPE rule_action AS ENUM ('suggest', 'auto_watch_cold', 'auto_watch_warm', 'auto_watch_hot');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.drop_watch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  match_games game_kind[],
  match_product_types text[],
  match_retailers text[],
  match_name_keywords text[],
  match_name_excludes text[],
  msrp_usd_min numeric,
  msrp_usd_max numeric,
  release_within_days int,
  action rule_action NOT NULL DEFAULT 'suggest',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drop_watch_rules_user_priority_idx
  ON public.drop_watch_rules (user_id, priority, created_at);

ALTER TABLE public.drop_watch_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "watch_rules_own" ON public.drop_watch_rules;
CREATE POLICY "watch_rules_own"
  ON public.drop_watch_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.drop_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drop_id uuid NOT NULL REFERENCES public.product_drops(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.drop_watch_rules(id) ON DELETE SET NULL,
  reason text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, drop_id)
);

CREATE INDEX IF NOT EXISTS drop_suggestions_user_idx
  ON public.drop_suggestions (user_id, dismissed, created_at DESC);

ALTER TABLE public.drop_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drop_suggestions_own" ON public.drop_suggestions;
CREATE POLICY "drop_suggestions_own"
  ON public.drop_suggestions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Evaluator: applies enabled rules against a drop. First-match
-- per user is honoured (rules sorted by priority asc, then ctime).
-- Auto-watch never downgrades an already-configured link
-- (monitor_mode != 'off' is preserved).
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_drop_against_rules(p_drop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d product_drops%ROWTYPE;
  r drop_watch_rules%ROWTYPE;
  v_retailers text[];
  v_name_lower text;
  v_matches int := 0;
  v_actions jsonb := '[]'::jsonb;
  v_decay_h int;
  v_seen_users uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO d FROM product_drops WHERE id = p_drop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'drop_not_found');
  END IF;

  SELECT (value::text)::int INTO v_decay_h FROM settings WHERE key = 'monitor_hot_auto_decay_h';
  v_decay_h := COALESCE(v_decay_h, 24);

  SELECT array_agg(DISTINCT retailer) INTO v_retailers
  FROM drop_retailer_links WHERE drop_id = p_drop_id;
  v_retailers := COALESCE(v_retailers, ARRAY[]::text[]);
  v_name_lower := lower(d.name);

  FOR r IN
    SELECT * FROM drop_watch_rules
    WHERE enabled = true
    ORDER BY priority ASC, created_at ASC
  LOOP
    -- Enforce first-match-wins per user
    IF r.user_id = ANY(v_seen_users) THEN CONTINUE; END IF;

    IF r.match_games IS NOT NULL AND array_length(r.match_games, 1) > 0
       AND NOT (d.game = ANY(r.match_games)) THEN CONTINUE; END IF;

    IF r.match_product_types IS NOT NULL AND array_length(r.match_product_types, 1) > 0
       AND (d.product_type IS NULL OR NOT (d.product_type = ANY(r.match_product_types)))
    THEN CONTINUE; END IF;

    IF r.match_retailers IS NOT NULL AND array_length(r.match_retailers, 1) > 0
       AND NOT (r.match_retailers && v_retailers) THEN CONTINUE; END IF;

    IF r.match_name_keywords IS NOT NULL AND array_length(r.match_name_keywords, 1) > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM unnest(r.match_name_keywords) kw
        WHERE v_name_lower LIKE '%' || lower(kw) || '%'
      ) THEN CONTINUE; END IF;
    END IF;

    IF r.match_name_excludes IS NOT NULL AND array_length(r.match_name_excludes, 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM unnest(r.match_name_excludes) kw
        WHERE v_name_lower LIKE '%' || lower(kw) || '%'
      ) THEN CONTINUE; END IF;
    END IF;

    IF r.msrp_usd_min IS NOT NULL AND (d.msrp_usd IS NULL OR d.msrp_usd < r.msrp_usd_min)
      THEN CONTINUE; END IF;
    IF r.msrp_usd_max IS NOT NULL AND (d.msrp_usd IS NULL OR d.msrp_usd > r.msrp_usd_max)
      THEN CONTINUE; END IF;

    IF r.release_within_days IS NOT NULL AND d.release_date IS NOT NULL
       AND d.release_date > current_date + (r.release_within_days || ' days')::interval
      THEN CONTINUE; END IF;

    -- Match
    v_matches := v_matches + 1;
    v_seen_users := array_append(v_seen_users, r.user_id);
    v_actions := v_actions || jsonb_build_object(
      'rule_id', r.id, 'rule_name', r.name, 'user_id', r.user_id, 'action', r.action
    );

    IF r.action = 'suggest' THEN
      INSERT INTO drop_suggestions (user_id, drop_id, rule_id, reason)
      VALUES (r.user_id, d.id, r.id, 'Matched: ' || r.name)
      ON CONFLICT (user_id, drop_id) DO NOTHING;
    ELSIF r.action IN ('auto_watch_cold', 'auto_watch_warm', 'auto_watch_hot') THEN
      UPDATE drop_retailer_links
      SET monitor_mode = CASE r.action
            WHEN 'auto_watch_cold' THEN 'cold'::monitor_mode
            WHEN 'auto_watch_warm' THEN 'warm'::monitor_mode
            WHEN 'auto_watch_hot'  THEN 'hot'::monitor_mode
          END,
          hot_expires_at = CASE WHEN r.action = 'auto_watch_hot'
                                THEN now() + (v_decay_h || ' hours')::interval
                                ELSE NULL END,
          next_check_at = now(),
          alert_user_ids = CASE
            WHEN r.user_id = ANY(alert_user_ids) THEN alert_user_ids
            ELSE array_append(alert_user_ids, r.user_id)
          END
      WHERE drop_id = d.id
        AND monitor_mode = 'off'
        AND url <> '';

      -- Surface as a "watching" suggestion too so the user can see it.
      INSERT INTO drop_suggestions (user_id, drop_id, rule_id, reason)
      VALUES (r.user_id, d.id, r.id, 'Auto-watching: ' || r.name)
      ON CONFLICT (user_id, drop_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('matches', v_matches, 'actions', v_actions);
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_drop_against_rules(uuid) TO authenticated, service_role;

-- ============================================================
-- Triggers: re-evaluate rules whenever a drop or its retailers
-- change in a way that could affect matches.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_drop_evaluate_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM evaluate_drop_against_rules(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_drops_evaluate_rules ON public.product_drops;
CREATE TRIGGER product_drops_evaluate_rules
  AFTER INSERT OR UPDATE OF game, name, product_type, msrp_usd, release_date
  ON public.product_drops
  FOR EACH ROW EXECUTE FUNCTION trg_drop_evaluate_rules();

CREATE OR REPLACE FUNCTION public.trg_link_evaluate_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM evaluate_drop_against_rules(NEW.drop_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drop_retailer_links_evaluate_rules ON public.drop_retailer_links;
CREATE TRIGGER drop_retailer_links_evaluate_rules
  AFTER INSERT ON public.drop_retailer_links
  FOR EACH ROW EXECUTE FUNCTION trg_link_evaluate_rules();

-- When a user creates or enables a rule, evaluate it against
-- recently-relevant drops (last 90 days OR future release).
CREATE OR REPLACE FUNCTION public.rerun_rule_for_user(p_rule_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_drop_id uuid;
BEGIN
  FOR v_drop_id IN
    SELECT id FROM product_drops
    WHERE (release_date IS NULL OR release_date >= current_date - interval '90 days')
    ORDER BY release_date DESC NULLS LAST
    LIMIT 500
  LOOP
    PERFORM evaluate_drop_against_rules(v_drop_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rerun_rule_for_user(uuid) TO authenticated;

-- Public-readable VAPID key + retailer preset defaults
INSERT INTO public.settings (key, value, description) VALUES
  ('vapid_public_key',
   '""'::jsonb,
   'VAPID public key (base64url). Browser uses this to subscribe to push.'),
  ('retailer_presets',
   '[
     {"name": "US Pokémon big-box", "retailers": ["pokemoncenter","target","walmart","bestbuy","gamestop"]},
     {"name": "US Costco / Sam''s", "retailers": ["costco","samsclub"]},
     {"name": "EU Pokémon Center", "retailers": ["pokemoncenter"]},
     {"name": "TCG online", "retailers": ["tcgplayer","troll_and_toad","collectorscache"]}
   ]'::jsonb,
   'Saved retailer groups for the add-drop form')
ON CONFLICT (key) DO NOTHING;
