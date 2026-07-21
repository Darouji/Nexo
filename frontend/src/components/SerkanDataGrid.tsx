import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { AgGridReact } from "ag-grid-react";
import { colors } from "../theme/colors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearSerkanGridLayout,
  persistSerkanGridLayout,
  restoreSerkanGridLayout,
} from "./serkanGridLayoutStorage";

import {
  Box,
  Button,
  LinearProgress,
  TablePagination,
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

const SERKAN_GRID_FONT_SIZE = 12;
const SERKAN_GRID_ROW_HEIGHT = 46;
const SERKAN_GRID_HEADER_HEIGHT = 43;

export type SerkanGridPaginationModel = {
  page: number;
  pageSize: number;
};

export type SerkanGridSortModel = {
  field: string;
  direction: "asc" | "desc";
} | null;

type IdentifiableRow = {
  id: number | string;
};

type ColumnLayoutEvent<TRow extends IdentifiableRow> = {
  api: GridApi<TRow>;
  finished?: boolean;
};

type SerkanDataGridProps<TRow extends IdentifiableRow> = {
  gridKey: string;
  ariaLabel: string;
  rows: TRow[];
  columns: ColDef<TRow>[];
  loading?: boolean;
  height?: number | string;
  minHeight?: number | string;

  paginationModel: SerkanGridPaginationModel;
  onPaginationModelChange: (model: SerkanGridPaginationModel) => void;
  rowCount: number;

  sortModel?: SerkanGridSortModel;
  onSortModelChange?: (model: SerkanGridSortModel) => void;
};

const serkanGridTheme = themeQuartz.withParams({
  accentColor: colors.primary.main,
  backgroundColor: colors.background.paper,
  foregroundColor: colors.text.primary,
  borderColor: colors.border.light,
  headerBackgroundColor: colors.background.header,
  headerTextColor: colors.text.secondary,
  rowHoverColor: colors.action.hover,
  fontSize: SERKAN_GRID_FONT_SIZE,
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
  current: SerkanGridSortModel | undefined,
  next: SerkanGridSortModel,
) {
  return (
    current?.field === next?.field && current?.direction === next?.direction
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

export function SerkanDataGrid<TRow extends IdentifiableRow>({
  gridKey,
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
}: SerkanDataGridProps<TRow>) {
  const gridApiRef = useRef<GridApi<TRow> | null>(null);

  const paginationModelRef = useRef(paginationModel);

  const isApplyingStoredLayoutRef = useRef(false);

  const [hasSavedLayout, setHasSavedLayout] = useState(false);

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
      headerClass: "serkan-grid-centered-header",
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

    const configuredColumns = columns.map((column) =>
      toInitialLayoutColumn(column),
    );

    return [rowNumberColumn, ...configuredColumns];
  }, [columns]);

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

  const restoreStoredLayout = useCallback(
    (api: GridApi<TRow>) => {
      isApplyingStoredLayoutRef.current = true;

      const restored = restoreSerkanGridLayout(api, gridKey, layoutColumnIds);

      applyControlledSort(api);
      setHasSavedLayout(restored);
      releaseLayoutMutationLock();
    },
    [applyControlledSort, gridKey, layoutColumnIds, releaseLayoutMutationLock],
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

    gridApiRef.current?.refreshCells({
      columns: ["__row_number__"],
      force: true,
    });
  }, [paginationModel.page, paginationModel.pageSize]);

  const handleColumnLayoutChanged = useCallback(
    (event: ColumnLayoutEvent<TRow>) => {
      if (isApplyingStoredLayoutRef.current) {
        return;
      }

      if (typeof event.finished === "boolean" && !event.finished) {
        return;
      }

      const persisted = persistSerkanGridLayout(
        event.api,
        gridKey,
        layoutColumnIds,
      );

      if (persisted) {
        setHasSavedLayout(true);
      }
    },
    [gridKey, layoutColumnIds],
  );

  const handleResetColumnLayout = useCallback(() => {
    const api = gridApiRef.current;

    if (!api) {
      return;
    }

    isApplyingStoredLayoutRef.current = true;

    clearSerkanGridLayout(gridKey);
    api.resetColumnState();
    applyControlledSort(api);

    setHasSavedLayout(false);
    releaseLayoutMutationLock();
  }, [applyControlledSort, gridKey, releaseLayoutMutationLock]);

  const defaultColDef = useMemo<ColDef<TRow>>(
    () => ({
      sortable: Boolean(onSortModelChange),
      resizable: true,
      filter: false,
      minWidth: 110,
      unSortIcon: true,
    }),
    [onSortModelChange],
  );

  const handleSortChanged = (event: SortChangedEvent<TRow>) => {
    if (!onSortModelChange) {
      return;
    }

    const sortedColumn = event.api
      .getColumnState()
      .find(
        (columnState) =>
          columnState.colId !== "__row_number__" &&
          (columnState.sort === "asc" || columnState.sort === "desc"),
      );

    const nextSortModel: SerkanGridSortModel = sortedColumn
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

  const totalPages = Math.max(
    1,
    Math.ceil(rowCount / paginationModel.pageSize),
  );

  const safePage = Math.min(paginationModel.page, totalPages - 1);

  return (
    <Box
      data-grid-key={gridKey}
      sx={{
        height,
        minHeight,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.background.paper,
        borderRadius: colors.radius.lg,
        border: `1px solid ${colors.border.light}`,
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
          theme={serkanGridTheme}
          onGridReady={(event) => {
            gridApiRef.current = event.api;

            event.api.setGridAriaProperty("label", ariaLabel);

            restoreStoredLayout(event.api);
          }}
          rowData={rows}
          columnDefs={resolvedColumns}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          onSortChanged={onSortModelChange ? handleSortChanged : undefined}
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
          rowHeight={SERKAN_GRID_ROW_HEIGHT}
          headerHeight={SERKAN_GRID_HEADER_HEIGHT}
          sortingOrder={["asc", "desc", null]}
        />
      </Box>

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
          onRowsPerPageChange={(event) =>
            onPaginationModelChange({
              page: 0,
              pageSize: Number(event.target.value),
            })
          }
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
  );
}
