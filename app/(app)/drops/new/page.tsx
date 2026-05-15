"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Enums } from "@/types/database";

export const runtime = "edge";

type RetailerLink = {
  retailer: string;
  region: string;
  url: string;
  price_usd: string;
  price_eur: string;
  notes: string;
};

type RetailerPreset = { name: string; retailers: string[] };

const GAMES: Enums<"game_kind">[] = ["pokemon", "one_piece", "magic", "lorcana", "yugioh", "other"];
const STATUSES = ["upcoming", "live", "released"] as const;
const REGIONS = ["US", "EU", "UK", "CA", "JP"] as const;

export default function NewDropPage() {
  const router = useRouter();
  const [game, setGame] = useState<Enums<"game_kind">>("pokemon");
  const [name, setName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [setLabel, setSetLabel] = useState("");
  const [productType, setProductType] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [msrpUsd, setMsrpUsd] = useState("");
  const [msrpEur, setMsrpEur] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("upcoming");
  const [links, setLinks] = useState<RetailerLink[]>([
    { retailer: "pokemoncenter", region: "US", url: "", price_usd: "", price_eur: "", notes: "" },
  ]);
  const [presets, setPresets] = useState<RetailerPreset[]>([]);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Load retailer presets once
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("settings")
      .select("value")
      .eq("key", "retailer_presets")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: unknown } | null)?.value;
        if (Array.isArray(v)) setPresets(v as RetailerPreset[]);
      });
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data: drop, error: dropErr } = await supabase
        .from("product_drops" as never)
        .insert({
          game,
          name,
          set_code: setCode || null,
          set_name: setLabel || null,
          product_type: productType || null,
          image_url: imageUrl || null,
          release_date: releaseDate || null,
          msrp_usd: msrpUsd ? Number(msrpUsd) : null,
          msrp_eur: msrpEur ? Number(msrpEur) : null,
          notes: notes || null,
          status,
        } as never)
        .select("id")
        .single();
      if (dropErr) throw dropErr;
      const dropId = (drop as unknown as { id: string }).id;

      const validLinks = links.filter((l) => l.url.trim() && l.retailer.trim());
      if (validLinks.length > 0) {
        const { error: linkErr } = await supabase.from("drop_retailer_links" as never).insert(
          validLinks.map((l, i) => ({
            drop_id: dropId,
            retailer: l.retailer.trim().toLowerCase(),
            region: l.region,
            url: l.url.trim(),
            price_usd: l.price_usd ? Number(l.price_usd) : null,
            price_eur: l.price_eur ? Number(l.price_eur) : null,
            notes: l.notes || null,
            sort_order: i,
          })) as never,
        );
        if (linkErr) throw linkErr;
      }
      return dropId;
    },
    onSuccess: () => router.push("/drops"),
  });

  function updateLink(idx: number, patch: Partial<RetailerLink>) {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLink(retailer = "") {
    setLinks((prev) => [
      ...prev,
      { retailer, region: "US", url: "", price_usd: "", price_eur: "", notes: "" },
    ]);
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  function applyPreset(preset: RetailerPreset) {
    setLinks((prev) => {
      const existing = new Set(prev.map((l) => l.retailer.toLowerCase()));
      const additions: RetailerLink[] = preset.retailers
        .filter((r) => !existing.has(r))
        .map((r) => ({
          retailer: r,
          region: "US",
          url: "",
          price_usd: "",
          price_eur: "",
          notes: "",
        }));
      // If only the empty initial row exists, replace it instead of appending.
      const stripEmptyInitial =
        prev.length === 1 && prev[0].url === "" && prev[0].retailer === "pokemoncenter";
      return stripEmptyInitial ? additions : [...prev, ...additions];
    });
  }

  async function autoFillFromUrl(targetIdx: number | null) {
    const url = pasteUrl.trim();
    if (!url) return;
    setPasteBusy(true);
    setPasteError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.functions.invoke(
      "extract-product-meta",
      { body: { url } },
    );
    setPasteBusy(false);
    if (err) {
      const fnMsg = (err as { context?: { error?: string } })?.context?.error;
      setPasteError(fnMsg ?? err.message);
      return;
    }
    const meta = data as {
      title?: string;
      image_url?: string;
      price?: number;
      currency?: string;
      retailer?: string;
    } | null;
    if (!meta) {
      setPasteError("No metadata extracted");
      return;
    }
    if (meta.title && !name) setName(meta.title);
    if (meta.image_url && !imageUrl) setImageUrl(meta.image_url);
    if (meta.price && meta.currency === "USD" && !msrpUsd) setMsrpUsd(String(meta.price));
    if (meta.price && meta.currency === "EUR" && !msrpEur) setMsrpEur(String(meta.price));

    if (targetIdx === null) {
      addLink(meta.retailer ?? "");
    }
    setLinks((prev) => {
      const idx = targetIdx ?? prev.length - 1;
      return prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              url,
              retailer: l.retailer || meta.retailer || "",
              price_usd:
                meta.price && meta.currency === "USD" ? String(meta.price) : l.price_usd,
              price_eur:
                meta.price && meta.currency === "EUR" ? String(meta.price) : l.price_eur,
            }
          : l,
      );
    });
    setPasteUrl("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/drops">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add drop</h1>
        <p className="text-sm text-muted-foreground">Track an upcoming or current product release.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paste a product URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Paste a Pokémon Center / Target / Best Buy URL and the form will auto-fill the title,
            image, price, and retailer.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              placeholder="https://www.pokemoncenter.com/product/…"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => autoFillFromUrl(null)}
              disabled={pasteBusy || !pasteUrl.trim()}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {pasteBusy ? "Fetching…" : "Auto-fill"}
            </Button>
          </div>
          {pasteError && (
            <p className="text-xs text-destructive" role="alert">
              {pasteError}
            </p>
          )}
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Game</Label>
              <Select value={game} onValueChange={(v) => setGame(v as Enums<"game_kind">)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAMES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === "one_piece" ? "One Piece" : g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Surging Sparks Booster Bundle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Set code</Label>
              <Input value={setCode} onChange={(e) => setSetCode(e.target.value)} placeholder="SV08" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Set name</Label>
              <Input value={setLabel} onChange={(e) => setSetLabel(e.target.value)} placeholder="Surging Sparks" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Product type</Label>
              <Input
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="ETB / Booster Box / Bundle"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Release date</Label>
              <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">MSRP USD</Label>
              <Input inputMode="decimal" value={msrpUsd} onChange={(e) => setMsrpUsd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">MSRP EUR</Label>
              <Input inputMode="decimal" value={msrpEur} onChange={(e) => setMsrpEur(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allocations, exclusivity, etc." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Retailer links</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => addLink()}>
              <Plus className="mr-1 h-3 w-3" />
              Add link
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {presets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Preset:
                </span>
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {links.map((link, idx) => (
              <div key={idx} className="space-y-2 rounded-md border bg-muted/30 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_2fr_auto]">
                  <Input
                    placeholder="retailer slug (pokemoncenter)"
                    value={link.retailer}
                    onChange={(e) => updateLink(idx, { retailer: e.target.value })}
                  />
                  <Select
                    value={link.region}
                    onValueChange={(v) => updateLink(idx, { region: v })}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="https://…"
                    value={link.url}
                    onChange={(e) => updateLink(idx, { url: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLink(idx)}
                    disabled={links.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Price USD"
                    inputMode="decimal"
                    value={link.price_usd}
                    onChange={(e) => updateLink(idx, { price_usd: e.target.value })}
                    className="h-8 w-24 text-xs"
                  />
                  <Input
                    placeholder="Price EUR"
                    inputMode="decimal"
                    value={link.price_eur}
                    onChange={(e) => updateLink(idx, { price_eur: e.target.value })}
                    className="h-8 w-24 text-xs"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {mutation.error && (
          <p className="text-sm text-destructive" role="alert">
            {(mutation.error as Error).message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save drop"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/drops">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
