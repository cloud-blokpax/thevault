"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/utils";
import type { Enums } from "@/types/database";

export type CardHit = {
  id: string;
  game: Enums<"game_kind">;
  name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  rarity: string | null;
  image_url: string | null;
};

type Props = {
  game?: Enums<"game_kind">;
  limit?: number;
  placeholder?: string;
  onSelect: (card: CardHit) => void;
};

const THUMB_W = 40;
const THUMB_H = 56;

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

  const enabled = debounced.length >= 2;
  const { data, isFetching } = useQuery<CardHit[]>({
    queryKey: ["search_cards", debounced, game ?? "all", limit],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_cards" as never, {
        p_query: debounced,
        p_game: game ?? null,
        p_limit: limit,
      } as never);
      if (error) throw error;
      return ((data as unknown) as CardHit[]) ?? [];
    },
  });

  const results = data ?? [];

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
                    className={
                      "flex w-full items-center gap-3 px-3 py-2 text-left " +
                      (i === activeIndex ? "bg-accent" : "hover:bg-accent/60")
                    }
                  >
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt=""
                        width={THUMB_W}
                        height={THUMB_H}
                        loading="lazy"
                        unoptimized
                        className="shrink-0 rounded border bg-muted object-contain"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="shrink-0 rounded border bg-muted"
                        style={{ width: THUMB_W, height: THUMB_H }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.set_name ?? titleCase(c.game)}
                        {c.card_number ? ` · #${c.card_number}` : ""}
                        {c.rarity ? ` · ${c.rarity}` : ""}
                      </p>
                    </div>
                    {c.set_code && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {c.set_code}
                      </span>
                    )}
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
