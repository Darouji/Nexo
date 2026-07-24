import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type {
  InventoryLocation,
  Product,
} from "../../../services/inventoryService";
import { useState } from "react";

type StockMovementMode = "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";

type StockMovementDialogProps = {
  open: boolean;
  mode: StockMovementMode;
  product: Product | null;
  cantidad: string;
  motivo: string;
  ubicacion: string;
  locations: InventoryLocation[];
  locationsLoading: boolean;
  errorMessage: string;
  fieldErrors: Record<string, string>;
  saving: boolean;
  onCantidadChange: (value: string) => void;
  onMotivoChange: (value: string) => void;
  onUbicacionChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function StockMovementDialog({
  open,
  mode,
  product,
  cantidad,
  motivo,
  ubicacion,
  locations,
  locationsLoading,
  errorMessage,
  fieldErrors,
  saving,
  onCantidadChange,
  onMotivoChange,
  onUbicacionChange,
  onClose,
  onConfirm,
}: StockMovementDialogProps) {
  const isManualEntry = mode === "ENTRADA_MANUAL";
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const parsedQuantity = Number(cantidad);
  const locationIsMissing = !ubicacion;
  const quantityIsInvalid =
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity === 0 ||
    (isManualEntry && parsedQuantity < 0);
  const reasonIsMissing = !motivo.trim();
  const hasBlockingErrors =
    locationIsMissing || quantityIsInvalid || reasonIsMissing;

  const handleConfirm = () => {
    setSubmitAttempted(true);
    if (!hasBlockingErrors) {
      onConfirm();
    }
  };

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

          {errorMessage ? (
            <Alert severity="error" variant="outlined">
              {errorMessage}
            </Alert>
          ) : null}

          {(submitAttempted && hasBlockingErrors) ||
          Object.keys(fieldErrors).length > 0 ? (
            <Alert severity="warning" variant="outlined">
              Revisa los campos marcados antes de registrar el movimiento.
            </Alert>
          ) : null}

          <TextField
            label="Producto"
            value={product?.modelo || ""}
            fullWidth
            disabled
          />

          <TextField
            label="Ubicación física"
            select
            value={ubicacion}
            onChange={(event) => onUbicacionChange(event.target.value)}
            fullWidth
            required
            disabled={locationsLoading}
            error={
              (submitAttempted && locationIsMissing) ||
              Boolean(fieldErrors.ubicacion)
            }
            helperText={
              fieldErrors.ubicacion ||
              (locationsLoading
                ? "Cargando ubicaciones válidas para este producto..."
                : submitAttempted && locationIsMissing
                  ? "Debe seleccionar una ubicación válida."
                  : !isManualEntry && locations.length === 0
                    ? "Este producto no tiene stock disponible en ninguna ubicación."
                    : isManualEntry
                      ? "La entrada aumentará el saldo de esta ubicación."
                      : "Solo se muestran ubicaciones donde este producto tiene stock.")
            }
          >
            {locations.map((location) => (
              <MenuItem key={location.id} value={String(location.id)}>
                {location.name} — {location.location_type_display}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={
              isManualEntry ? "Cantidad a ingresar" : "Cantidad del ajuste"
            }
            type="number"
            value={cantidad}
            onChange={(event) => onCantidadChange(event.target.value)}
            fullWidth
            required
            error={
              (submitAttempted && quantityIsInvalid) ||
              Boolean(fieldErrors.cantidad || fieldErrors.stock)
            }
            helperText={
              fieldErrors.cantidad ||
              fieldErrors.stock ||
              (submitAttempted && quantityIsInvalid
                ? isManualEntry
                  ? "Debe ingresar un número entero mayor que cero."
                  : "Debe ingresar un número entero distinto de cero."
                : isManualEntry
                ? "La entrada manual debe ser una cantidad positiva."
                : "Usa números positivos para sumar stock o negativos para restar stock.")
            }
          />

          <TextField
            label="Motivo"
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            error={
              (submitAttempted && reasonIsMissing) ||
              Boolean(fieldErrors.motivo)
            }
            helperText={
              fieldErrors.motivo ||
              (submitAttempted && reasonIsMissing
                ? "El motivo es obligatorio para mantener la trazabilidad."
                : "El motivo quedará registrado en Kardex y auditoría.")
            }
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>

        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={
            saving ||
            locationsLoading ||
            (!isManualEntry && locations.length === 0)
          }
        >
          {saving ? "Guardando..." : "Registrar Kardex"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
