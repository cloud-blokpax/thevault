"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function PromoteCalendarRow({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    if (pending) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("promote_calendar_entry" as never, {
      p_entry_id: entryId,
    } as never);
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={promote}
        disabled={pending}
        className="h-7 px-2 text-xs"
      >
        {pending ? "…" : "Promote"}
        <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
      {error && (
        <span className="text-[11px] text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
