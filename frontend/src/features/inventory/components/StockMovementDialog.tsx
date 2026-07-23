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

type StockMovementMode = "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";

type StockMovementDialogProps = {
  open: boolean;
  mode: StockMovementMode;
  product: Product | null;
  cantidad: string;
  motivo: string;
  ubicacion: string;
  locations: InventoryLocation[];
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
  saving,
  onCantidadChange,
  onMotivoChange,
  onUbicacionChange,
  onClose,
  onConfirm,
}: StockMovementDialogProps) {
  const isManualEntry = mode === "ENTRADA_MANUAL";

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
            label="Ubicación física"
            select
            value={ubicacion}
            onChange={(event) => onUbicacionChange(event.target.value)}
            fullWidth
            required
            helperText="El movimiento actualizará el saldo de esta ubicación."
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
            helperText={
              isManualEntry
                ? "La entrada manual debe ser una cantidad positiva."
                : "Usa números positivos para sumar stock o negativos para restar stock."
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
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={saving || !cantidad || !motivo.trim() || !ubicacion}
        >
          {saving ? "Guardando..." : "Registrar Kardex"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
