import type { ColumnState, GridApi } from "ag-grid-community";

const STORAGE_PREFIX = "serkan:grid-layout";
const STORAGE_SCHEMA_VERSION = 2;

const INTERNAL_COLUMN_IDS = new Set(["__row_number__"]);

type PersistedColumnState = Pick<
  ColumnState,
  "colId" | "width" | "flex" | "hide" | "pinned"
>;

type PersistedGridLayout = {
  schemaVersion: number;
  columnDefinitionIds: string[];
  columns: PersistedColumnState[];
};

function getStorageKey(gridKey: string) {
  return `${STORAGE_PREFIX}:${gridKey}:v${STORAGE_SCHEMA_VERSION}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPinnedValue(value: unknown): value is ColumnState["pinned"] {
  return value === "left" || value === "right" || value === null;
}

function parseColumnState(value: unknown): PersistedColumnState | null {
  if (!isRecord(value)) {
    return null;
  }

  const colId = value.colId;

  if (typeof colId !== "string" || !colId || INTERNAL_COLUMN_IDS.has(colId)) {
    return null;
  }

  const columnState: PersistedColumnState = {
    colId,
  };

  if (
    typeof value.width === "number" &&
    Number.isFinite(value.width) &&
    value.width > 0
  ) {
    columnState.width = value.width;
  }

  if (
    value.flex === null ||
    (typeof value.flex === "number" &&
      Number.isFinite(value.flex) &&
      value.flex >= 0)
  ) {
    columnState.flex = value.flex;
  }

  if (typeof value.hide === "boolean") {
    columnState.hide = value.hide;
  }

  if (isPinnedValue(value.pinned)) {
    columnState.pinned = value.pinned;
  }

  return columnState;
}

function haveSameColumnDefinitions(
  currentColumnIds: string[],
  storedColumnIds: string[],
) {
  return (
    currentColumnIds.length === storedColumnIds.length &&
    currentColumnIds.every(
      (columnId, index) => columnId === storedColumnIds[index],
    )
  );
}

function readStoredGridLayout(gridKey: string): PersistedGridLayout | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getStorageKey(gridKey);

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (
      !isRecord(parsedValue) ||
      parsedValue.schemaVersion !== STORAGE_SCHEMA_VERSION ||
      !Array.isArray(parsedValue.columnDefinitionIds) ||
      !Array.isArray(parsedValue.columns)
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    const columnDefinitionIds = parsedValue.columnDefinitionIds.filter(
      (columnId): columnId is string =>
        typeof columnId === "string" && Boolean(columnId),
    );

    if (columnDefinitionIds.length !== parsedValue.columnDefinitionIds.length) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    const columns: PersistedColumnState[] = [];

    for (const storedColumn of parsedValue.columns) {
      const parsedColumn = parseColumnState(storedColumn);

      if (!parsedColumn) {
        window.localStorage.removeItem(storageKey);
        return null;
      }

      columns.push(parsedColumn);
    }

    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      columnDefinitionIds,
      columns,
    };
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // El almacenamiento puede estar bloqueado por el navegador.
    }

    return null;
  }
}

export function restoreSerkanGridLayout<TRow>(
  api: GridApi<TRow>,
  gridKey: string,
  columnDefinitionIds: string[],
) {
  const storedLayout = readStoredGridLayout(gridKey);

  if (!storedLayout) {
    return false;
  }

  if (
    !haveSameColumnDefinitions(
      columnDefinitionIds,
      storedLayout.columnDefinitionIds,
    )
  ) {
    clearSerkanGridLayout(gridKey);
    return false;
  }

  return api.applyColumnState({
    state: storedLayout.columns,
    applyOrder: true,
  });
}

export function persistSerkanGridLayout<TRow>(
  api: GridApi<TRow>,
  gridKey: string,
  columnDefinitionIds: string[],
) {
  if (typeof window === "undefined") {
    return false;
  }

  const columns = api
    .getColumnState()
    .filter((columnState) => !INTERNAL_COLUMN_IDS.has(columnState.colId))
    .map<PersistedColumnState>(({ colId, width, flex, hide, pinned }) => ({
      colId,
      width,
      flex,
      hide,
      pinned,
    }));

  const storedLayout: PersistedGridLayout = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    columnDefinitionIds,
    columns,
  };

  try {
    window.localStorage.setItem(
      getStorageKey(gridKey),
      JSON.stringify(storedLayout),
    );

    return true;
  } catch {
    return false;
  }
}

export function clearSerkanGridLayout(gridKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(gridKey));
  } catch {
    // Las preferencias visuales no deben bloquear la plataforma.
  }
}
