"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/database";

type SettingRow = Tables<"settings">;

type FieldKind = "margin" | "number" | "url" | "json";

function fieldKind(row: SettingRow): FieldKind {
  const k = row.key;
  const v = row.value;
  if (k.endsWith("_margin")) return "margin";
  if (k.startsWith("default_") && (typeof v === "number" || v == null)) return "number";
  if (k.startsWith("source_") && (typeof v === "string" || v == null)) return "url";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "url";
  return "json";
}

function toDraft(row: SettingRow): string {
  const v = row.value;
  switch (fieldKind(row)) {
    case "margin":
      return typeof v === "number" ? (v * 100).toFixed(2) : "";
    case "number":
      return typeof v === "number" ? String(v) : "";
    case "url":
      return typeof v === "string" ? v : "";
    case "json":
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v;
      return JSON.stringify(v, null, 2);
  }
}

function parseDraft(row: SettingRow, draft: string): { value: unknown; error?: string } {
  switch (fieldKind(row)) {
    case "margin": {
      const n = Number(draft);
      if (draft.trim() === "" || Number.isNaN(n)) {
        return { value: null, error: "Enter a percentage (e.g. 25 for 25%)." };
      }
      return { value: n / 100 };
    }
    case "number": {
      if (draft.trim() === "") return { value: null };
      const n = Number(draft);
      if (Number.isNaN(n)) return { value: null, error: "Enter a number." };
      return { value: n };
    }
    case "url": {
      const s = draft.trim();
      if (s === "") return { value: null };
      try {
        new URL(s);
        return { value: s };
      } catch {
        return { value: null, error: "Enter a valid URL (https://…)." };
      }
    }
    case "json": {
      const s = draft.trim();
      if (s === "") return { value: null };
      try {
        return { value: JSON.parse(s) };
      } catch {
        return { value: null, error: "Invalid JSON." };
      }
    }
  }
}

export function SettingsForm({ initialSettings }: { initialSettings: SettingRow[] }) {
  const [rows, setRows] = useState<SettingRow[]>(initialSettings);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialSettings.map((s) => [s.key, toDraft(s)])),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), 2000);
    return () => clearTimeout(t);
  }, [savedKey]);

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

  async function save(row: SettingRow) {
    const draft = drafts[row.key] ?? "";
    const parsed = parseDraft(row, draft);
    if (parsed.error) {
      setErrors((e) => ({ ...e, [row.key]: parsed.error! }));
      return;
    }
    setSavingKey(row.key);
    setErrors((e) => ({ ...e, [row.key]: "" }));
    try {
      await mutation.mutateAsync({ key: row.key, value: parsed.value });
      setRows((rs) =>
        rs.map((r) => (r.key === row.key ? { ...r, value: parsed.value as never } : r)),
      );
      setSavedKey(row.key);
    } catch (err) {
      setErrors((e) => ({ ...e, [row.key]: (err as Error).message }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Margins, sources & defaults</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map((row) => {
            const kind = fieldKind(row);
            const draft = drafts[row.key] ?? "";
            const dirty = draft !== toDraft(row);
            const fieldId = `set-${row.key}`;
            return (
              <div key={row.key} className="rounded-lg border p-3">
                <Label htmlFor={fieldId} className="font-mono text-xs">
                  {row.key}
                </Label>
                {row.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                )}
                <div className="mt-2">
                  {kind === "margin" && (
                    <div className="relative">
                      <Input
                        id={fieldId}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                        }
                        className="pr-8 font-mono text-sm"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                  {kind === "number" && (
                    <Input
                      id={fieldId}
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                      }
                      className="font-mono text-sm"
                    />
                  )}
                  {kind === "url" && (
                    <Input
                      id={fieldId}
                      type="url"
                      placeholder="https://…"
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                      }
                      className="font-mono text-sm"
                    />
                  )}
                  {kind === "json" && (
                    <Textarea
                      id={fieldId}
                      rows={4}
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [row.key]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                  )}
                </div>
                {errors[row.key] && (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {errors[row.key]}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-end gap-3">
                  {savedKey === row.key && (
                    <span className="text-xs text-emerald-600" role="status">
                      Saved
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(row)}
                    disabled={savingKey === row.key || !dirty}
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
