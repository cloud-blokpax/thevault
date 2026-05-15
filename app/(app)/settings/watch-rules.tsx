"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type RuleAction = "suggest" | "auto_watch_cold" | "auto_watch_warm" | "auto_watch_hot";
type Game = "pokemon" | "one_piece" | "magic" | "lorcana" | "yugioh" | "other";

type Rule = {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match_games: Game[] | null;
  match_product_types: string[] | null;
  match_retailers: string[] | null;
  match_name_keywords: string[] | null;
  match_name_excludes: string[] | null;
  msrp_usd_min: number | null;
  msrp_usd_max: number | null;
  release_within_days: number | null;
  action: RuleAction;
};

const GAMES: Game[] = ["pokemon", "one_piece", "magic", "lorcana", "yugioh", "other"];
const ACTIONS: { value: RuleAction; label: string }[] = [
  { value: "suggest", label: "Suggest" },
  { value: "auto_watch_cold", label: "Auto-watch · Cold" },
  { value: "auto_watch_warm", label: "Auto-watch · Warm" },
  { value: "auto_watch_hot", label: "Auto-watch · Hot" },
];

function parseList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function emptyRule(userId: string): Omit<Rule, "id"> & { id?: string } {
  return {
    user_id: userId,
    name: "",
    enabled: true,
    priority: 100,
    match_games: null,
    match_product_types: null,
    match_retailers: null,
    match_name_keywords: null,
    match_name_excludes: null,
    msrp_usd_min: null,
    msrp_usd_max: null,
    release_within_days: null,
    action: "suggest",
  };
}

function ruleSummary(r: Rule): string {
  const parts: string[] = [];
  if (r.match_games?.length) parts.push(r.match_games.join("/"));
  if (r.match_product_types?.length) parts.push(`type:${r.match_product_types.join(",")}`);
  if (r.match_retailers?.length) parts.push(`@${r.match_retailers.join(",")}`);
  if (r.match_name_keywords?.length) parts.push(`+(${r.match_name_keywords.join("|")})`);
  if (r.match_name_excludes?.length) parts.push(`-(${r.match_name_excludes.join("|")})`);
  if (r.msrp_usd_min != null || r.msrp_usd_max != null) {
    parts.push(
      `$${r.msrp_usd_min ?? "—"}-${r.msrp_usd_max ?? "—"}`,
    );
  }
  if (r.release_within_days != null) parts.push(`≤${r.release_within_days}d`);
  return parts.join(" · ");
}

export function WatchRules({ userId }: { userId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | (Omit<Rule, "id"> & { id?: string }) | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("drop_watch_rules" as never)
      .select(
        "id, user_id, name, enabled, priority, match_games, match_product_types, match_retailers, match_name_keywords, match_name_excludes, msrp_usd_min, msrp_usd_max, release_within_days, action",
      )
      .eq("user_id", userId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => setRules((data as unknown as Rule[]) ?? []));
  }, [userId]);

  async function saveRule(r: Omit<Rule, "id"> & { id?: string }) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      user_id: userId,
      name: r.name.trim(),
      enabled: r.enabled,
      priority: r.priority,
      match_games: r.match_games?.length ? r.match_games : null,
      match_product_types: r.match_product_types?.length ? r.match_product_types : null,
      match_retailers: r.match_retailers?.length ? r.match_retailers : null,
      match_name_keywords: r.match_name_keywords?.length ? r.match_name_keywords : null,
      match_name_excludes: r.match_name_excludes?.length ? r.match_name_excludes : null,
      msrp_usd_min: r.msrp_usd_min,
      msrp_usd_max: r.msrp_usd_max,
      release_within_days: r.release_within_days,
      action: r.action,
      updated_at: new Date().toISOString(),
    };
    let result;
    if (r.id) {
      result = await supabase
        .from("drop_watch_rules" as never)
        .update(payload as never)
        .eq("id", r.id)
        .select(
          "id, user_id, name, enabled, priority, match_games, match_product_types, match_retailers, match_name_keywords, match_name_excludes, msrp_usd_min, msrp_usd_max, release_within_days, action",
        )
        .single();
    } else {
      result = await supabase
        .from("drop_watch_rules" as never)
        .insert(payload as never)
        .select(
          "id, user_id, name, enabled, priority, match_games, match_product_types, match_retailers, match_name_keywords, match_name_excludes, msrp_usd_min, msrp_usd_max, release_within_days, action",
        )
        .single();
    }
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const saved = result.data as unknown as Rule;
    setRules((rs) => {
      const idx = rs.findIndex((x) => x.id === saved.id);
      if (idx >= 0) {
        const next = [...rs];
        next[idx] = saved;
        return next;
      }
      return [...rs, saved].sort((a, b) => a.priority - b.priority);
    });
    setEditing(null);

    // Re-run the rule against the last 90 days of drops so the user
    // sees suggestions immediately.
    if (saved.enabled) {
      supabase.rpc("rerun_rule_for_user" as never, { p_rule_id: saved.id } as never).then(() => {});
    }
  }

  async function toggleEnabled(r: Rule) {
    const supabase = createClient();
    const next = !r.enabled;
    setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: next } : x)));
    await supabase
      .from("drop_watch_rules" as never)
      .update({ enabled: next, updated_at: new Date().toISOString() } as never)
      .eq("id", r.id);
    if (next) {
      await supabase.rpc("rerun_rule_for_user" as never, { p_rule_id: r.id } as never);
    }
  }

  async function deleteRule(r: Rule) {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    const supabase = createClient();
    await supabase.from("drop_watch_rules" as never).delete().eq("id", r.id);
    setRules((rs) => rs.filter((x) => x.id !== r.id));
  }

  const sorted = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4" />
          Watch rules
        </CardTitle>
        <Button size="sm" onClick={() => setEditing(emptyRule(userId))}>
          <Plus className="mr-1 h-3 w-3" />
          New rule
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Rules evaluate every new or updated drop. First matching rule per user wins
          (sorted by priority, ascending).
        </p>

        {sorted.length === 0 && !editing && (
          <p className="text-sm text-muted-foreground">
            No rules yet. Add one to auto-watch or get suggestions on incoming drops.
          </p>
        )}

        <ul className="space-y-2">
          {sorted.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-md border p-3",
                r.enabled ? "" : "bg-muted/40 opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACTIONS.find((a) => a.value === r.action)?.label} · priority{" "}
                    {r.priority}
                  </p>
                  {ruleSummary(r) && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {ruleSummary(r)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleEnabled(r)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      r.enabled
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {r.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteRule(r)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {editing && (
          <RuleEditor
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={saveRule}
            busy={busy}
            error={error}
          />
        )}
      </CardContent>
    </Card>
  );
}

function RuleEditor({
  initial,
  onCancel,
  onSave,
  busy,
  error,
}: {
  initial: Rule | (Omit<Rule, "id"> & { id?: string });
  onCancel: () => void;
  onSave: (r: Omit<Rule, "id"> & { id?: string }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(() => ({
    ...initial,
    _games: (initial.match_games ?? []).join(","),
    _productTypes: (initial.match_product_types ?? []).join(", "),
    _retailers: (initial.match_retailers ?? []).join(", "),
    _keywords: (initial.match_name_keywords ?? []).join(", "),
    _excludes: (initial.match_name_excludes ?? []).join(", "),
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      ...draft,
      match_games: draft._games
        ? (parseList(draft._games).filter((g) => GAMES.includes(g as Game)) as Game[])
        : null,
      match_product_types: draft._productTypes ? parseList(draft._productTypes) : null,
      match_retailers: draft._retailers ? parseList(draft._retailers.toLowerCase()) : null,
      match_name_keywords: draft._keywords ? parseList(draft._keywords) : null,
      match_name_excludes: draft._excludes ? parseList(draft._excludes) : null,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border-2 border-primary/30 bg-background p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Pokémon Center ETBs under $80"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <Select
            value={draft.action}
            onValueChange={(v) => setDraft({ ...draft, action: v as RuleAction })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority (lower wins)</Label>
          <Input
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Games (comma list — {GAMES.join(", ")})</Label>
          <Input
            value={draft._games}
            onChange={(e) => setDraft({ ...draft, _games: e.target.value })}
            placeholder="pokemon, one_piece"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Product types</Label>
          <Input
            value={draft._productTypes}
            onChange={(e) => setDraft({ ...draft, _productTypes: e.target.value })}
            placeholder="etb, booster_box, premium_collection"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Retailers</Label>
          <Input
            value={draft._retailers}
            onChange={(e) => setDraft({ ...draft, _retailers: e.target.value })}
            placeholder="pokemoncenter, target, samsclub"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Name keywords (any match)</Label>
          <Input
            value={draft._keywords}
            onChange={(e) => setDraft({ ...draft, _keywords: e.target.value })}
            placeholder="charizard, umbreon, sylveon, 30th anniversary"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Exclude keywords</Label>
          <Input
            value={draft._excludes}
            onChange={(e) => setDraft({ ...draft, _excludes: e.target.value })}
            placeholder="single card, jumbo, sleeve"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">MSRP USD min</Label>
          <Input
            inputMode="decimal"
            value={draft.msrp_usd_min ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                msrp_usd_min: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">MSRP USD max</Label>
          <Input
            inputMode="decimal"
            value={draft.msrp_usd_max ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                msrp_usd_max: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Release within N days</Label>
          <Input
            type="number"
            value={draft.release_within_days ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                release_within_days: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="60"
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save rule"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
