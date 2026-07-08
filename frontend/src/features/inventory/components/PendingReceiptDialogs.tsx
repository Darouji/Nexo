import {
  formatNumber,
  isIntegerInput,
  parseInteger,
} from "../utils/inventoryFormatters";
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

  const cleanCreateCantidad = createCantidad.trim();
  const createCantidadHasValue = cleanCreateCantidad.length > 0;
  const createCantidadHasIntegerFormat =
    createCantidadHasValue && isIntegerInput(cleanCreateCantidad);
  const parsedCreateCantidad = parseInteger(cleanCreateCantidad);
  const createCantidadIsInvalid =
    !createCantidadHasIntegerFormat || parsedCreateCantidad <= 0;
  const createHasReferenceOrReason =
    Boolean(createReferencia.trim()) || Boolean(createMotivo.trim());
  const createConfirmIsDisabled =
    saving ||
    !createProduct ||
    createCantidadIsInvalid ||
    !createHasReferenceOrReason;

  const cleanOperationCantidad = operationCantidad.trim();
  const operationCantidadHasValue = cleanOperationCantidad.length > 0;
  const operationCantidadHasIntegerFormat =
    operationCantidadHasValue && isIntegerInput(cleanOperationCantidad);
  const parsedOperationCantidad = parseInteger(cleanOperationCantidad);
  const operationCantidadIsInvalid =
    !operationCantidadHasIntegerFormat ||
    parsedOperationCantidad <= 0 ||
    parsedOperationCantidad > pendingAvailable;
  const operationConfirmIsDisabled =
    saving ||
    !operationPendingReceipt ||
    operationCantidadIsInvalid ||
    !operationMotivo.trim();

  const createCantidadHelperText = !createCantidadHasValue
    ? "Debe ser un entero positivo."
    : !createCantidadHasIntegerFormat
      ? "Ingresa un número entero, sin decimales ni separadores."
      : parsedCreateCantidad <= 0
        ? "La cantidad por recibir debe ser mayor que cero."
        : "Cantidad válida. El stock físico no cambiará hasta confirmar la recepción.";

  const operationCantidadHelperText = !operationCantidadHasValue
    ? "Debe ser un entero positivo."
    : !operationCantidadHasIntegerFormat
      ? "Ingresa un número entero, sin decimales ni separadores."
      : parsedOperationCantidad <= 0
        ? "La cantidad debe ser mayor que cero."
        : parsedOperationCantidad > pendingAvailable
          ? `No puede superar las ${formatNumber(pendingAvailable)} unidades pendientes.`
          : operationMode === "RECIBIR"
            ? "Cantidad válida para recibir stock físico."
            : "Cantidad válida para cancelar unidades pendientes.";

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
                error={createCantidadHasValue && createCantidadIsInvalid}
                helperText={createCantidadHelperText}
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
              error={!createHasReferenceOrReason && createCantidadHasValue}
              helperText="Debe indicar una referencia o un motivo."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCreateClose}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={onCreateConfirm}
            disabled={createConfirmIsDisabled}
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
                error={operationCantidadHasValue && operationCantidadIsInvalid}
                helperText={operationCantidadHelperText}
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
              error={!operationMotivo.trim() && operationCantidadHasValue}
              helperText="Obligatorio para auditar la recepción o cancelación."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onOperationClose}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={onOperationConfirm}
            disabled={operationConfirmIsDisabled}
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
