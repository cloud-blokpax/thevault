"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function WatchDropButton({
  linkIds,
  suggestionId,
}: {
  linkIds: string[];
  suggestionId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (linkIds.length === 0) return null;

  async function watchAll() {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    try {
      const results = await Promise.all(
        linkIds.map((id) =>
          supabase.rpc("monitor_set_link_mode", { p_link_id: id, p_mode: "cold" }),
        ),
      );
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) {
        setError(firstErr.message);
        return;
      }
      const firstRpcErr = results
        .map((r) => r.data as { ok?: boolean; error?: string } | null)
        .find((d) => d && d.ok === false);
      if (firstRpcErr?.error) {
        setError(firstRpcErr.error);
        return;
      }
      if (suggestionId) {
        await supabase
          .from("drop_suggestions")
          .update({ dismissed: true })
          .eq("id", suggestionId);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={watchAll}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium hover:bg-accent",
          pending && "opacity-60",
        )}
        title="Set every populated link on this drop to Cold (4h checks)"
      >
        <Eye className="h-3 w-3" />
        {pending ? "Watching…" : "Watch"}
      </button>
      {error && (
        <span className="ml-2 text-[11px] text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
