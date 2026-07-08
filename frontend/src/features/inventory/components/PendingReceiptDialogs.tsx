import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type {
  PendingReceipt,
  Product,
} from "../../../services/inventoryService";

type PendingReceiptOperationMode = "RECIBIR" | "CANCELAR";

type PendingReceiptDialogsProps = {
  createOpen: boolean;
  createProduct: Product | null;
  createCantidad: string;
  createReferencia: string;
  createMotivo: string;

  operationOpen: boolean;
  operationMode: PendingReceiptOperationMode;
  operationPendingReceipt: PendingReceipt | null;
  operationCantidad: string;
  operationMotivo: string;

  saving: boolean;

  onCreateCantidadChange: (value: string) => void;
  onCreateReferenciaChange: (value: string) => void;
  onCreateMotivoChange: (value: string) => void;
  onCreateClose: () => void;
  onCreateConfirm: () => void;

  onOperationCantidadChange: (value: string) => void;
  onOperationMotivoChange: (value: string) => void;
  onOperationClose: () => void;
  onOperationConfirm: () => void;
};

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
}

function parseInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function PendingReceiptDialogs({
  createOpen,
  createProduct,
  createCantidad,
  createReferencia,
  createMotivo,
  operationOpen,
  operationMode,
  operationPendingReceipt,
  operationCantidad,
  operationMotivo,
  saving,
  onCreateCantidadChange,
  onCreateReferenciaChange,
  onCreateMotivoChange,
  onCreateClose,
  onCreateConfirm,
  onOperationCantidadChange,
  onOperationMotivoChange,
  onOperationClose,
  onOperationConfirm,
}: PendingReceiptDialogsProps) {
  const pendingAvailable = operationPendingReceipt?.cantidad_pendiente ?? 0;

  return (
    <>
      <Dialog open={createOpen} onClose={onCreateClose} fullWidth maxWidth="sm">
        <DialogTitle>Registrar unidades por recibir</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Registrar unidades por recibir no modifica el stock físico ni crea
              Kardex. El stock cambia solamente al confirmar la recepción
              física.
            </Alert>

            <TextField
              label="Producto"
              value={
                createProduct
                  ? `${createProduct.categoria_name} — ${createProduct.modelo}`
                  : ""
              }
              fullWidth
              disabled
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Cantidad por recibir"
                type="number"
                value={createCantidad}
                onChange={(event) => onCreateCantidadChange(event.target.value)}
                fullWidth
                required
              />

              <TextField
                label="Orden de compra / referencia"
                value={createReferencia}
                onChange={(event) =>
                  onCreateReferenciaChange(event.target.value)
                }
                fullWidth
                placeholder="Ej.: OC-2026-001"
                helperText="Usa la OC o el identificador que explique el origen de este pendiente."
              />
            </Stack>

            <TextField
              label="Motivo"
              value={createMotivo}
              onChange={(event) => onCreateMotivoChange(event.target.value)}
              fullWidth
              multiline
              minRows={2}
              helperText="Debe indicar una referencia o un motivo."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCreateClose}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={onCreateConfirm}
            disabled={
              saving ||
              !createProduct ||
              parseInteger(createCantidad) <= 0 ||
              (!createReferencia.trim() && !createMotivo.trim())
            }
          >
            {saving ? "Registrando..." : "Registrar pendiente"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={operationOpen}
        onClose={onOperationClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {operationMode === "RECIBIR"
            ? "Recibir unidades pendientes"
            : "Cancelar unidades pendientes"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert
              severity={operationMode === "RECIBIR" ? "success" : "warning"}
              variant="outlined"
            >
              {operationMode === "RECIBIR"
                ? "Esta operación aumenta el stock físico y crea un movimiento Kardex auditado."
                : "Esta operación no modifica el stock físico ni crea un movimiento Kardex."}
            </Alert>

            <TextField
              label="Producto"
              value={
                operationPendingReceipt
                  ? `${operationPendingReceipt.producto_categoria} — ${operationPendingReceipt.producto_modelo}`
                  : ""
              }
              fullWidth
              disabled
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Pendiente disponible"
                value={formatNumber(pendingAvailable)}
                fullWidth
                disabled
              />

              <TextField
                label={
                  operationMode === "RECIBIR"
                    ? "Cantidad a recibir"
                    : "Cantidad a cancelar"
                }
                type="number"
                value={operationCantidad}
                onChange={(event) =>
                  onOperationCantidadChange(event.target.value)
                }
                fullWidth
                required
              />
            </Stack>

            <TextField
              label="Motivo"
              value={operationMotivo}
              onChange={(event) => onOperationMotivoChange(event.target.value)}
              fullWidth
              required
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onOperationClose}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={onOperationConfirm}
            disabled={
              saving ||
              !operationPendingReceipt ||
              parseInteger(operationCantidad) <= 0 ||
              parseInteger(operationCantidad) > pendingAvailable ||
              !operationMotivo.trim()
            }
          >
            {saving
              ? "Procesando..."
              : operationMode === "RECIBIR"
                ? "Confirmar recepción"
                : "Confirmar cancelación"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
