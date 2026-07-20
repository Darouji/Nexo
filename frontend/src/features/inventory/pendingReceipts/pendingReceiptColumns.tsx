import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteIcon from "@mui/icons-material/Delete";
import { Button, Chip, Stack, Typography } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import type {
  PendingReceipt,
  PendingReceiptStatus,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";
import { formatDateTime, formatNumber } from "../utils/inventoryFormatters";

type PendingReceiptOperationMode = "RECIBIR" | "CANCELAR";

type PendingReceiptColumnsOptions = {
  onOpenPendingReceiptOperationDialog: (
    pendingReceipt: PendingReceipt,
    mode: PendingReceiptOperationMode,
  ) => void;
};

function getPendingReceiptStatusColor(status: PendingReceiptStatus) {
  if (status === "PENDIENTE") {
    return colors.status.warning;
  }

  if (status === "PARCIAL") {
    return colors.status.info;
  }

  if (status === "RECIBIDA") {
    return colors.status.success;
  }

  if (status === "CANCELADA") {
    return colors.status.error;
  }

  return colors.text.muted;
}

const numericCellStyle = {
  textAlign: "right" as const,
  fontVariantNumeric: "tabular-nums",
};

export function buildPendingReceiptColumns({
  onOpenPendingReceiptOperationDialog,
}: PendingReceiptColumnsOptions): ColDef<PendingReceipt>[] {
  return [
    {
      field: "created_at",
      colId: "created_at",
      headerName: "Registrado",
      width: 175,
      valueFormatter: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_categoria",
      colId: "producto_categoria",
      headerName: "Categoría",
      minWidth: 165,
      flex: 0.7,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin categoría"),
    },
    {
      field: "producto_modelo",
      colId: "producto_modelo",
      headerName: "Producto / Modelo",
      minWidth: 220,
      flex: 1,
      sortable: false,
      valueFormatter: (params) =>
        String(params.value || "Sin producto / modelo"),
    },
    {
      field: "producto_codigo_sap",
      colId: "producto_codigo_sap",
      headerName: "Código SAP",
      minWidth: 150,
      flex: 0.6,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin código"),
    },
    {
      field: "cantidad_original",
      colId: "cantidad_original",
      headerName: "Original",
      width: 115,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_recibida",
      colId: "cantidad_recibida",
      headerName: "Recibida",
      width: 120,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_cancelada",
      colId: "cantidad_cancelada",
      headerName: "Cancelada",
      width: 125,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_pendiente",
      colId: "cantidad_pendiente",
      headerName: "Pendiente",
      width: 125,
      sortable: false,
      cellStyle: numericCellStyle,
      cellRenderer: (params: ICellRendererParams<PendingReceipt, number>) => (
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
      field: "estado",
      colId: "estado",
      headerName: "Estado",
      width: 165,
      cellRenderer: (
        params: ICellRendererParams<PendingReceipt, PendingReceiptStatus>,
      ) => {
        const pendingReceipt = params.data;

        if (!pendingReceipt) {
          return null;
        }

        const color = getPendingReceiptStatusColor(pendingReceipt.estado);

        return (
          <Stack
            sx={{
              height: "100%",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <Chip
              label={pendingReceipt.estado_display}
              size="small"
              sx={{
                color,
                bgcolor: colors.surface.soft,
                borderColor: color,
                border: "1px solid",
                fontWeight: 800,
              }}
            />
          </Stack>
        );
      },
    },
    {
      field: "referencia",
      colId: "referencia",
      headerName: "OC / Referencia",
      minWidth: 180,
      flex: 0.8,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin referencia"),
    },
    {
      field: "motivo",
      colId: "motivo",
      headerName: "Motivo",
      minWidth: 260,
      flex: 1.2,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin motivo"),
    },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 260,
      minWidth: 260,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: (params: ICellRendererParams<PendingReceipt, unknown>) => {
        const pendingReceipt = params.data;

        if (!pendingReceipt) {
          return null;
        }

        const canOperate =
          pendingReceipt.cantidad_pendiente > 0 &&
          (pendingReceipt.estado === "PENDIENTE" ||
            pendingReceipt.estado === "PARCIAL");

        return (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              height: "100%",
              alignItems: "center",
            }}
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddBoxIcon />}
              disabled={!canOperate}
              onClick={() =>
                onOpenPendingReceiptOperationDialog(pendingReceipt, "RECIBIR")
              }
            >
              Recibir
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!canOperate}
              onClick={() =>
                onOpenPendingReceiptOperationDialog(pendingReceipt, "CANCELAR")
              }
              sx={{
                color: colors.status.error,
                borderColor: colors.status.error,
                "&:hover": {
                  bgcolor: colors.status.errorSoft,
                  borderColor: colors.status.error,
                },
              }}
            >
              Cancelar
            </Button>
          </Stack>
        );
      },
    },
  ];
}
