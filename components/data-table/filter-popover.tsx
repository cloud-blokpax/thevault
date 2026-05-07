"use client";

import { useEffect, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColumnDef, FilterValue } from "./types";

type Props<T> = {
  column: ColumnDef<T>;
  value: FilterValue | undefined;
  onChange: (next: FilterValue | undefined) => void;
};

export function FilterPopover<T>({ column, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!value;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Filter ${column.label}`}
        className={cn(
          "ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
          active && "text-primary",
        )}
      >
        <Filter className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-30 w-64 rounded-md border bg-popover p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {column.label}
          </p>
          <FilterEditor column={column} value={value} onChange={onChange} />
          <div className="mt-3 flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterEditor<T>({
  column,
  value,
  onChange,
}: {
  column: ColumnDef<T>;
  value: FilterValue | undefined;
  onChange: (next: FilterValue | undefined) => void;
}) {
  if (column.type === "text") {
    const v =
      value && value.kind === "text"
        ? value
        : ({ kind: "text", op: "contains", value: "" } as const);
    return (
      <div className="space-y-2">
        <select
          value={v.op}
          onChange={(e) =>
            onChange({ ...v, op: e.target.value as typeof v.op })
          }
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="contains">contains</option>
          <option value="starts">starts with</option>
          <option value="equals">equals</option>
        </select>
        <Input
          value={v.value}
          onChange={(e) =>
            onChange({ ...v, value: e.target.value })
          }
          placeholder={`Filter ${column.label.toLowerCase()}…`}
          autoFocus
        />
      </div>
    );
  }
  if (column.type === "number") {
    const v =
      value && value.kind === "number"
        ? value
        : ({ kind: "number", op: "gte", value: 0 } as const);
    return (
      <div className="space-y-2">
        <select
          value={v.op}
          onChange={(e) =>
            onChange({ ...v, op: e.target.value as typeof v.op })
          }
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="gte">≥</option>
          <option value="lte">≤</option>
          <option value="eq">=</option>
          <option value="between">between</option>
        </select>
        <Input
          inputMode="decimal"
          value={Number.isNaN(v.value) ? "" : String(v.value)}
          onChange={(e) =>
            onChange({ ...v, value: Number(e.target.value) })
          }
        />
        {v.op === "between" && (
          <Input
            inputMode="decimal"
            placeholder="and"
            value={v.value2 == null ? "" : String(v.value2)}
            onChange={(e) =>
              onChange({ ...v, value2: Number(e.target.value) })
            }
          />
        )}
      </div>
    );
  }
  if (column.type === "date") {
    const v =
      value && value.kind === "date"
        ? value
        : ({ kind: "date", op: "after", value: "" } as const);
    return (
      <div className="space-y-2">
        <select
          value={v.op}
          onChange={(e) =>
            onChange({ ...v, op: e.target.value as typeof v.op })
          }
          className="w-full rounded border bg-background px-2 py-1 text-xs"
        >
          <option value="before">before</option>
          <option value="after">after</option>
          <option value="eq">on</option>
          <option value="between">between</option>
        </select>
        <Input
          type="date"
          value={v.value}
          onChange={(e) => onChange({ ...v, value: e.target.value })}
        />
        {v.op === "between" && (
          <Input
            type="date"
            value={v.value2 ?? ""}
            onChange={(e) =>
              onChange({ ...v, value2: e.target.value })
            }
          />
        )}
      </div>
    );
  }
  if (column.type === "enum") {
    const v: { kind: "enum"; values: string[] } =
      value && value.kind === "enum"
        ? value
        : { kind: "enum", values: [] };
    const options = column.enumOptions ?? [];
    return (
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {options.map((opt) => {
          const checked = v.values.includes(opt.value);
          return (
            <label key={opt.value} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...v.values, opt.value]
                    : v.values.filter((x) => x !== opt.value);
                  if (next.length === 0) {
                    onChange(undefined);
                  } else {
                    onChange({ kind: "enum", values: next });
                  }
                }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    );
  }
  // boolean
  const v =
    value && value.kind === "boolean"
      ? value
      : ({ kind: "boolean", value: "any" } as const);
  return (
    <div className="flex gap-1">
      {(["any", true, false] as const).map((opt) => {
        const label = opt === "any" ? "Any" : opt ? "Yes" : "No";
        const active = v.value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => {
              if (opt === "any") onChange(undefined);
              else onChange({ kind: "boolean", value: opt });
            }}
            className={cn(
              "flex-1 rounded border px-2 py-1 text-xs",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: FilterValue;
  onClear: () => void;
}) {
  let display = "";
  switch (value.kind) {
    case "text":
      display = `${label}: ${opSym(value.op)} "${value.value}"`;
      break;
    case "number":
      if (value.op === "between") {
        display = `${label}: ${value.value} – ${value.value2 ?? "?"}`;
      } else {
        display = `${label} ${opSym(value.op)} ${value.value}`;
      }
      break;
    case "date":
      if (value.op === "between") {
        display = `${label}: ${value.value} – ${value.value2 ?? "?"}`;
      } else {
        display = `${label} ${opSym(value.op)} ${value.value}`;
      }
      break;
    case "enum":
      display = `${label}: ${value.values.join(", ")}`;
      break;
    case "boolean":
      display = `${label}: ${value.value === true ? "Yes" : value.value === false ? "No" : "Any"}`;
      break;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
      {display}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear filter"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function opSym(op: string): string {
  switch (op) {
    case "contains":
      return "~";
    case "starts":
      return "^";
    case "equals":
    case "eq":
      return "=";
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    case "before":
      return "<";
    case "after":
      return ">";
    default:
      return op;
  }
}
