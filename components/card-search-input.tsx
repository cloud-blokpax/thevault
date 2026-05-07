"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { CardImage } from "@/components/ui/card-image";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

export type CardHit = {
  id: string;
  game: Enums<"game_kind">;
  name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  rarity: string | null;
  language: string | null;
  is_foil: boolean | null;
  is_sealed: boolean | null;
  image_url: string | null;
  release_year: number | null;
  release_date: string | null;
};

type Props = {
  game?: Enums<"game_kind">;
  limit?: number;
  placeholder?: string;
  onSelect: (card: CardHit) => void;
};

const THUMB_W = 40;
const THUMB_H = 56;

const GAME_LABELS: Record<string, string> = {
  pokemon: "Pokémon",
  one_piece: "One Piece",
  magic: "Magic",
  lorcana: "Lorcana",
  yugioh: "Yu-Gi-Oh!",
  other: "Other",
};

export function gameLabel(game: string | null | undefined) {
  if (!game) return "";
  return GAME_LABELS[game] ?? game.replace(/_/g, " ");
}

function rarityColor(rarity: string | null | undefined) {
  if (!rarity) return "";
  const r = rarity.toLowerCase();
  if (r === "common") return "text-muted-foreground";
  if (r === "uncommon") return "text-blue-600 dark:text-blue-400";
  if (
    r.includes("rare") ||
    r.includes("ultra") ||
    r.includes("special") ||
    r.includes("illustration") ||
    r.includes("secret") ||
    r.includes("holo") ||
    r === "l" ||
    r === "sr" ||
    r === "sec"
  ) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

const YEAR_RE = /\b(19|20)\d{2}\b/;

export function CardSearchInput({ game, limit = 20, placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { searchTerm, yearFilter } = useMemo(() => {
    const m = debounced.match(YEAR_RE);
    if (!m) return { searchTerm: debounced, yearFilter: null as number | null };
    const stripped = debounced.replace(YEAR_RE, "").replace(/\s+/g, " ").trim();
    return { searchTerm: stripped || debounced, yearFilter: parseInt(m[0], 10) };
  }, [debounced]);

  const enabled = searchTerm.length >= 2;
  const { data, isFetching } = useQuery<CardHit[]>({
    queryKey: ["search_cards", searchTerm, game ?? "all", limit],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_cards" as never, {
        p_query: searchTerm,
        p_game: game ?? null,
        p_limit: limit,
      } as never);
      if (error) throw error;
      return ((data as unknown) as CardHit[]) ?? [];
    },
  });

  const results = useMemo(() => {
    const all = data ?? [];
    if (yearFilter == null) return all;
    return all.filter((r) => r.release_year === yearFilter || r.release_year == null);
  }, [data, yearFilter]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function pick(c: CardHit) {
    onSelect(c);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Search cards…"}
        className="pl-9"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="card-search-listbox"
      />
      {open && enabled && (
        <div
          id="card-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y">
              {results.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(c)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2 text-left",
                      i === activeIndex ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <CardImage
                      src={c.image_url}
                      alt=""
                      width={THUMB_W}
                      height={THUMB_H}
                      fallbackText=""
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {c.name}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          {c.is_foil && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              <Sparkles className="h-2.5 w-2.5" />
                              Foil
                            </span>
                          )}
                          {c.is_sealed && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              <Package className="h-2.5 w-2.5" />
                              Sealed
                            </span>
                          )}
                          {c.set_code && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                              {c.set_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="truncate text-xs text-foreground/80">
                        {formatSetLine(c)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <MetaLine card={c} />
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function formatSetLine(c: Pick<CardHit, "set_name" | "set_code" | "release_year">) {
  if (c.set_name && c.release_year) return `${c.set_name} (${c.release_year})`;
  if (c.set_name) return c.set_name;
  if (c.set_code) return c.set_code;
  return "";
}

function MetaLine({
  card: c,
}: {
  card: Pick<CardHit, "game" | "card_number" | "rarity" | "language" | "is_sealed">;
}) {
  const segments: React.ReactNode[] = [];
  segments.push(<span key="game">{gameLabel(c.game)}</span>);
  if (c.is_sealed && !c.card_number && !c.rarity) {
    segments.push(<span key="sealed">Sealed</span>);
  } else {
    if (c.card_number) segments.push(<span key="num">{`#${c.card_number}`}</span>);
    if (c.rarity)
      segments.push(
        <span key="rarity" className={rarityColor(c.rarity)}>
          {c.rarity}
        </span>,
      );
  }
  if (c.language && c.language.toLowerCase() !== "en") {
    segments.push(<span key="lang">{c.language.toUpperCase()}</span>);
  }
  return (
    <>
      {segments.map((s, i) => (
        <span key={i}>
          {i > 0 ? " · " : ""}
          {s}
        </span>
      ))}
    </>
  );
}

export { rarityColor };
