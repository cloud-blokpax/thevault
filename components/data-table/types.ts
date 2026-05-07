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
};

export type TableState = {
  sort: SortState;
  filters: FilterMap;
};
