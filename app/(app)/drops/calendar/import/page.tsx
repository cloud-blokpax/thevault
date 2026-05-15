"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const runtime = "edge";

type ParsedRow = {
  game: string;
  name: string;
  set_code?: string;
  set_name?: string;
  product_type?: string;
  release_date?: string;
  msrp_usd?: number;
  msrp_eur?: number;
  expected_retailers: string[];
  source_url?: string;
  notes?: string;
  _error?: string;
};

const VALID_GAMES = new Set([
  "pokemon",
  "one_piece",
  "magic",
  "lorcana",
  "yugioh",
  "other",
]);

// Naive CSV parser that handles quoted fields with commas. Returns
// rows where each row is a {header: value} map. Honest about what it
// supports: doesn't handle escaped quotes inside quoted fields.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headerLine = lines.shift()!;
  const headers = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  return lines.map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizeRow(raw: Record<string, string>): ParsedRow {
  const game = (raw["game"] ?? "").toLowerCase();
  const name = raw["name"] ?? "";
  let _error: string | undefined;
  if (!VALID_GAMES.has(game)) _error = "invalid game";
  if (!name) _error = (_error ?? "") + " missing name";

  const retailers = (raw["expected_retailers"] ?? "")
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return {
    game,
    name,
    set_code: raw["set_code"] || undefined,
    set_name: raw["set_name"] || undefined,
    product_type: raw["product_type"] || undefined,
    release_date: raw["release_date"] || undefined,
    msrp_usd: raw["msrp_usd"] ? Number(raw["msrp_usd"]) : undefined,
    msrp_eur: raw["msrp_eur"] ? Number(raw["msrp_eur"]) : undefined,
    expected_retailers: retailers,
    source_url: raw["source_url"] || undefined,
    notes: raw["notes"] || undefined,
    _error,
  };
}

export default function CalendarImportPage() {
  const router = useRouter();
  const [text, setText] = useState(`game,name,set_code,set_name,product_type,release_date,msrp_usd,expected_retailers,source_url
pokemon,Example ETB,SV09,Example Set,etb,2026-08-15,49.99,"pokemoncenter,target,bestbuy",https://example.com/`);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const rows = useMemo(() => parseCsv(text).map(normalizeRow), [text]);
  const valid = rows.filter((r) => !r._error);
  const errors = rows.filter((r) => r._error);

  async function importRows() {
    if (importing || valid.length === 0) return;
    setImporting(true);
    setResult(null);
    const supabase = createClient();
    let inserted = 0;
    let skipped = 0;
    const errs: string[] = [];

    // Inserted in small batches so a single conflict doesn't sink the whole load.
    const BATCH = 25;
    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map((r) => ({
        game: r.game,
        name: r.name,
        set_code: r.set_code ?? null,
        set_name: r.set_name ?? null,
        product_type: r.product_type ?? null,
        release_date: r.release_date ?? null,
        msrp_usd: r.msrp_usd ?? null,
        msrp_eur: r.msrp_eur ?? null,
        expected_retailers: r.expected_retailers,
        source_url: r.source_url ?? null,
        notes: r.notes ?? null,
      }));
      const { data, error } = await supabase
        .from("drop_calendar_entries" as never)
        .upsert(batch as never, {
          onConflict: "game,name,release_date",
          ignoreDuplicates: true,
        } as never)
        .select("id");
      if (error) {
        errs.push(error.message);
        continue;
      }
      const newCount = (data as unknown as { id: string }[] | null)?.length ?? 0;
      inserted += newCount;
      skipped += batch.length - newCount;
    }

    setImporting(false);
    setResult({ inserted, skipped, errors: errs });
    if (inserted > 0) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/drops/calendar">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Calendar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import calendar CSV</h1>
        <p className="text-sm text-muted-foreground">
          Required columns: <code>game</code>, <code>name</code>. Optional:{" "}
          <code>set_code, set_name, product_type, release_date, msrp_usd, msrp_eur,
          expected_retailers, source_url, notes</code>
          . <code>expected_retailers</code> is a comma- or semicolon-separated list
          (quote the cell if comma-separated).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Parsed: {rows.length}</span>
            <span>Valid: {valid.length}</span>
            <span>Errors: {errors.length}</span>
          </div>
        </CardContent>
      </Card>

      {valid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview ({valid.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">Release</th>
                  <th className="py-2 pr-3 font-medium">Game</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Set</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">MSRP</th>
                  <th className="py-2 pr-3 font-medium">Retailers</th>
                </tr>
              </thead>
              <tbody>
                {valid.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 tabular-nums text-xs">{r.release_date ?? "TBA"}</td>
                    <td className="py-1.5 pr-3 text-xs">{r.game}</td>
                    <td className="py-1.5 pr-3 font-medium">{r.name}</td>
                    <td className="py-1.5 pr-3 text-xs">{r.set_code ?? r.set_name ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-xs">{r.product_type ?? "—"}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-xs">
                      {r.msrp_usd ? `$${r.msrp_usd}` : "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                      {r.expected_retailers.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {valid.length > 50 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing first 50 of {valid.length}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              {errors.length} row{errors.length === 1 ? "" : "s"} skipped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-destructive">
              {errors.slice(0, 20).map((r, i) => (
                <li key={i}>
                  <code>{r.name || "(unnamed)"}</code> — {r._error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={importRows} disabled={importing || valid.length === 0}>
          <Upload className="mr-1 h-4 w-4" />
          {importing ? "Importing…" : `Import ${valid.length}`}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/drops/calendar">Cancel</Link>
        </Button>
      </div>

      {result && (
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <p>
              Inserted <strong>{result.inserted}</strong>, skipped (duplicates){" "}
              <strong>{result.skipped}</strong>.
            </p>
            {result.errors.length > 0 && (
              <p className="text-destructive">
                {result.errors.length} batch error
                {result.errors.length === 1 ? "" : "s"}: {result.errors[0]}
              </p>
            )}
            <Link href="/drops/calendar" className="text-primary hover:underline">
              Back to calendar →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
