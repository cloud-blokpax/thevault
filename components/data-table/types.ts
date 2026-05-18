export type ColumnType = "text" | "number" | "date" | "enum" | "boolean";

export type SortDir = "asc" | "desc";

export type SortState = { columnId: string; dir: SortDir } | null;

export type FilterValue =
  | { kind: "text"; op: "contains" | "starts" | "equals"; value: string }
  | { kind: "number"; op: "gte" | "lte" | "eq" | "between"; value: number; value2?: number }
  | { kind: "date"; op: "before" | "after" | "between" | "eq"; value: string; value2?: string }
  | { kind: "enum"; values: string[] }
  | { kind: "boolean"; value: boolean | "any" };

export type FilterMap = Record<string, FilterValue>;

export type EditableConfig<T> = {
  type: "text" | "number" | "enum" | "textarea";
  enumOptions?: { value: string; label: string }[];
  /**
   * Returns the partial update payload to send to the parent. Return `null`
   * to signal an invalid edit (cell stays in edit mode for retry).
   */
  toUpdate: (row: T, raw: string) => Record<string, unknown> | null;
  initialValue?: (row: T) => string;
};

export type ColumnDef<T> = {
  id: string;
  label: string;
  type: ColumnType;
  accessor: (row: T) => unknown;
  render?: (row: T) => React.ReactNode;
  enumOptions?: { value: string; label: string }[];
  align?: "left" | "right";
  defaultVisible?: boolean;
  width?: string;
  /** Allow this column to be hidden via the column picker. Defaults to true. */
  hideable?: boolean;
  editable?: EditableConfig<T>;
};

export type TableState = {
  sort: SortState;
  filters: FilterMap;
  selectedIds?: string[];
};
