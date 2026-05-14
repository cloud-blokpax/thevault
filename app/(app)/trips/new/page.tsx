"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const ALLOC_METHODS = [
  { value: "weighted_by_cost", label: "Weighted by cost" },
  { value: "equal", label: "Equal" },
  { value: "manual", label: "Manual" },
] as const;

const DIRECTIONS: { value: Enums<"trip_direction">; label: string }[] = [
  { value: "US_TO_EU", label: "US → EU" },
  { value: "EU_TO_US", label: "EU → US" },
];

export default function NewTripPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [label, setLabel] = useState("");
  const [direction, setDirection] = useState<Enums<"trip_direction">>("US_TO_EU");
  const [allocationMethod, setAllocationMethod] = useState<string>("weighted_by_cost");
  const [costShipping, setCostShipping] = useState("");
  const [costFlight, setCostFlight] = useState("");
  const [costMiles, setCostMiles] = useState("");
  const [costMisc, setCostMisc] = useState("");
  const [departedOn, setDepartedOn] = useState("");
  const [arrivedOn, setArrivedOn] = useState("");
  const [fxRateLocked, setFxRateLocked] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Label is required.");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const trimmedLabel = label.trim();
      const payload = {
        user_id: user.id,
        name: trimmedLabel,
        label: trimmedLabel,
        direction,
        allocation_method: allocationMethod,
        cost_shipping: costShipping ? Number(costShipping) : 0,
        cost_flight: costFlight ? Number(costFlight) : 0,
        cost_miles_or_gas: costMiles ? Number(costMiles) : 0,
        cost_misc: costMisc ? Number(costMisc) : 0,
        departed_on: departedOn || null,
        arrived_on: arrivedOn || null,
        fx_rate_locked: fxRateLocked ? Number(fxRateLocked) : null,
        notes: notes.trim() || null,
      };
      const { data, error } = await supabase
        .from("trips")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["trips"] });
      router.push(`/trips/${id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/trips" className="text-xs text-muted-foreground hover:underline">
          ← Trips
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New trip</h1>
        <p className="text-sm text-muted-foreground">
          Costs and dates can be edited later.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Group 4 (Atlanta US→EU)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as Enums<"trip_direction">)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allocation method</Label>
              <Select value={allocationMethod} onValueChange={setAllocationMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOC_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departed on</Label>
              <Input
                type="date"
                value={departedOn}
                onChange={(e) => setDepartedOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Arrived on</Label>
              <Input
                type="date"
                value={arrivedOn}
                onChange={(e) => setArrivedOn(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costs (optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Flight</Label>
              <Input
                inputMode="decimal"
                value={costFlight}
                onChange={(e) => setCostFlight(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Shipping</Label>
              <Input
                inputMode="decimal"
                value={costShipping}
                onChange={(e) => setCostShipping(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Miles / gas</Label>
              <Input
                inputMode="decimal"
                value={costMiles}
                onChange={(e) => setCostMiles(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Misc</Label>
              <Input
                inputMode="decimal"
                value={costMisc}
                onChange={(e) => setCostMisc(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>FX rate locked</Label>
              <Input
                inputMode="decimal"
                value={fxRateLocked}
                onChange={(e) => setFxRateLocked(e.target.value)}
                placeholder="optional"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </CardContent>
        </Card>

        {create.error && (
          <p className="text-sm text-destructive" role="alert">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create trip"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/trips">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
