import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("role, display_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("settings").select("*").order("key"),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Margins, splits, and operational defaults.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="font-medium">{profile?.email ?? user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
              <dd className="font-medium">{profile?.role ?? "—"}</dd>
            </div>
          </dl>
          <form action="/api/auth/signout" method="post" className="mt-4">
            <button className="text-sm font-medium text-primary hover:underline">Sign out</button>
          </form>
        </CardContent>
      </Card>

      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only admins can edit margins and splits. Contact an admin if you need a change.{" "}
            <Link href="/dashboard" className="text-primary hover:underline">
              Back to dashboard
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <SettingsForm initialSettings={settings ?? []} />
      )}

      <CardMetadataReference />
    </div>
  );
}

function CardMetadataReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Card metadata available</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Section title="Top-level fields (every card)">
          <FieldList
            fields={[
              "name",
              "game",
              "set_code",
              "set_name",
              "card_number",
              "rarity",
              "language",
              "is_foil",
              "is_sealed",
              "release_date",
              "image_url",
            ]}
          />
        </Section>
        <Section title="Pokémon-only (when sourced from Pokémon TCG GitHub)">
          <FieldList
            fields={[
              "hp",
              "types",
              "attacks (cost/damage/text)",
              "weaknesses",
              "resistances",
              "retreat_cost",
              "supertype",
              "subtypes",
              "pokedex_number",
              "regulation_mark",
              "legalities (Standard/Expanded/Unlimited)",
            ]}
          />
        </Section>
        <Section title="One Piece-only (when sourced from OPTCG API)">
          <FieldList
            fields={[
              "power",
              "cost",
              "color",
              "type",
              "subtypes (Leader/Character/Event/Stage)",
              "rarity (OPTCG-specific scale)",
              "card_text",
              "set_id (e.g. OP01-001)",
            ]}
          />
        </Section>
        <Section title="Pricing (all cards with US or EU presence)">
          <ul className="ml-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">US:</span> lowest,
              market, mid, high — from TCGplayer (refreshed nightly)
            </li>
            <li>
              <span className="font-medium text-foreground">EU:</span> lowest
              listing, trend, mid, high — from Cardmarket (nightly)
            </li>
          </ul>
        </Section>
        <Section title="Coverage">
          <ul className="ml-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>60,801 total cards</li>
            <li>22,942 with full GH metadata (~38% — mostly mainline Pokémon sets)</li>
            <li>22,568 from TCGplayer-only (~37% — older/promo sets, no GH match)</li>
            <li>2,438 One Piece cards with full OPTCG metadata</li>
          </ul>
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function FieldList({ fields }: { fields: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <span
          key={f}
          className="inline-flex rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80"
        >
          {f}
        </span>
      ))}
    </div>
  );
}
