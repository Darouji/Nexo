import { memo, useMemo } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type {
  GridColDef,
  GridPaginationModel,
  GridValidRowModel,
} from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { Box } from "@mui/material";
import { EmptyState } from "./StateFeedback";
import { colors } from "../theme/colors";

interface SmartDataGridProps {
  rows: GridValidRowModel[];
  columns: GridColDef[];
  loading?: boolean;
  height?: number | string;
  minHeight?: number | string;
  hideToolbar?: boolean;
  paginationMode?: "client" | "server";
  paginationModel?: GridPaginationModel;
  onPaginationModelChange?: (model: GridPaginationModel) => void;
  rowCount?: number;
  rowNumberOffset?: number;
}

const defaultGridInitialState = {
  pagination: {
    paginationModel: {
      pageSize: 10,
    },
  },
};

export const SmartDataGrid = memo(function SmartDataGrid({
  rows,
  columns,
  loading = false,
  height = 650,
  minHeight = 360,
  hideToolbar = false,
  paginationMode = "client",
  paginationModel,
  onPaginationModelChange,
  rowCount,
  rowNumberOffset = 0,
}: SmartDataGridProps) {
  const baseColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "numero_fila",
        headerName: "N°",
        width: 64,
        filterable: false,
        sortable: false,
        disableColumnMenu: true,
        align: "center",
        headerAlign: "center",
        renderCell: (params) =>
          rowNumberOffset + params.api.getAllRowIds().indexOf(params.id) + 1,
      },
      ...columns,
    ],
    [columns, rowNumberOffset],
  );

  const usesServerPagination = paginationMode === "server";

  return (
    <Box
      sx={{
        height: rows.length > 0 ? height : minHeight,
        minHeight,
        width: "100%",
        bgcolor: colors.background.paper,
        borderRadius: colors.radius.lg,
        border: `1px solid ${colors.border.light}`,
        boxShadow: colors.shadow.card,
        overflow: "hidden",
      }}
    >
      <DataGrid
        rows={rows}
        columns={baseColumns}
        loading={loading}
        localeText={esES.components.MuiDataGrid.defaultProps.localeText}
        slots={{
          toolbar: hideToolbar ? undefined : GridToolbar,
          noRowsOverlay: EmptyState,
          noResultsOverlay: EmptyState,
        }}
        disableRowSelectionOnClick
        disableColumnSorting={usesServerPagination}
        paginationMode={paginationMode}
        paginationModel={usesServerPagination ? paginationModel : undefined}
        onPaginationModelChange={
          usesServerPagination ? onPaginationModelChange : undefined
        }
        rowCount={usesServerPagination ? rowCount : undefined}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={
          usesServerPagination ? undefined : defaultGridInitialState
        }
        sx={{
          border: "none",
          color: colors.text.primary,
          bgcolor: colors.background.paper,

          "& .MuiDataGrid-cell": {
            borderColor: colors.border.light,
            outline: "none",
          },

          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
            outline: "none",
          },

          "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within":
            {
              outline: "none",
            },

          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: colors.background.header,
            borderColor: colors.border.light,
            color: colors.text.secondary,
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: "0.82rem",
          },

          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 900,
          },

          "& .MuiDataGrid-row:hover": {
            backgroundColor: colors.action.hover,
          },

          "& .MuiDataGrid-row.Mui-selected": {
            backgroundColor: colors.action.selected,
          },

          "& .MuiDataGrid-footerContainer": {
            borderColor: colors.border.light,
            backgroundColor: colors.background.header,
          },

          "& .MuiDataGrid-toolbarContainer": {
            p: 1,
            borderBottom: `1px solid ${colors.border.light}`,

            "& .MuiButton-root": {
              color: colors.primary.main,
              fontWeight: 850,
            },
          },

          "& .MuiTablePagination-root": {
            color: colors.text.secondary,
          },

          "& .MuiDataGrid-overlayWrapper": {
            minHeight,
          },
        }}
      />
    </Box>
  );
});
