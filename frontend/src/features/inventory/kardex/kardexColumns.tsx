import { Chip, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { colors } from "../../../theme/colors";
import { formatDateTime, formatNumber } from "../utils/inventoryFormatters";

export function buildKardexColumns(): GridColDef[] {
  return [
    {
      field: "created_at",
      headerName: "Fecha",
      width: 160,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_modelo",
      headerName: "Modelo",
      minWidth: 190,
      flex: 0.8,
    },
    {
      field: "producto_categoria",
      headerName: "Categoría",
      minWidth: 160,
      flex: 0.7,
    },
    {
      field: "producto_codigo_sap",
      headerName: "Código SAP",
      minWidth: 145,
      flex: 0.6,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "movement_type_display",
      headerName: "Movimiento",
      minWidth: 190,
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          label={String(params.value || "Movimiento")}
          size="small"
          sx={{
            color: colors.primary.main,
            bgcolor: colors.primary.soft,
            borderColor: colors.primary.border,
            border: "1px solid",
            fontWeight: 800,
          }}
        />
      ),
    },
    {
      field: "origin_display",
      headerName: "Origen",
      width: 135,
    },
    {
      field: "cantidad",
      headerName: "Cantidad",
      width: 120,
      type: "number",
      renderCell: (params) => {
        const value = Number(params.value || 0);

        return (
          <Typography
            sx={{
              color: value >= 0 ? colors.status.success : colors.status.error,
              fontWeight: 900,
            }}
          >
            {value > 0 ? `+${formatNumber(value)}` : formatNumber(value)}
          </Typography>
        );
      },
    },
    {
      field: "stock_antes",
      headerName: "Stock antes",
      width: 130,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_despues",
      headerName: "Stock después",
      width: 145,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "operador_nombre",
      headerName: "Operador",
      minWidth: 160,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin operador",
    },
    {
      field: "motivo",
      headerName: "Motivo",
      minWidth: 260,
      flex: 1.2,
    },
  ];
}
