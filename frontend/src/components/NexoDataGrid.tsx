import RestartAltIcon from "@mui/icons-material/RestartAlt";
import EditIcon from "@mui/icons-material/Edit";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteIcon from "@mui/icons-material/Delete";
import { AgGridReact } from "ag-grid-react";
import { colors } from "../theme/colors";
import { nexoGridLocaleEs } from "./nexoGridLocaleEs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getApiErrorMessage } from "../services/api";
import {
  fetchGridDefinition,
  fetchGridPreference,
  fetchSavedGridViews,
  createSavedGridView,
  deleteSavedGridView,
  renameGlobalGridColumn,
  resetGridPreference,
  saveGridPreference,
  type GridDefinition,
  type GridPreference,
  type SavedGridView,
  type SavedGridViewConfig,
} from "../services/gridService";

import {
  clearNexoGridLayout,
  persistNexoGridLayout,
  restoreNexoGridLayout,
} from "./nexoGridLayoutStorage";

import {
  Box,
  Button,
  Alert,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  TablePagination,
  TextField,
  Typography,
  Stack,
} from "@mui/material";

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type SortChangedEvent,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const NEXO_GRID_FONT_SIZE = 12;
const NEXO_GRID_ROW_HEIGHT = 46;
const NEXO_GRID_HEADER_HEIGHT = 43;

export type NexoGridPaginationModel = {
  page: number;
  pageSize: number;
};

export type NexoGridSortModel = {
  field: string;
  direction: "asc" | "desc";
} | null;

export type NexoGridFilter = {
  field: string;
  operator: string;
  value: string | number;
  value_to?: string | number;
};

type IdentifiableRow = {
  id: number | string;
};

type ColumnLayoutEvent<TRow extends IdentifiableRow> = {
  api: GridApi<TRow>;
  finished?: boolean;
};

type NexoDataGridProps<TRow extends IdentifiableRow> = {
  gridKey: string;
  serverManaged?: boolean;
  clientManaged?: boolean;
  ariaLabel: string;
  rows: TRow[];
  columns: ColDef<TRow>[];
  loading?: boolean;
  height?: number | string;
  minHeight?: number | string;

  paginationModel: NexoGridPaginationModel;
  onPaginationModelChange: (model: NexoGridPaginationModel) => void;
  rowCount: number;

  sortModel?: NexoGridSortModel;
  onSortModelChange?: (model: NexoGridSortModel) => void;
  onFilterModelChange?: (filters: NexoGridFilter[]) => void;
  filterResetKey?: number;
  onVisibleColumnsChange?: (fieldKeys: string[]) => void;
  namedViewFilters?: Record<string, string>;
  onNamedViewApply?: (config: SavedGridViewConfig) => void;
  footerSummary?: ReactNode;
};

const nexoGridTheme = themeQuartz.withParams({
  accentColor: colors.primary.main,
  backgroundColor: colors.background.paper,
  foregroundColor: colors.text.primary,
  borderColor: colors.border.light,
  headerBackgroundColor: colors.background.header,
  headerTextColor: colors.text.secondary,
  rowHoverColor: colors.action.hover,
  fontSize: NEXO_GRID_FONT_SIZE,
  spacing: 8,
});

function NoRowsOverlay() {
  return (
    <Box
      sx={{
        minHeight: 180,
        display: "grid",
        placeItems: "center",
        px: 3,
        textAlign: "center",
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: colors.text.secondary,
          fontWeight: 700,
        }}
      >
        No hay registros que coincidan con la búsqueda o los filtros.
      </Typography>
    </Box>
  );
}

function areSortModelsEqual(
  current: NexoGridSortModel | undefined,
  next: NexoGridSortModel,
) {
  return (
    current?.field === next?.field && current?.direction === next?.direction
  );
}

function toNexoGridFilters(
  filterModel: Record<
    string,
    {
      type?: string;
      filter?: string | number;
      filterTo?: string | number;
    }
  >,
): NexoGridFilter[] {
  return Object.entries(filterModel)
    .filter(([, model]) => model.type && model.filter !== undefined)
    .map(([field, model]) => ({
      field,
      operator: String(model.type),
      value: model.filter as string | number,
      ...(model.filterTo !== undefined ? { value_to: model.filterTo } : {}),
    }));
}

function toAgGridFilterModel(filters: NexoGridFilter[]) {
  return Object.fromEntries(
    filters.map((filter) => [
      filter.field,
      {
        type: filter.operator,
        filter: filter.value,
        ...(filter.value_to !== undefined
          ? { filterTo: filter.value_to }
          : {}),
      },
    ]),
  );
}

function toInitialLayoutColumn<TRow>(column: ColDef<TRow>): ColDef<TRow> {
  const { width, flex, hide, pinned, ...columnDefinition } = column;

  return {
    ...columnDefinition,
    initialWidth: column.initialWidth ?? width,
    initialFlex: column.initialFlex ?? flex ?? undefined,
    initialHide: column.initialHide ?? hide ?? undefined,
    initialPinned: column.initialPinned ?? pinned ?? undefined,
  };
}

export function NexoDataGrid<TRow extends IdentifiableRow>({
  gridKey,
  serverManaged = false,
  clientManaged = false,
  ariaLabel,
  rows,
  columns,
  loading = false,
  height = 650,
  minHeight = 360,
  paginationModel,
  onPaginationModelChange,
  rowCount,
  sortModel,
  onSortModelChange,
  onFilterModelChange,
  filterResetKey = 0,
  onVisibleColumnsChange,
  namedViewFilters = {},
  onNamedViewApply,
  footerSummary,
}: NexoDataGridProps<TRow>) {
  const gridApiRef = useRef<GridApi<TRow> | null>(null);

  const paginationModelRef = useRef(paginationModel);

  const isApplyingStoredLayoutRef = useRef(false);
  const preferenceRef = useRef<GridPreference | null>(null);
  const preferenceTimerRef = useRef<number | null>(null);

  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [definition, setDefinition] = useState<GridDefinition | null>(null);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [renameField, setRenameField] = useState<{
    fieldKey: string;
    systemLabel: string;
    visibleName: string;
  } | null>(null);
  const [renameReason, setRenameReason] = useState("");
  const [gridSettingsError, setGridSettingsError] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [visibleFieldKeys, setVisibleFieldKeys] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<SavedGridView[]>([]);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [newSavedViewName, setNewSavedViewName] = useState("");
  const [newSavedViewIsDefault, setNewSavedViewIsDefault] = useState(false);
  const [savingNamedView, setSavingNamedView] = useState(false);

  const layoutColumnIds = useMemo(
    () =>
      columns
        .map((column) => String(column.colId ?? column.field ?? ""))
        .filter(Boolean),
    [columns],
  );

  const resolvedColumns = useMemo<ColDef<TRow>[]>(() => {
    const rowNumberColumn: ColDef<TRow> = {
      colId: "__row_number__",
      headerName: "N°",
      width: 72,
      minWidth: 72,
      maxWidth: 72,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: "left",
      pinned: "left",
      headerClass: "nexo-grid-centered-header",
      cellStyle: {
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      },
      valueGetter: (params) => {
        const currentPagination = paginationModelRef.current;

        const rowIndex = params.node?.rowIndex ?? 0;

        return (
          currentPagination.page * currentPagination.pageSize + rowIndex + 1
        );
      },
    };

    const definitionByKey = new Map(
      definition?.columns.map((column) => [column.field_key, column]) ?? [],
    );

    const configuredColumns = columns.map((column) => {
      const initialColumn = toInitialLayoutColumn(column);
      const fieldKey = String(column.colId ?? column.field ?? "");
      const metadata = definitionByKey.get(fieldKey);

      if (!metadata) {
        return initialColumn;
      }

      return {
        ...initialColumn,
        headerName: metadata.visible_name,
        sortable: metadata.sortable && Boolean(onSortModelChange),
        filter:
          metadata.filter_operators.length > 0 && (onFilterModelChange || clientManaged)
            ? metadata.data_type === "number"
              ? "agNumberColumnFilter"
              : "agTextColumnFilter"
            : false,
        filterParams:
          metadata.filter_operators.length > 0 && (onFilterModelChange || clientManaged)
            ? {
                filterOptions: metadata.filter_operators,
                maxNumConditions: 1,
                buttons: ["apply", "reset"],
                closeOnApply: true,
              }
            : undefined,
        lockVisible: metadata.required || !metadata.hideable,
        lockPinned: !metadata.pinnable,
      };
    });

    const operationalColumns = configuredColumns.filter(
      (column) => String(column.colId ?? column.field ?? "") !== "actions",
    );
    const actionColumns = configuredColumns
      .filter((column) => String(column.colId ?? column.field ?? "") === "actions")
      .map((column) => ({
        ...column,
        pinned: null,
        lockPinned: true,
        suppressMovable: true,
      }));

    return [rowNumberColumn, ...operationalColumns, ...actionColumns];
  }, [clientManaged, columns, definition, onFilterModelChange, onSortModelChange]);

  const releaseLayoutMutationLock = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        isApplyingStoredLayoutRef.current = false;
      });
    });
  }, []);

  const applyControlledSort = useCallback(
    (api: GridApi<TRow>) => {
      api.applyColumnState({
        state: sortModel
          ? [
              {
                colId: sortModel.field,
                sort: sortModel.direction,
                sortIndex: 0,
              },
            ]
          : [],
        defaultState: {
          sort: null,
          sortIndex: null,
        },
      });
    },
    [sortModel],
  );

  const enforceActionsColumnPolicy = useCallback((api: GridApi<TRow>) => {
    const currentState = api.getColumnState();
    const actionsState = currentState.find((column) => column.colId === "actions");

    if (!actionsState) {
      return;
    }

    api.applyColumnState({
      state: [
        ...currentState.filter((column) => column.colId !== "actions"),
        {
          ...actionsState,
          pinned: null,
          hide: false,
        },
      ],
      applyOrder: true,
    });
  }, []);

  const restoreStoredLayout = useCallback(
    (api: GridApi<TRow>) => {
      isApplyingStoredLayoutRef.current = true;

      const restored = restoreNexoGridLayout(api, gridKey, layoutColumnIds);

      applyControlledSort(api);
      enforceActionsColumnPolicy(api);
      setHasSavedLayout(restored);
      releaseLayoutMutationLock();
      return restored;
    },
    [applyControlledSort, enforceActionsColumnPolicy, gridKey, layoutColumnIds, releaseLayoutMutationLock],
  );

  const emitVisibleColumns = useCallback(
    (api: GridApi<TRow>) => {
      const visibleColumns = api
        .getColumnState()
        .filter(
          (column) =>
            column.colId !== "__row_number__" &&
            column.colId !== "actions" &&
            !column.hide,
        )
        .map((column) => column.colId);

      setVisibleFieldKeys(visibleColumns);
      onVisibleColumnsChange?.(visibleColumns);
    },
    [onVisibleColumnsChange],
  );

  const applyBackendPreference = useCallback(
    (api: GridApi<TRow>, preference: GridPreference) => {
      const knownColumns = new Set(layoutColumnIds);
      const state = preference.config.columns
        .filter((column) => knownColumns.has(column.field_key))
        .map((column) => ({
          colId: column.field_key,
          width: column.width,
          hide: column.hidden,
          pinned: column.pinned,
        }));

      if (state.length > 0) {
        isApplyingStoredLayoutRef.current = true;
        api.applyColumnState({ state, applyOrder: true });
        applyControlledSort(api);
        releaseLayoutMutationLock();
      }
      enforceActionsColumnPolicy(api);

      if (
        preference.config.page_size !== paginationModelRef.current.pageSize
      ) {
        onPaginationModelChange({
          page: 0,
          pageSize: preference.config.page_size,
        });
      }

      preferenceRef.current = preference;
      setHasSavedLayout(preference.revision > 0 || state.length > 0);
      emitVisibleColumns(api);
    },
    [
      applyControlledSort,
      emitVisibleColumns,
      enforceActionsColumnPolicy,
      layoutColumnIds,
      onPaginationModelChange,
      releaseLayoutMutationLock,
    ],
  );

  const persistBackendLayout = useCallback(
    (api: GridApi<TRow>, pageSize = paginationModelRef.current.pageSize) => {
      if (!serverManaged || !preferenceRef.current) {
        return;
      }

      if (preferenceTimerRef.current !== null) {
        window.clearTimeout(preferenceTimerRef.current);
      }

      preferenceTimerRef.current = window.setTimeout(async () => {
        const currentPreference = preferenceRef.current;
        if (!currentPreference) {
          return;
        }

        try {
          const savedPreference = await saveGridPreference(
            currentPreference,
            api.getColumnState(),
            pageSize,
          );
          preferenceRef.current = savedPreference;
          setHasSavedLayout(true);
          setGridSettingsError("");
        } catch (error: unknown) {
          setGridSettingsError(
            getApiErrorMessage(
              error,
              "No se pudo guardar la configuración de columnas.",
            ),
          );
        }
      }, 750);
    },
    [serverManaged],
  );

  useEffect(
    () => () => {
      if (preferenceTimerRef.current !== null) {
        window.clearTimeout(preferenceTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const api = gridApiRef.current;

    if (!api) {
      return;
    }

    applyControlledSort(api);
  }, [applyControlledSort]);

  useEffect(() => {
    paginationModelRef.current = {
      page: paginationModel.page,
      pageSize: paginationModel.pageSize,
    };

    if (clientManaged && gridApiRef.current) {
      gridApiRef.current.setGridOption("paginationPageSize", paginationModel.pageSize);
      gridApiRef.current.paginationGoToPage(paginationModel.page);
    }

    gridApiRef.current?.refreshCells({
      columns: ["__row_number__"],
      force: true,
    });
  }, [clientManaged, paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    if (filterResetKey > 0) {
      gridApiRef.current?.setFilterModel(null);
    }
  }, [filterResetKey]);

  const handleColumnLayoutChanged = useCallback(
    (event: ColumnLayoutEvent<TRow>) => {
      if (isApplyingStoredLayoutRef.current) {
        return;
      }

      if (typeof event.finished === "boolean" && !event.finished) {
        return;
      }

      const persisted = persistNexoGridLayout(
        event.api,
        gridKey,
        layoutColumnIds,
      );

      if (persisted) {
        setHasSavedLayout(true);
      }

      emitVisibleColumns(event.api);
      persistBackendLayout(event.api);
    },
    [emitVisibleColumns, gridKey, layoutColumnIds, persistBackendLayout],
  );

  const handleResetColumnLayout = useCallback(() => {
    const api = gridApiRef.current;

    if (!api) {
      return;
    }

    isApplyingStoredLayoutRef.current = true;

    clearNexoGridLayout(gridKey);
    api.resetColumnState();
    applyControlledSort(api);

    if (serverManaged) {
      void resetGridPreference(gridKey)
        .then(() => {
          if (preferenceRef.current) {
            preferenceRef.current = {
              ...preferenceRef.current,
              revision: 0,
              config: {
                columns: [],
                page_size:
                  definition?.default_page_size ?? paginationModel.pageSize,
              },
            };
          }
          setGridSettingsError("");
        })
        .catch((error: unknown) => {
          setGridSettingsError(
            getApiErrorMessage(error, "No se pudo restablecer la grilla."),
          );
        });
    }

    setHasSavedLayout(false);
    emitVisibleColumns(api);
    releaseLayoutMutationLock();
  }, [
    applyControlledSort,
    definition?.default_page_size,
    emitVisibleColumns,
    gridKey,
    paginationModel.pageSize,
    releaseLayoutMutationLock,
    serverManaged,
  ]);

  const defaultColDef = useMemo<ColDef<TRow>>(
    () => ({
      sortable: Boolean(onSortModelChange),
      resizable: true,
      filter: Boolean(onFilterModelChange || clientManaged),
      minWidth: 110,
      unSortIcon: true,
    }),
    [clientManaged, onFilterModelChange, onSortModelChange],
  );

  const handleSortChanged = (event: SortChangedEvent<TRow>) => {
    if (!onSortModelChange || isApplyingStoredLayoutRef.current) {
      return;
    }

    const sortedColumn = event.api
      .getColumnState()
      .find(
        (columnState) =>
          columnState.colId !== "__row_number__" &&
          (columnState.sort === "asc" || columnState.sort === "desc"),
      );

    const nextSortModel: NexoGridSortModel = sortedColumn
      ? {
          field: sortedColumn.colId,
          direction: sortedColumn.sort as "asc" | "desc",
        }
      : null;

    if (areSortModelsEqual(sortModel, nextSortModel)) {
      return;
    }

    onSortModelChange(nextSortModel);
  };

  const handleFilterChanged = () => {
    if (
      !onFilterModelChange ||
      !gridApiRef.current ||
      isApplyingStoredLayoutRef.current
    ) {
      return;
    }

    onFilterModelChange(
      toNexoGridFilters(gridApiRef.current.getFilterModel()),
    );
  };

  const applyNamedView = useCallback(
    (view: SavedGridView) => {
      const api = gridApiRef.current;
      if (!api) {
        return;
      }

      isApplyingStoredLayoutRef.current = true;
      api.applyColumnState({
        state: view.config.columns.map((column) => ({
          colId: column.field_key,
          width: column.width,
          hide: column.hidden,
          pinned: column.pinned,
        })),
        applyOrder: true,
      });

      enforceActionsColumnPolicy(api);
      const columnFilters = Array.isArray(view.config.filters.column_filters)
        ? (view.config.filters.column_filters as NexoGridFilter[])
        : [];
      api.setFilterModel(toAgGridFilterModel(columnFilters));
      emitVisibleColumns(api);
      setSelectedSavedViewId(String(view.id));
      onNamedViewApply?.(view.config);
      releaseLayoutMutationLock();
    },
    [emitVisibleColumns, enforceActionsColumnPolicy, onNamedViewApply, releaseLayoutMutationLock],
  );

  const handleCreateNamedView = async () => {
    const api = gridApiRef.current;
    const normalizedName = newSavedViewName.trim();

    if (!api || !normalizedName) {
      setGridSettingsError("Escribe un nombre para guardar la vista.");
      return;
    }

    try {
      setSavingNamedView(true);
      const columnFilters = toNexoGridFilters(api.getFilterModel());
      const savedView = await createSavedGridView(gridKey, {
        name: normalizedName,
        is_default: newSavedViewIsDefault,
        config: {
          columns: api
            .getColumnState()
            .filter((column) => column.colId !== "__row_number__")
            .map((column) => ({
              field_key: column.colId,
              ...(typeof column.width === "number"
                ? { width: column.width }
                : {}),
              hidden: Boolean(column.hide),
              pinned:
                column.pinned === "left" || column.pinned === "right"
                  ? column.pinned
                  : null,
            })),
          page_size: paginationModelRef.current.pageSize,
          sort: sortModel || null,
          filters: {
            ...namedViewFilters,
            column_filters: columnFilters,
          },
        },
      });

      setSavedViews((current) => {
        const next = newSavedViewIsDefault
          ? current.map((view) => ({ ...view, is_default: false }))
          : current;
        return [savedView, ...next].sort(
          (left, right) =>
            Number(right.is_default) - Number(left.is_default) ||
            left.name.localeCompare(right.name, "es"),
        );
      });
      setSelectedSavedViewId(String(savedView.id));
      setNewSavedViewName("");
      setNewSavedViewIsDefault(false);
      setGridSettingsError("");
    } catch (error: unknown) {
      setGridSettingsError(
        getApiErrorMessage(error, "No se pudo guardar la vista personal."),
      );
    } finally {
      setSavingNamedView(false);
    }
  };

  const handleDeleteNamedView = async () => {
    const viewId = Number(selectedSavedViewId);
    if (!viewId) {
      return;
    }

    try {
      setSavingNamedView(true);
      await deleteSavedGridView(gridKey, viewId);
      setSavedViews((current) =>
        current.filter((view) => view.id !== viewId),
      );
      setSelectedSavedViewId("");
      setGridSettingsError("");
    } catch (error: unknown) {
      setGridSettingsError(
        getApiErrorMessage(error, "No se pudo eliminar la vista personal."),
      );
    } finally {
      setSavingNamedView(false);
    }
  };

  const handleGridReady = async (api: GridApi<TRow>) => {
    gridApiRef.current = api;
    api.setGridAriaProperty("label", ariaLabel);

    const restoredLocalLayout = restoreStoredLayout(api);
    emitVisibleColumns(api);

    if (!serverManaged) {
      return;
    }

    try {
      const [gridDefinition, preference, personalViews] = await Promise.all([
        fetchGridDefinition(gridKey),
        fetchGridPreference(gridKey),
        fetchSavedGridViews(gridKey),
      ]);

      setDefinition(gridDefinition);
      setSavedViews(personalViews);
      preferenceRef.current = preference;

      if (preference.revision > 0) {
        applyBackendPreference(api, preference);
      } else if (restoredLocalLayout) {
        persistBackendLayout(api);
      } else {
        applyBackendPreference(api, preference);
      }

      const defaultView = personalViews.find((view) => view.is_default);
      if (defaultView) {
        applyNamedView(defaultView);
      }

      setGridSettingsError("");
    } catch (error: unknown) {
      setGridSettingsError(
        getApiErrorMessage(
          error,
          "No se pudo cargar la configuración compartida de la grilla.",
        ),
      );
    }
  };

  const handleRenameColumn = async () => {
    if (!renameField || !definition) {
      return;
    }

    try {
      setSavingRename(true);
      const renamed = await renameGlobalGridColumn(
        gridKey,
        renameField.fieldKey,
        renameField.visibleName,
        renameReason,
      );

      setDefinition((current) =>
        current
          ? {
              ...current,
              columns: current.columns.map((column) =>
                column.field_key === renamed.field_key
                  ? { ...column, visible_name: renamed.visible_name }
                  : column,
              ),
            }
          : current,
      );
      setRenameField(null);
      setRenameReason("");
      setGridSettingsError("");
      window.requestAnimationFrame(() => gridApiRef.current?.refreshHeader());
    } catch (error: unknown) {
      setGridSettingsError(
        getApiErrorMessage(error, "No se pudo renombrar la columna."),
      );
    } finally {
      setSavingRename(false);
    }
  };

  const toggleColumnVisibility = (fieldKey: string, visible: boolean) => {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.setColumnsVisible([fieldKey], visible);
    emitVisibleColumns(api);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(rowCount / paginationModel.pageSize),
  );

  const safePage = Math.min(paginationModel.page, totalPages - 1);

  const gridAccent = gridKey.startsWith("inventory.")
    ? colors.modules.inventory.border
    : gridKey.startsWith("sales.")
      ? colors.modules.sales.border
      : gridKey.startsWith("purchases.")
        ? colors.modules.purchases.border
        : gridKey.startsWith("commercial.")
          ? colors.modules.commercial.border
          : colors.border.light;

  return (
    <>
      <Box
      data-grid-key={gridKey}

      sx={{
        height,
        minHeight,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.background.paper,
        borderRadius: colors.radius.xs,
        border: `2px solid ${gridAccent}`,
        boxShadow: colors.shadow.card,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
        }}
      >
        {loading ? (
          <LinearProgress
            aria-label="Cargando registros"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
            }}
          />
        ) : null}

        <AgGridReact<TRow>
          theme={nexoGridTheme}
          localeText={nexoGridLocaleEs}
          onGridReady={(event) => void handleGridReady(event.api)}
          rowData={rows}
          columnDefs={resolvedColumns}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          onSortChanged={onSortModelChange ? handleSortChanged : undefined}
          onFilterChanged={onFilterModelChange ? handleFilterChanged : undefined}
          onColumnMoved={handleColumnLayoutChanged}
          onColumnResized={handleColumnLayoutChanged}
          onColumnVisible={handleColumnLayoutChanged}
          onColumnPinned={handleColumnLayoutChanged}
          noRowsOverlayComponent={NoRowsOverlay}
          suppressMultiSort
          maintainColumnOrder
          suppressDragLeaveHidesColumns
          animateRows={false}
          ensureDomOrder
          enableCellTextSelection
          pagination={clientManaged}
          paginationPageSize={clientManaged ? paginationModel.pageSize : undefined}
          suppressPaginationPanel={clientManaged}
          onPaginationChanged={
            clientManaged
              ? (event) => {
                  const nextPage = event.api.paginationGetCurrentPage();
                  if (nextPage !== paginationModelRef.current.page) {
                    onPaginationModelChange({
                      page: nextPage,
                      pageSize: paginationModelRef.current.pageSize,
                    });
                  }
                }
              : undefined
          }
          rowHeight={NEXO_GRID_ROW_HEIGHT}
          headerHeight={NEXO_GRID_HEADER_HEIGHT}
          sortingOrder={["asc", "desc", null]}
        />
      </Box>

      {gridSettingsError ? (
        <Alert
          severity="warning"
          onClose={() => setGridSettingsError("")}
          sx={{ borderRadius: 0 }}
        >
          {gridSettingsError}
        </Alert>
      ) : null}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          flexShrink: 0,
          alignItems: {
            xs: "stretch",
            sm: "center",
          },
          borderTop: `1px solid ${colors.border.light}`,
          bgcolor: colors.background.header,
        }}
      >
        {footerSummary ? (
          <Box
            sx={{
              px: { xs: 1.5, sm: 2 },
              py: 0.8,
              borderBottom: { xs: `1px solid ${colors.border.light}`, sm: 0 },
              borderRight: { xs: 0, sm: `1px solid ${colors.border.light}` },
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {footerSummary}
          </Box>
        ) : null}

        <Button
          size="small"
          variant="text"
          startIcon={<RestartAltIcon />}
          onClick={handleResetColumnLayout}
          disabled={!hasSavedLayout}
          sx={{
            alignSelf: {
              xs: "flex-start",
              sm: "center",
            },
            ml: { sm: 1.5 },
            color: colors.text.secondary,
            fontWeight: 700,
          }}
        >
          Restablecer columnas

        </Button>
        {serverManaged && definition ? (
          <Button
            size="small"
            variant="text"
            startIcon={<ViewColumnIcon />}
            onClick={() => setColumnsDialogOpen(true)}
            sx={{ color: colors.text.secondary, fontWeight: 700 }}
          >
            Columnas y vista
          </Button>
        ) : null}

        <TablePagination
          component="div"
          count={rowCount}
          page={safePage}
          rowsPerPage={paginationModel.pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, nextPage) =>
            onPaginationModelChange({
              ...paginationModel,
              page: nextPage,
            })
          }
          onRowsPerPageChange={(event) => {
            const nextPageSize = Number(event.target.value);
            onPaginationModelChange({
              page: 0,
              pageSize: nextPageSize,
            });
            if (gridApiRef.current) {
              persistBackendLayout(gridApiRef.current, nextPageSize);
            }
          }}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} de ${count}`
          }
          sx={{
            ml: { sm: "auto" },
            color: colors.text.secondary,
            bgcolor: "transparent",
          }}
        />
      </Stack>
      </Box>

      <Dialog
        open={columnsDialogOpen}
        onClose={() => setColumnsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby={`${gridKey}-columns-title`}
      >
        <DialogTitle id={`${gridKey}-columns-title`}>
          Columnas y vista
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ color: colors.text.secondary, mb: 2 }}
          >
            La visibilidad, el orden y el ancho se guardan únicamente para tu
            usuario. Los nombres sólo pueden cambiarse globalmente con permiso
            administrativo.
          </Typography>

          <Box
            sx={{
              p: 1.5,
              mb: 2,
              border: `1px solid ${colors.border.light}`,
              borderRadius: colors.radius.md,
              bgcolor: colors.surface.soft,
            }}
          >
            <Typography
              sx={{ color: colors.text.primary, fontWeight: 850, mb: 0.5 }}
            >
              Mis vistas personales
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: colors.text.secondary, mb: 1.5 }}
            >
              Guarda filtros, orden, columnas y filas por página. Sólo tú
              puedes ver estas vistas.
            </Typography>

            <Stack spacing={1.25}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  select
                  size="small"
                  label="Vista guardada"
                  value={selectedSavedViewId}
                  onChange={(event) =>
                    setSelectedSavedViewId(event.target.value)
                  }
                  fullWidth
                >
                  <MenuItem value="">
                    {savedViews.length > 0
                      ? "Selecciona una vista"
                      : "Todavía no tienes vistas"}
                  </MenuItem>
                  {savedViews.map((view) => (
                    <MenuItem key={view.id} value={String(view.id)}>
                      {view.name}
                      {view.is_default ? " · Predeterminada" : ""}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="outlined"
                  disabled={!selectedSavedViewId || savingNamedView}
                  onClick={() => {
                    const selected = savedViews.find(
                      (view) => String(view.id) === selectedSavedViewId,
                    );
                    if (selected) {
                      applyNamedView(selected);
                      setColumnsDialogOpen(false);
                    }
                  }}
                >
                  Aplicar
                </Button>

                <IconButton
                  aria-label="Eliminar vista personal seleccionada"
                  disabled={!selectedSavedViewId || savingNamedView}
                  onClick={() => void handleDeleteNamedView()}
                  sx={{ color: colors.status.error }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Nombre de la nueva vista"
                  value={newSavedViewName}
                  onChange={(event) => setNewSavedViewName(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  fullWidth
                />

                <Button
                  variant="contained"
                  startIcon={<BookmarkAddIcon />}
                  disabled={!newSavedViewName.trim() || savingNamedView}
                  onClick={() => void handleCreateNamedView()}
                  sx={{ minWidth: 150 }}
                >
                  Guardar actual
                </Button>
              </Stack>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={newSavedViewIsDefault}
                    onChange={(event) =>
                      setNewSavedViewIsDefault(event.target.checked)
                    }
                  />
                }
                label="Abrir esta vista automáticamente"
              />
            </Stack>
          </Box>

          <Stack spacing={0.5}>
            {definition?.columns.map((column) => (
              <Stack
                key={column.field_key}
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={
                        column.required ||
                        column.field_key === "actions" ||
                        visibleFieldKeys.includes(column.field_key)
                      }
                      disabled={column.required || !column.hideable}
                      onChange={(event) =>
                        toggleColumnVisibility(
                          column.field_key,
                          event.target.checked,
                        )
                      }
                    />
                  }
                  label={column.visible_name}
                />

                {definition.permissions.can_rename_global &&
                column.field_key !== "actions" ? (
                  <IconButton
                    aria-label={`Renombrar globalmente ${column.visible_name}`}
                    onClick={() => {
                      setRenameField({
                        fieldKey: column.field_key,
                        systemLabel: column.system_label,
                        visibleName: column.visible_name,
                      });
                      setRenameReason("");
                      setGridSettingsError("");
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnsDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(renameField)}
        onClose={() => {
          if (!savingRename) {
            setRenameField(null);
            setRenameReason("");
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Renombrar columna para toda NEXO</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              El cambio será visible para todos los usuarios. La clave técnica
              y la exportación oficial no se modificarán.
            </Alert>
            <TextField
              label="Nombre técnico del sistema"
              value={renameField?.systemLabel ?? ""}
              disabled
              fullWidth
            />
            <TextField
              label="Nuevo nombre visible"
              value={renameField?.visibleName ?? ""}
              onChange={(event) =>
                setRenameField((current) =>
                  current
                    ? { ...current, visibleName: event.target.value }
                    : current,
                )
              }
              slotProps={{ htmlInput: { maxLength: 160 } }}
              autoFocus
              required
              fullWidth
            />
            <TextField
              label="Motivo del cambio"
              value={renameReason}
              onChange={(event) => setRenameReason(event.target.value)}
              helperText="El motivo quedará registrado en auditoría."
              slotProps={{ htmlInput: { maxLength: 500 } }}
              minRows={2}
              multiline
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRenameField(null);
              setRenameReason("");
            }}
            disabled={savingRename}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleRenameColumn()}
            disabled={
              savingRename ||
              !renameField?.visibleName.trim() ||
              renameReason.trim().length < 5
            }
          >
            Aplicar globalmente
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
