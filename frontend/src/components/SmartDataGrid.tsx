import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { Box } from "@mui/material";
import { colors } from "../theme/colors";

interface SmartDataGridProps {
  rows: GridValidRowModel[];
  columns: GridColDef[];
  loading?: boolean;
}

export function SmartDataGrid({
  rows,
  columns,
  loading = false,
}: SmartDataGridProps) {
  // Inyección automática de la columna dinámica "N°" solicitada en el documento
  const baseColumns: GridColDef[] = [
    {
      field: "numero_fila",
      headerName: "N°",
      width: 60,
      filterable: false,
      sortable: false,
      disableColumnMenu: true,
      // Calcula el número de fila matemáticamente en el frontend
      renderCell: (index) => index.api.getAllRowIds().indexOf(index.id) + 1,
    },
    ...columns,
  ];

  return (
    <Box
      sx={{
        height: 650,
        width: "100%",
        bgcolor: colors.background.paper,
        borderRadius: 1,
        boxShadow: `0 0 10px rgba(0, 0, 0, 0.5)`,
      }}
    >
      <DataGrid
        rows={rows}
        columns={baseColumns}
        loading={loading}
        localeText={esES.components.MuiDataGrid.defaultProps.localeText}
        slots={{ toolbar: GridToolbar }} // Activa los botones de Exportar a Excel, Filtros y Vistas
        disableRowSelectionOnClick
        sx={{
          border: `1px solid ${colors.border.light}`,
          color: colors.text.primary,
          // Estilos Cyberpunk Sobrio para la Malla
          "& .MuiDataGrid-cell": {
            borderColor: colors.border.light,
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: colors.background.header,
            borderColor: colors.border.light,
            color: colors.text.secondary,
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: "0.85rem",
          },
          "& .MuiDataGrid-footerContainer": {
            borderColor: colors.border.light,
            backgroundColor: colors.background.header,
          },
          "& .MuiDataGrid-toolbarContainer": {
            padding: 1,
            "& .MuiButton-root": {
              color: colors.primary.main,
            },
          },
          // Color de hover para las filas
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "rgba(0, 240, 255, 0.04)",
          },
        }}
      />
    </Box>
  );
}
