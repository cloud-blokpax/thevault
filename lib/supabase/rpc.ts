type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rpc(client: unknown, name: string, args: Record<string, unknown>) {
  const c = client as { rpc: RpcCall };
  return c.rpc(name, args);
}

export type TripStatusResult = {
  trip_id: string;
  is_open: boolean;
  closed_at: string | null;
};

export async function setTripStatus(
  supabase: unknown,
  tripId: string,
  open: boolean,
): Promise<TripStatusResult> {
  const { data, error } = await rpc(supabase, "set_trip_status", {
    p_trip_id: tripId,
    p_open: open,
  });
  if (error) throw new Error(error.message);
  return data as TripStatusResult;
}

export async function reallocateTripTravel(
  supabase: unknown,
  tripId: string,
): Promise<unknown> {
  const { data, error } = await rpc(supabase, "reallocate_trip_travel", {
    p_trip_id: tripId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export type ActivityLogRow = {
  occurred_at: string;
  user_display_name: string | null;
  user_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: "trips" | "inventory_items" | string;
  row_id: string;
  item_name: string | null;
  field_changes: Record<string, unknown> | null;
};

export async function tripActivityLog(
  supabase: unknown,
  tripId: string,
): Promise<ActivityLogRow[]> {
  const { data, error } = await rpc(supabase, "trip_activity_log", {
    p_trip_id: tripId,
  });
  if (error) throw new Error(error.message);
  return (data as ActivityLogRow[]) ?? [];
}

export type InventoryItemDetail = {
  item: {
    id: string;
    status:
      | "pending"
      | "bought"
      | "in_transit"
      | "landed"
      | "listed"
      | "sold"
      | "cancelled";
    buy_cost_local: number;
    buy_currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD";
    buy_location: string | null;
    source: string | null;
    bought_on: string | null;
    partner_owner: string | null;
    trip_id: string | null;
    target_market: string | null;
    sell_currency: "USD" | "EUR" | "GBP" | "JPY" | "CAD" | null;
    listed_price: number | null;
    listed_at: string | null;
    sold_price: number | null;
    sold_at: string | null;
    sold_to: string | null;
    allocated_travel: number;
    allocated_travel_manual: boolean;
    fx_rate_locked: number | null;
    margin_cd_override: number | null;
    margin_pp_override: number | null;
    notes: string | null;
    visibility_buyer: boolean;
    card_id: string;
    consignor_id: string | null;
    updated_at: string;
  };
  card: {
    id: string;
    name: string;
    set_name: string | null;
    set_code: string | null;
    card_number: string | null;
    rarity: string | null;
    language: string;
    is_foil: boolean;
    is_sealed: boolean;
    image_url: string | null;
    game: string;
    attributes: Record<string, unknown> | null;
  } | null;
  trip: {
    id: string;
    label: string;
    direction: string;
    departed_on: string | null;
    arrived_on: string | null;
    closed_at: string | null;
  } | null;
  pricing: {
    us_market: number | null;
    us_currency: string | null;
    us_captured_at: string | null;
    eu_market: number | null;
    eu_currency: string | null;
    eu_captured_at: string | null;
  } | null;
};

export async function getInventoryItemDetail(
  supabase: unknown,
  itemId: string,
): Promise<InventoryItemDetail | null> {
  const { data, error } = await rpc(supabase, "get_inventory_item_detail", {
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
  return (data as InventoryItemDetail | null) ?? null;
}

export async function inventoryItemActivityLog(
  supabase: unknown,
  itemId: string,
): Promise<ActivityLogRow[]> {
  const { data, error } = await rpc(supabase, "inventory_item_activity_log", {
    p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
  return (data as ActivityLogRow[]) ?? [];
}
