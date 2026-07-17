import { useMemo } from "react";
import {
  Box,
  LinearProgress,
  TablePagination,
  Typography,
} from "@mui/material";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type SortChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { colors } from "../theme/colors";

ModuleRegistry.registerModules([AllCommunityModule]);

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
  fontSize: 14,
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
        const rowIndex = params.node?.rowIndex ?? 0;

        return paginationModel.page * paginationModel.pageSize + rowIndex + 1;
      },
    };

    const configuredColumns = columns.map((column) => {
      const columnId = String(column.colId ?? column.field ?? "");
      const isSorted = Boolean(sortModel) && sortModel?.field === columnId;

      return {
        ...column,
        sort: isSorted ? sortModel?.direction : null,
      };
    });

    return [rowNumberColumn, ...configuredColumns];
  }, [columns, paginationModel.page, paginationModel.pageSize, sortModel]);

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
            event.api.setGridAriaProperty("label", ariaLabel);
          }}
          rowData={rows}
          columnDefs={resolvedColumns}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          onSortChanged={onSortModelChange ? handleSortChanged : undefined}
          noRowsOverlayComponent={NoRowsOverlay}
          suppressMultiSort
          animateRows={false}
          ensureDomOrder
          enableCellTextSelection
          rowHeight={54}
          headerHeight={50}
          sortingOrder={["asc", "desc", null]}
        />
      </Box>

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
          flexShrink: 0,
          color: colors.text.secondary,
          borderTop: `1px solid ${colors.border.light}`,
          bgcolor: colors.background.header,
        }}
      />
    </Box>
  );
}
