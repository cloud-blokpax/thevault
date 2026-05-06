"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/database";

type SettingRow = Tables<"settings">;

export function SettingsForm({ initialSettings }: { initialSettings: SettingRow[] }) {
  const [rows, setRows] = useState<SettingRow[]>(initialSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map((s) => [s.key, formatValue(s.value)])),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("settings")
        .update({ value: value as never, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
  });

  async function save(key: string) {
    const raw = drafts[key];
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // keep as string
    }
    setSavingKey(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      await mutation.mutateAsync({ key, value: parsed });
      setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value: parsed as never } : r)));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: (err as Error).message }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Margins & splits</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          Values can be a number, string, or JSON object/array. Edits are saved per-row.
        </p>
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.key] ?? "";
            const isMulti = draft.length > 30 || draft.includes("\n") || draft.startsWith("{") || draft.startsWith("[");
            return (
              <div key={row.key} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`set-${row.key}`} className="font-mono text-xs">
                      {row.key}
                    </Label>
                    {row.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  {isMulti ? (
                    <Textarea
                      id={`set-${row.key}`}
                      rows={4}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <Input
                      id={`set-${row.key}`}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  )}
                </div>
                {errors[row.key] && (
                  <p className="mt-2 text-xs text-destructive">{errors[row.key]}</p>
                )}
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => save(row.key)}
                    disabled={savingKey === row.key || draft === formatValue(row.value)}
                  >
                    {savingKey === row.key ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No settings rows.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
}
