type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

function rpc(client: unknown, name: string, args: Record<string, unknown>) {
  const c = client as { rpc: RpcCall };
  return c.rpc(name, args);
}

export type UserPreferences = Record<string, unknown>;

export async function getUserPreferences(
  supabase: unknown,
): Promise<UserPreferences> {
  const client = supabase as {
    from: (t: string) => {
      select: (s: string) => {
        maybeSingle: () => Promise<{
          data: { preferences: UserPreferences | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await client
    .from("user_preferences")
    .select("preferences")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.preferences as UserPreferences) ?? {};
}

export async function setUserPreference(
  supabase: unknown,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await rpc(supabase, "upsert_user_preference", {
    p_key: key,
    p_value: value,
  });
  if (error) throw new Error(error.message);
}
