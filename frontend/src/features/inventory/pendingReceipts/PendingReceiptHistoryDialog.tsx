import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type {
  PendingReceipt,
  PendingReceiptOperation,
} from "../../../services/inventoryService";
import { formatDateTime, formatNumber } from "../utils/inventoryFormatters";

type PendingReceiptHistoryDialogProps = {
  open: boolean;
  pendingReceipt: PendingReceipt | null;
  operations: PendingReceiptOperation[];
  loading: boolean;
  errorMessage: string;
  onClose: () => void;
};

export function PendingReceiptHistoryDialog({
  open,
  pendingReceipt,
  operations,
  loading,
  errorMessage,
  onClose,
}: PendingReceiptHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Historial del pendiente por recibir</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {pendingReceipt ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={0.5}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {pendingReceipt.producto_modelo}
                </Typography>
                <Typography color="text.secondary">
                  Código SAP: {pendingReceipt.producto_codigo_sap || "Sin código"}
                  {" · "}Categoría: {pendingReceipt.producto_categoria}
                </Typography>
                <Typography color="text.secondary">
                  Ubicación de recepción:{" "}
                  {pendingReceipt.ubicacion_destino_nombre ||
                    "Sin ubicación registrada"}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography>
                  {pendingReceipt.created_by_nombre || "El sistema"} registró{" "}
                  {formatNumber(pendingReceipt.cantidad_original)} unidades por
                  recibir el {formatDateTime(pendingReceipt.created_at)}.
                </Typography>
                <Typography color="text.secondary">
                  Referencia: {pendingReceipt.referencia || "Sin referencia"}.
                  Motivo: {pendingReceipt.motivo || "Sin motivo adicional"}.
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          {errorMessage ? (
            <Alert severity="error" variant="outlined">
              {errorMessage}
            </Alert>
          ) : null}

          {loading ? (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center" }}
            >
              <CircularProgress size={22} />
              <Typography>Cargando historial...</Typography>
            </Stack>
          ) : null}

          {!loading && !errorMessage && operations.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Este pendiente todavía no tiene recepciones ni cancelaciones.
            </Alert>
          ) : null}

          {!loading
            ? operations.map((operation) => (
                <Paper key={operation.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={0.75}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{ justifyContent: "space-between", gap: 0.5 }}
                    >
                      <Typography sx={{ fontWeight: 900 }}>
                        {operation.responsible_name}{" "}
                        {operation.operation_type === "RECEIVE"
                          ? "recibió"
                          : "canceló"}{" "}
                        {formatNumber(operation.quantity)} unidades
                      </Typography>
                      <Typography color="text.secondary">
                        {formatDateTime(operation.occurred_at)}
                      </Typography>
                    </Stack>

                    <Typography>
                      El saldo pendiente cambió de{" "}
                      {formatNumber(operation.pending_before)} a{" "}
                      {formatNumber(operation.pending_after)} unidades. El
                      estado pasó de “{operation.previous_state_display}” a “
                      {operation.new_state_display}”.
                    </Typography>

                    <Typography color="text.secondary">
                      Motivo: {operation.reason}
                    </Typography>

                    {operation.kardex_movement ? (
                      <Typography color="text.secondary">
                        La recepción creó el movimiento Kardex interno N.º{" "}
                        {operation.kardex_movement}.
                      </Typography>
                    ) : null}

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Producto conservado en el historial:{" "}
                        {operation.product_model_snapshot} · SAP{" "}
                        {operation.product_sap_code_snapshot || "sin código"} ·{" "}
                        {operation.product_category_snapshot} ·{" "}
                        {operation.destination_location_snapshot}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))
            : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
