"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  getUserPreferences,
  setUserPreference,
} from "@/lib/supabase/preferences";

const PREFS_QUERY_KEY = ["user-preferences"] as const;

export function useUserPreferencesQuery() {
  return useQuery({
    queryKey: PREFS_QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      return await getUserPreferences(supabase);
    },
  });
}

export function usePersistedPreference<T>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void, { isLoaded: boolean }] {
  const qc = useQueryClient();
  const prefs = useUserPreferencesQuery();
  const [local, setLocal] = useState<T>(defaultValue);
  const loadedRef = useRef(false);
  const lastWrittenRef = useRef<string>("");

  useEffect(() => {
    if (!prefs.data || loadedRef.current) return;
    const stored = (prefs.data as Record<string, unknown>)[key];
    if (stored !== undefined) {
      setLocal(stored as T);
      lastWrittenRef.current = JSON.stringify(stored);
    }
    loadedRef.current = true;
  }, [prefs.data, key]);

  useEffect(() => {
    if (!loadedRef.current) return;
    const serialized = JSON.stringify(local);
    if (serialized === lastWrittenRef.current) return;
    const handle = window.setTimeout(() => {
      lastWrittenRef.current = serialized;
      const supabase = createClient();
      setUserPreference(supabase, key, local as unknown).then(() => {
        qc.setQueryData(PREFS_QUERY_KEY, (prev: unknown) => {
          const obj = (prev as Record<string, unknown>) ?? {};
          return { ...obj, [key]: local };
        });
      }).catch(() => {
        /* swallow — preference persistence is best-effort */
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [local, key, qc]);

  return [local, setLocal, { isLoaded: loadedRef.current }];
}
