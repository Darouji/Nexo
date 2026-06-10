import { useEffect, useState } from "react";
import { Box, Typography, Chip } from "@mui/material";
import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { colors } from "../theme/colors";

export function ProductsPage() {
  const [productos, setProductos] = useState<GridValidRowModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setProductos([
        {
          id: 1,
          categoria_name: "Filtros",
          modelo: "Filtro Aceite CAT",
          stock: 15,
          status: "EN_USO",
        },
        {
          id: 2,
          categoria_name: "Neumáticos",
          modelo: "Michelin 29.5R25",
          stock: 4,
          status: "EN_REPOSICION",
        },
        {
          id: 3,
          categoria_name: "Correas",
          modelo: "Correa Alternador 8PK",
          stock: 0,
          status: "DESCONTINUADO",
        },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const columns: GridColDef[] = [
    { field: "categoria_name", headerName: "Categoría", width: 180 },
    { field: "modelo", headerName: "Modelo", flex: 1, minWidth: 200 },
    { field: "stock", headerName: "Stock", width: 100, type: "number" },
    {
      field: "status",
      headerName: "Estado Operativo",
      width: 180,
      renderCell: (params) => {
        const status = params.value as string;

        // Aplicación del semáforo de colores centralizado
        let color = colors.status.info;
        if (status === "EN_USO") color = colors.status.success;
        if (status === "DESCONTINUADO") color = colors.status.error;
        if (status === "EN_REPOSICION") color = colors.status.warning;

        return (
          <Chip
            label={status.replace("_", " ")}
            size="small"
            sx={{
              bgcolor: `${color}15`, // Fondo translúcido
              color: color,
              borderColor: color,
              fontWeight: 700,
              border: "1px solid",
              borderRadius: 1,
            }}
          />
        );
      },
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography
          variant="h4"
          sx={{ color: colors.text.primary, fontWeight: 800 }}
        >
          Inventario de Productos
        </Typography>
        <Typography variant="body2" sx={{ color: colors.text.secondary }}>
          Gestión centralizada del Kardex y control de stock en tiempo real.
        </Typography>
      </Box>

      <SmartDataGrid rows={productos} columns={columns} loading={loading} />
    </Box>
  );
}
