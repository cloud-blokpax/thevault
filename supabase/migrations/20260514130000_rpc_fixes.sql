-- Flesh out RPCs whose stub bodies were placeholders:
--   1) get_inventory_item_detail: source `is_foil` from the inventory item
--      (cards has no is_foil), and populate the `pricing` block from the
--      potential_deals matview (US + EU latest aggregates).
--   2) trip_activity_log / inventory_item_activity_log: resolve `item_name`
--      via inventory_items.card_id -> cards.canonical_name.

CREATE OR REPLACE FUNCTION public.get_inventory_item_detail(p_item_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'item', to_jsonb(i.*),
    'card', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', c.id,
      'name', c.canonical_name,
      'canonical_name', c.canonical_name,
      'set_name', c.set_name,
      'set_code', c.set_code,
      'card_number', c.card_number,
      'rarity', c.rarity,
      'language', c.language,
      'is_foil', COALESCE(i.is_foil, false),
      'is_sealed', c.is_sealed,
      'image_url', c.image_url,
      'game', c.game,
      'attributes', c.attributes
    ) END,
    'trip', CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', t.id,
      'label', COALESCE(t.label, t.name),
      'direction', t.direction,
      'departed_on', t.departed_on,
      'arrived_on', t.arrived_on,
      'closed_at', t.closed_at
    ) END,
    'pricing', CASE WHEN pd.card_id IS NULL THEN NULL ELSE jsonb_build_object(
      'us_market', pd.us_market_min,
      'us_currency', 'USD',
      'us_captured_at', pd.us_captured_at,
      'eu_market', pd.eu_market_min,
      'eu_currency', 'EUR',
      'eu_captured_at', pd.eu_captured_at
    ) END
  )
  FROM inventory_items i
  LEFT JOIN cards c ON c.id = i.card_id
  LEFT JOIN trips t ON t.id = i.trip_id
  LEFT JOIN potential_deals pd ON pd.card_id = i.card_id
  WHERE i.id = p_item_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_item_detail(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.trip_activity_log(p_trip_id uuid)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'occurred_at', a.occurred_at,
    'user_display_name', p.display_name,
    'user_email', p.email,
    'action', a.action,
    'table_name', a.table_name,
    'row_id', a.row_id,
    'item_name', c.canonical_name,
    'field_changes', a.after_data
  )
  FROM audit_log a
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN inventory_items i
    ON a.table_name = 'inventory_items' AND i.id::text = a.row_id
  LEFT JOIN cards c ON c.id = i.card_id
  WHERE (a.table_name = 'trips' AND a.row_id = p_trip_id::text)
     OR (a.table_name = 'inventory_items'
         AND a.row_id IN (SELECT id::text FROM inventory_items WHERE trip_id = p_trip_id))
  ORDER BY a.occurred_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.trip_activity_log(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.inventory_item_activity_log(p_item_id uuid)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'occurred_at', a.occurred_at,
    'user_display_name', p.display_name,
    'user_email', p.email,
    'action', a.action,
    'table_name', a.table_name,
    'row_id', a.row_id,
    'item_name', c.canonical_name,
    'field_changes', a.after_data
  )
  FROM audit_log a
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN inventory_items i ON i.id = p_item_id
  LEFT JOIN cards c ON c.id = i.card_id
  WHERE a.table_name = 'inventory_items' AND a.row_id = p_item_id::text
  ORDER BY a.occurred_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.inventory_item_activity_log(uuid) TO authenticated;
