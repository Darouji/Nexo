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
import type { Product } from "../../../services/inventoryService";
import { isIntegerInput, parseInteger } from "../utils/inventoryFormatters";

type StockMovementMode = "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";

type StockMovementDialogProps = {
  open: boolean;
  mode: StockMovementMode;
  product: Product | null;
  cantidad: string;
  motivo: string;
  saving: boolean;
  onCantidadChange: (value: string) => void;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function StockMovementDialog({
  open,
  mode,
  product,
  cantidad,
  motivo,
  saving,
  onCantidadChange,
  onMotivoChange,
  onClose,
  onConfirm,
}: StockMovementDialogProps) {
  const isManualEntry = mode === "ENTRADA_MANUAL";
  const cleanCantidad = cantidad.trim();
  const parsedCantidad = parseInteger(cleanCantidad);
  const cantidadHasValue = cleanCantidad.length > 0;
  const cantidadHasIntegerFormat = cantidadHasValue && isIntegerInput(cleanCantidad);
  const cantidadIsInvalid =
    !cantidadHasIntegerFormat ||
    (isManualEntry ? parsedCantidad <= 0 : parsedCantidad === 0);
  const motivoIsMissing = !motivo.trim();
  const confirmIsDisabled =
    saving || !product || cantidadIsInvalid || motivoIsMissing;

  const cantidadHelperText = !cantidadHasValue
    ? isManualEntry
      ? "La entrada manual debe ser un entero positivo."
      : "Usa enteros positivos para sumar stock o negativos para restar stock."
    : !cantidadHasIntegerFormat
      ? "Ingresa un número entero, sin decimales ni separadores."
      : isManualEntry && parsedCantidad <= 0
        ? "La entrada manual debe ser mayor que cero."
        : !isManualEntry && parsedCantidad === 0
          ? "El ajuste no puede ser cero."
          : isManualEntry
            ? "Cantidad válida para una entrada manual auditada."
            : "Cantidad válida para un ajuste Kardex auditado.";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isManualEntry ? "Entrada manual de stock" : "Ajuste de inventario"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert severity="info" variant="outlined">
            El stock no se edita directamente. Esta acción creará un movimiento
            Kardex auditado en backend.
          </Alert>

          <TextField
            label="Producto"
            value={product?.modelo || ""}
            fullWidth
            disabled
          />

          <TextField
            label={
              isManualEntry ? "Cantidad a ingresar" : "Cantidad del ajuste"
            }
            type="number"
            value={cantidad}
            onChange={(event) => onCantidadChange(event.target.value)}
            fullWidth
            required
            error={cantidadHasValue && cantidadIsInvalid}
            helperText={cantidadHelperText}
          />

          <TextField
            label="Motivo"
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            error={motivoIsMissing && Boolean(cantidad)}
            helperText="Obligatorio para auditoría y trazabilidad del Kardex."
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={confirmIsDisabled}
        >
          {saving ? "Guardando..." : "Registrar Kardex"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
