"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Drop-level "Watch" toggle: sets every populated link's monitor_mode
// to 'cold'. One tap from the drop card.
export function WatchDropButton({
  dropId,
  linkIds,
  suggestionId,
}: {
  dropId: string;
  linkIds: string[];
  suggestionId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (linkIds.length === 0) return null;

  async function watchAll() {
    if (pending) return;
    setPending(true);
    const supabase = createClient();
    try {
      await Promise.all(
        linkIds.map((id) =>
          supabase.rpc("monitor_set_link_mode" as never, {
            p_link_id: id,
            p_mode: "cold",
          } as never),
        ),
      );
      if (suggestionId) {
        await supabase
          .from("drop_suggestions" as never)
          .update({ dismissed: true } as never)
          .eq("id", suggestionId);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  // suppress unused-var warning until we use dropId for future features
  void dropId;

  return (
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
  );
}
