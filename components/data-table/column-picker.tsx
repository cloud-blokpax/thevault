"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "./types";

type Props<T> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: ColumnDef<T>[];
  visibleColumnIds: string[];
  defaultVisibleIds: string[];
  onChange: (next: string[]) => void;
};

export function ColumnPicker<T>({
  open,
  onOpenChange,
  columns,
  visibleColumnIds,
  defaultVisibleIds,
  onChange,
}: Props<T>) {
  const visibleSet = new Set(visibleColumnIds);

  function toggle(id: string, on: boolean) {
    const next = on
      ? [...visibleColumnIds, id]
      : visibleColumnIds.filter((x) => x !== id);
    // Preserve column declaration order in the visible list.
    const ordered = columns
      .map((c) => c.id)
      .filter((cid) => next.includes(cid));
    onChange(ordered);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-80 max-w-full border-l bg-background shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Dialog.Title className="text-base font-semibold">
              Visible columns
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Toggle which columns appear in the table.
            </Dialog.Description>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto p-3">
            {columns.map((col) => {
              const checked = visibleSet.has(col.id);
              const disabled = col.hideable === false;
              return (
                <label
                  key={col.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggle(col.id, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className={disabled ? "text-muted-foreground" : ""}>
                    {col.label}
                    {disabled && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        required
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="border-t p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(defaultVisibleIds)}
              className="w-full"
            >
              Reset to default
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
