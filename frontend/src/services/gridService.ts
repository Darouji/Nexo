/**
 * Contratos y operaciones de la arquitectura transversal de grillas.
 *
 * La definición del backend determina campos técnicos, etiquetas, filtros,
 * exportación y permisos. El frontend conserva preferencias visuales por
 * `grid_key` sin modificar esos identificadores estables.
 */
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

/** Estado visual estable de una columna, separado de filtros y ordenamiento. */
export type StoredGridColumn = {
  field_key: string;
  width?: number;
  hidden: boolean;
  pinned: "left" | "right" | null;
};

/** Preferencia automática asociada al usuario y a una definición de grilla. */
export type GridPreference = {
  grid_key: string;
  definition_version: number;
  revision: number;
  config: {
    columns: StoredGridColumn[];
    page_size: number;
  };
};

/**
 * Una vista nombrada sí puede conservar una consulta completa porque el usuario
 * la crea expresamente: diseño, orden, búsqueda y filtros.
 */
export type SavedGridViewConfig = GridPreference["config"] & {
  definition_version: number;
  sort: {
    field: string;
    direction: "asc" | "desc";
  } | null;
  filters: Record<string, string | NexoStoredGridFilter[]>;
};

export type NexoStoredGridFilter = {
  field: string;
  operator: string;
  value: string | number;
  value_to?: string | number;
};

export type SavedGridView = {
  id: number;
  grid_key: string;
  name: string;
  is_default: boolean;
  config: SavedGridViewConfig;
  created_at: string;
  updated_at: string;
};

/** Recupera el contrato oficial que una pantalla debe respetar. */
export async function fetchGridDefinition(gridKey: string) {
  const response = await api.get<GridDefinition>(
    `/grid/definitions/${encodeURIComponent(gridKey)}/`,
  );
  return response.data;
}

/** Recupera el diseño visual persistido para el usuario autenticado. */
export async function fetchGridPreference(gridKey: string) {
  const response = await api.get<GridPreference>(
    `/grid/preferences/${encodeURIComponent(gridKey)}/`,
  );
  return response.data;
}

/**
 * Traduce el estado de AG Grid al contrato estable del backend. La revisión
 * permite detectar actualizaciones concurrentes de la misma preferencia.
 */
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

/** Elimina la personalización para volver a la definición oficial vigente. */
export async function resetGridPreference(gridKey: string) {
  await api.delete(`/grid/preferences/${encodeURIComponent(gridKey)}/`);
}

export async function fetchSavedGridViews(gridKey: string) {
  const response = await api.get<SavedGridView[]>(
    `/grid/views/${encodeURIComponent(gridKey)}/`,
  );
  return response.data;
}

/** Crea una vista personal explícita sin alterar la definición organizacional. */
export async function createSavedGridView(
  gridKey: string,
  payload: {
    name: string;
    is_default: boolean;
    config: Omit<SavedGridViewConfig, "definition_version">;
  },
) {
  const response = await api.post<SavedGridView>(
    `/grid/views/${encodeURIComponent(gridKey)}/`,
    payload,
  );
  return response.data;
}

export async function deleteSavedGridView(gridKey: string, viewId: number) {
  await api.delete(
    `/grid/views/${encodeURIComponent(gridKey)}/${viewId}/`,
  );
}

/**
 * Cambia únicamente la etiqueta visible de una columna para toda la organización.
 * `field_key` permanece intacto para no romper API, filtros, exportaciones ni
 * preferencias existentes; el motivo respalda la trazabilidad del cambio.
 */
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
