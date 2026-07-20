import { Chip, Stack, Typography } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import type { KardexMovement } from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";
import { formatDateTime, formatNumber } from "../utils/inventoryFormatters";

const numericCellStyle = {
  textAlign: "right" as const,
  fontVariantNumeric: "tabular-nums",
};

export function buildGlobalKardexColumns(): ColDef<KardexMovement>[] {
  return [
    {
      field: "created_at",
      colId: "created_at",
      headerName: "Fecha",
      width: 175,
      valueFormatter: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_modelo",
      colId: "producto_modelo_orden",
      headerName: "Producto / Modelo",
      minWidth: 220,
      flex: 1,
      valueFormatter: (params) =>
        String(params.value || "Sin producto / modelo"),
    },
    {
      field: "producto_categoria",
      colId: "producto_categoria_orden",
      headerName: "Categoría",
      minWidth: 170,
      flex: 0.75,
      valueFormatter: (params) => String(params.value || "Sin categoría"),
    },
    {
      field: "producto_codigo_sap",
      colId: "producto_codigo_sap_orden",
      headerName: "Código SAP",
      minWidth: 155,
      flex: 0.65,
      valueFormatter: (params) => String(params.value || "Sin código"),
    },
    {
      field: "movement_type_display",
      colId: "movement_type",
      headerName: "Movimiento",
      minWidth: 195,
      flex: 0.9,
      cellRenderer: (params: ICellRendererParams<KardexMovement, string>) => (
        <Stack
          sx={{
            height: "100%",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
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
        </Stack>
      ),
    },
    {
      field: "origin_display",
      colId: "origin",
      headerName: "Origen",
      width: 145,
      valueFormatter: (params) => String(params.value || "Sin origen"),
    },
    {
      field: "cantidad",
      colId: "cantidad",
      headerName: "Cantidad",
      width: 125,
      cellStyle: numericCellStyle,
      cellRenderer: (params: ICellRendererParams<KardexMovement, number>) => {
        const value = Number(params.value || 0);

        return (
          <Stack
            sx={{
              height: "100%",
              justifyContent: "center",
              alignItems: "flex-end",
            }}
          >
            <Typography
              component="span"
              sx={{
                color: value >= 0 ? colors.status.success : colors.status.error,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value > 0 ? `+${formatNumber(value)}` : formatNumber(value)}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "stock_antes",
      colId: "stock_antes",
      headerName: "Stock antes",
      width: 135,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_despues",
      colId: "stock_despues",
      headerName: "Stock después",
      width: 150,
      cellStyle: numericCellStyle,
      cellRenderer: (params: ICellRendererParams<KardexMovement, number>) => (
        <Stack
          sx={{
            height: "100%",
            justifyContent: "center",
            alignItems: "flex-end",
          }}
        >
          <Typography
            component="span"
            sx={{
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatNumber(Number(params.value || 0))}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "operador_nombre",
      colId: "operador_nombre",
      headerName: "Operador",
      minWidth: 170,
      flex: 0.8,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin operador"),
    },
    {
      field: "motivo",
      colId: "motivo",
      headerName: "Motivo",
      minWidth: 270,
      flex: 1.2,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin motivo"),
    },
  ];
}
