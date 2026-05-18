"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  rowActions?: (row: T) => React.ReactNode;
  onCellEdit?: (row: T, payload: Record<string, unknown>) => Promise<void>;
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
  selectable,
  selectedIds,
  onSelectionChange,
  rowActions,
  onCellEdit,
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

  const sortedRowIds = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);

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

  const selection = useMemo(() => selectedIds ?? [], [selectedIds]);
  const visibleSelectedCount = useMemo(
    () => sortedRowIds.filter((id) => selection.includes(id)).length,
    [sortedRowIds, selection],
  );
  const allVisibleSelected =
    sortedRowIds.length > 0 && visibleSelectedCount === sortedRowIds.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < sortedRowIds.length;

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  function toggleAllVisible(checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(Array.from(new Set([...selection, ...sortedRowIds])));
    } else {
      const visible = new Set(sortedRowIds);
      onSelectionChange(selection.filter((id) => !visible.has(id)));
    }
  }

  const [editing, setEditing] = useState<{
    rowKey: string;
    columnId: string;
  } | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const totalCols =
    visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

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
              {selectable && (
                <th className="w-8 px-3 py-2 align-middle">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label="Select all visible rows"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                  />
                </th>
              )}
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
              {rowActions && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {empty ?? "No rows match."}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const rid = rowKey(row);
                const isSelected = selection.includes(rid);
                return (
                  <tr
                    key={rid}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "hover:bg-accent/40",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-accent/30",
                    )}
                  >
                    {selectable && (
                      <td
                        className="w-8 px-3 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={isSelected}
                          onChange={(e) => {
                            if (!onSelectionChange) return;
                            const next = e.target.checked
                              ? Array.from(new Set([...selection, rid]))
                              : selection.filter((x) => x !== rid);
                            onSelectionChange(next);
                          }}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => {
                      const cellId = `${rid}:${col.id}`;
                      const isEditing =
                        editing?.rowKey === rid && editing.columnId === col.id;
                      const isSaving = savingCell === cellId;
                      const canEdit = !!col.editable && !!onCellEdit;

                      const tdClass = cn(
                        "px-3 py-2 align-middle",
                        col.align === "right" && "text-right tabular-nums",
                        isSaving && "opacity-50",
                      );

                      if (isEditing && col.editable) {
                        const initial =
                          col.editable.initialValue?.(row) ??
                          String(col.accessor(row) ?? "");
                        return (
                          <td
                            key={col.id}
                            className={tdClass}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineEditor
                              config={col.editable}
                              initial={initial}
                              align={col.align}
                              onCancel={() => setEditing(null)}
                              onCommit={async (raw) => {
                                const payload = col.editable!.toUpdate(row, raw);
                                if (payload === null) return false;
                                setSavingCell(cellId);
                                try {
                                  await onCellEdit!(row, payload);
                                  setEditing(null);
                                  return true;
                                } catch {
                                  return false;
                                } finally {
                                  setSavingCell(null);
                                }
                              }}
                            />
                          </td>
                        );
                      }

                      const cellContent = col.render
                        ? col.render(row)
                        : defaultCell(col.accessor(row));

                      if (canEdit) {
                        return (
                          <td key={col.id} className={tdClass}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditing({ rowKey: rid, columnId: col.id });
                              }}
                              className={cn(
                                "w-full rounded px-1 py-0.5 text-left",
                                "cursor-text border border-dashed border-transparent",
                                "hover:border-muted-foreground/30 hover:bg-accent/30",
                                col.align === "right" && "text-right",
                              )}
                            >
                              {cellContent}
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td key={col.id} className={tdClass}>
                          {cellContent}
                        </td>
                      );
                    })}
                    {rowActions && (
                      <td
                        className="w-10 px-2 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type InlineEditorProps<T> = {
  config: NonNullable<ColumnDef<T>["editable"]>;
  initial: string;
  align?: "left" | "right";
  onCancel: () => void;
  onCommit: (raw: string) => Promise<boolean>;
};

function InlineEditor<T>({
  config,
  initial,
  align,
  onCancel,
  onCommit,
}: InlineEditorProps<T>) {
  const [value, setValue] = useState(initial);
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  >(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current && "select" in inputRef.current) {
      try {
        (inputRef.current as HTMLInputElement).select();
      } catch {
        /* no-op */
      }
    }
  }, []);

  async function commit(next: string) {
    if (committing) return;
    setCommitting(true);
    try {
      await onCommit(next);
    } finally {
      setCommitting(false);
    }
  }

  const baseInput =
    "min-w-[80px] w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  if (config.type === "enum") {
    const opts = config.enumOptions ?? [];
    return (
      <select
        ref={(el) => {
          inputRef.current = el;
        }}
        className={cn(baseInput, align === "right" && "text-right")}
        value={value}
        disabled={committing}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          void commit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (!committing) onCancel();
        }}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (config.type === "textarea") {
    return (
      <textarea
        ref={(el) => {
          inputRef.current = el;
        }}
        className={cn(baseInput, "min-h-[60px] resize-y")}
        value={value}
        disabled={committing}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void commit(value);
          }
        }}
        onBlur={() => {
          if (!committing) void commit(value);
        }}
      />
    );
  }

  return (
    <input
      ref={(el) => {
        inputRef.current = el;
      }}
      type={config.type === "number" ? "number" : "text"}
      inputMode={config.type === "number" ? "decimal" : undefined}
      step={config.type === "number" ? "any" : undefined}
      className={cn(baseInput, align === "right" && "text-right")}
      value={value}
      disabled={committing}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          void commit(value);
        }
      }}
      onBlur={() => {
        if (!committing) void commit(value);
      }}
    />
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
