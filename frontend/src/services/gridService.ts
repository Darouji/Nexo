import type { ColumnState } from "ag-grid-community";
import { api } from "./api";

export type GridColumnDefinition = {
  field_key: string;
  system_label: string;
  visible_name: string;
  data_type: "text" | "number" | "choice" | "date" | string;
  sortable: boolean;
  filter_operators: string[];
  hideable: boolean;
  pinnable: boolean;
  required: boolean;
  exportable: boolean;
};

export type GridDefinition = {
  grid_key: string;
  definition_version: number;
  default_page_size: number;
  allowed_page_sizes: number[];
  columns: GridColumnDefinition[];
  permissions: {
    can_rename_global: boolean;
    can_export_official: boolean;
  };
};

export type StoredGridColumn = {
  field_key: string;
  width?: number;
  hidden: boolean;
  pinned: "left" | "right" | null;
};

export type GridPreference = {
  grid_key: string;
  definition_version: number;
  revision: number;
  config: {
    columns: StoredGridColumn[];
    page_size: number;
  };
};

export async function fetchGridDefinition(gridKey: string) {
  const response = await api.get<GridDefinition>(
    `/grid/definitions/${encodeURIComponent(gridKey)}/`,
  );
  return response.data;
}

export async function fetchGridPreference(gridKey: string) {
  const response = await api.get<GridPreference>(
    `/grid/preferences/${encodeURIComponent(gridKey)}/`,
  );
  return response.data;
}

export async function saveGridPreference(
  preference: GridPreference,
  columnState: ColumnState[],
  pageSize: number,
) {
  const columns = columnState
    .filter((column) => column.colId !== "__row_number__")
    .map<StoredGridColumn>((column) => ({
      field_key: column.colId,
      ...(typeof column.width === "number" ? { width: column.width } : {}),
      hidden: Boolean(column.hide),
      pinned:
        column.pinned === "left" || column.pinned === "right"
          ? column.pinned
          : null,
    }));

  const response = await api.put<GridPreference>(
    `/grid/preferences/${encodeURIComponent(preference.grid_key)}/`,
    {
      revision: preference.revision,
      definition_version: preference.definition_version,
      config: {
        columns,
        page_size: pageSize,
      },
    },
  );

  return response.data;
}

export async function resetGridPreference(gridKey: string) {
  await api.delete(`/grid/preferences/${encodeURIComponent(gridKey)}/`);
}

export async function renameGlobalGridColumn(
  gridKey: string,
  fieldKey: string,
  visibleName: string,
  reason: string,
) {
  const response = await api.put<{
    grid_key: string;
    field_key: string;
    system_label: string;
    visible_name: string;
    scope: "organization";
  }>(
    `/grid/labels/${encodeURIComponent(gridKey)}/${encodeURIComponent(fieldKey)}/`,
    {
      visible_name: visibleName,
      reason,
    },
  );

  return response.data;
}
