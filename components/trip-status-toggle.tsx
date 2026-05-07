"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { setTripStatus } from "@/lib/supabase/rpc";

interface Props {
  tripId: string;
  isOpen: boolean;
  onChange?: (next: boolean) => void;
  refresh?: boolean;
}

export function TripStatusToggle({ tripId, isOpen, onChange, refresh = true }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(isOpen);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !open;
    const message = next
      ? "Reopen to edit?"
      : "Close this trip? It'll become read-only until reopened.";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const result = await setTripStatus(supabase, tripId, next);
      setOpen(result.is_open);
      onChange?.(result.is_open);
      if (refresh) router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update trip status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="cursor-pointer disabled:opacity-60"
      aria-label={open ? "Close trip" : "Reopen trip"}
    >
      <Badge variant={open ? "default" : "secondary"}>
        {busy ? "…" : open ? "Open" : "Closed"}
      </Badge>
    </button>
  );
}
