import { formatDateTime, formatNumber } from "../utils/inventoryFormatters";
import { Button, Chip, Stack, Typography } from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import DeleteIcon from "@mui/icons-material/Delete";
import type { GridColDef } from "@mui/x-data-grid";
import type {
  PendingReceipt,
  PendingReceiptStatus,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

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

export function buildPendingReceiptColumns({
  onOpenPendingReceiptOperationDialog,
}: PendingReceiptColumnsOptions): GridColDef[] {
  return [
    {
      field: "created_at",
      headerName: "Registrado",
      width: 160,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_categoria",
      headerName: "Categoría",
      minWidth: 150,
      flex: 0.7,
    },
    {
      field: "producto_modelo",
      headerName: "Producto",
      minWidth: 210,
      flex: 1,
    },
    {
      field: "producto_codigo_sap",
      headerName: "Código SAP",
      minWidth: 145,
      flex: 0.6,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "cantidad_original",
      headerName: "Original",
      width: 105,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_recibida",
      headerName: "Recibida",
      width: 110,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_cancelada",
      headerName: "Cancelada",
      width: 115,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_pendiente",
      headerName: "Pendiente",
      width: 115,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 155,
      renderCell: (params) => {
        const pendingReceipt = params.row as PendingReceipt;
        const color = getPendingReceiptStatusColor(pendingReceipt.estado);

        return (
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
        );
      },
    },
    {
      field: "referencia",
      headerName: "OC / referencia",
      minWidth: 170,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin referencia",
    },
    {
      field: "motivo",
      headerName: "Motivo",
      minWidth: 250,
      flex: 1.2,
      renderCell: (params) => params.value || "Sin motivo",
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 240,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const pendingReceipt = params.row as PendingReceipt;

        const canOperate =
          pendingReceipt.cantidad_pendiente > 0 &&
          (pendingReceipt.estado === "PENDIENTE" ||
            pendingReceipt.estado === "PARCIAL");

        return (
          <Stack direction="row" spacing={1}>
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
