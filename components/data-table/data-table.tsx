"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterChip, FilterPopover } from "./filter-popover";
import type {
  ColumnDef,
  FilterMap,
  FilterValue,
  SortState,
  TableState,
} from "./types";

type Props<T> = {
  columns: ColumnDef<T>[];
  rows: T[];
  visibleColumnIds: string[];
  state: TableState;
  onStateChange: (next: TableState) => void;
  onColumnsClick: () => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  visibleColumnIds,
  state,
  onStateChange,
  onColumnsClick,
  rowKey,
  onRowClick,
  empty,
  loading,
}: Props<T>) {
  const visibleColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return visibleColumnIds
      .map((id) => byId.get(id))
      .filter((c): c is ColumnDef<T> => !!c);
  }, [columns, visibleColumnIds]);

  const filtered = useMemo(() => {
    const fl = state.filters;
    return rows.filter((row) => {
      for (const col of columns) {
        const f = fl[col.id];
        if (!f) continue;
        if (!matches(col, row, f)) return false;
      }
      return true;
    });
  }, [rows, state.filters, columns]);

  const sorted = useMemo(() => {
    const s = state.sort;
    if (!s) return filtered;
    const col = columns.find((c) => c.id === s.columnId);
    if (!col) return filtered;
    const dir = s.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      const cmp = compareValues(av, bv);
      return cmp * dir;
    });
  }, [filtered, state.sort, columns]);

  function setFilter(columnId: string, value: FilterValue | undefined) {
    const next: FilterMap = { ...state.filters };
    if (value == null) delete next[columnId];
    else next[columnId] = value;
    onStateChange({ ...state, filters: next });
  }

  function toggleSort(col: ColumnDef<T>) {
    const cur = state.sort;
    if (!cur || cur.columnId !== col.id) {
      onStateChange({ ...state, sort: { columnId: col.id, dir: "asc" } });
      return;
    }
    if (cur.dir === "asc") {
      onStateChange({ ...state, sort: { columnId: col.id, dir: "desc" } });
      return;
    }
    onStateChange({ ...state, sort: null });
  }

  const activeFilters = Object.entries(state.filters);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "row" : "rows"}
          {activeFilters.length > 0 && rows.length !== sorted.length && (
            <> of {rows.length}</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {activeFilters.map(([cid, fv]) => {
            const col = columns.find((c) => c.id === cid);
            if (!col) return null;
            return (
              <FilterChip
                key={cid}
                label={col.label}
                value={fv}
                onClear={() => setFilter(cid, undefined)}
              />
            );
          })}
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onStateChange({ ...state, filters: {} })
              }
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {state.sort && (
            <button
              type="button"
              onClick={() => onStateChange({ ...state, sort: null })}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear sort
            </button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onColumnsClick}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Columns
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {visibleColumns.map((col) => {
                const sort = state.sort?.columnId === col.id ? state.sort : null;
                return (
                  <th
                    key={col.id}
                    className={cn(
                      "px-3 py-2 align-middle",
                      col.align === "right" && "text-right",
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    <div
                      className={cn(
                        "inline-flex items-center",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="font-semibold hover:underline"
                      >
                        {col.label}
                        {sort ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="ml-1 inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="ml-1 inline h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />
                        )}
                      </button>
                      <FilterPopover
                        column={col}
                        value={state.filters[col.id]}
                        onChange={(v) => setFilter(col.id, v)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {empty ?? "No rows match."}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "hover:bg-accent/40",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 py-2 align-middle",
                        col.align === "right" && "text-right tabular-nums",
                      )}
                    >
                      {col.render ? col.render(row) : defaultCell(col.accessor(row))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function defaultCell(v: unknown): React.ReactNode {
  if (v == null || v === "") return "—";
  if (v instanceof Date) return v.toLocaleDateString();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function matches<T>(col: ColumnDef<T>, row: T, f: FilterValue): boolean {
  const raw = col.accessor(row);
  switch (f.kind) {
    case "text": {
      const s = raw == null ? "" : String(raw).toLowerCase();
      const q = f.value.toLowerCase();
      if (q === "") return true;
      if (f.op === "contains") return s.includes(q);
      if (f.op === "starts") return s.startsWith(q);
      return s === q;
    }
    case "number": {
      const n = raw == null ? null : Number(raw);
      if (n == null || Number.isNaN(n)) return false;
      if (f.op === "gte") return n >= f.value;
      if (f.op === "lte") return n <= f.value;
      if (f.op === "eq") return n === f.value;
      if (f.op === "between") {
        const lo = f.value;
        const hi = f.value2 ?? f.value;
        return n >= lo && n <= hi;
      }
      return true;
    }
    case "date": {
      if (raw == null || raw === "") return false;
      const s = String(raw).slice(0, 10);
      if (f.op === "before") return !!f.value && s < f.value;
      if (f.op === "after") return !!f.value && s > f.value;
      if (f.op === "eq") return !!f.value && s === f.value;
      if (f.op === "between") {
        if (!f.value || !f.value2) return false;
        return s >= f.value && s <= f.value2;
      }
      return true;
    }
    case "enum": {
      if (f.values.length === 0) return true;
      const v = raw == null ? "" : String(raw);
      return f.values.includes(v);
    }
    case "boolean": {
      if (f.value === "any") return true;
      return Boolean(raw) === f.value;
    }
  }
}
