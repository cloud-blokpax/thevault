"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  count: number;
  onClear: () => void;
  actions: React.ReactNode;
};

export function BulkActionsBar({ count, onClear, actions }: Props) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-2 flex items-center gap-2 border bg-card px-4 py-2 shadow-sm md:mx-0 md:rounded-md">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="ml-auto flex items-center gap-2">
        {actions}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
