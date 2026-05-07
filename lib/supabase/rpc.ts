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
