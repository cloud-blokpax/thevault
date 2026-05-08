"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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

  function addLink() {
    setLinks((prev) => [
      ...prev,
      { retailer: "", region: "US", url: "", price_usd: "", price_eur: "", notes: "" },
    ]);
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
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
            <Button type="button" variant="ghost" size="sm" onClick={addLink}>
              <Plus className="mr-1 h-3 w-3" />
              Add link
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {links.map((link, idx) => (
              <div key={idx} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_auto_2fr_auto]">
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
