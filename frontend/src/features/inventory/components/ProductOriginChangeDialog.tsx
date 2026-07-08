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
  Product,
  ProductOrigin,
} from "../../../services/inventoryService";
import {
  getProductOriginLabel,
  productOriginLabels,
} from "../products/productFormModel";

type ProductOriginChangeDialogProps = {
  open: boolean;
  product: Product | null;
  origin: ProductOrigin;
  originObservation: string;
  motivo: string;
  saving: boolean;
  onOriginChange: (value: ProductOrigin) => void;
  onOriginObservationChange: (value: string) => void;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

const productOriginOptions: Array<{
  value: ProductOrigin;
  label: string;
}> = [
  { value: "COMPRADO", label: productOriginLabels.COMPRADO },
  { value: "FABRICADO", label: productOriginLabels.FABRICADO },
  { value: "SERVICIO", label: productOriginLabels.SERVICIO },
  { value: "OTRO", label: productOriginLabels.OTRO },
];

export function ProductOriginChangeDialog({
  open,
  product,
  origin,
  originObservation,
  motivo,
  saving,
  onOriginChange,
  onOriginObservationChange,
  onMotivoChange,
  onClose,
  onConfirm,
}: ProductOriginChangeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cambiar origen del producto</DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert severity="info" variant="outlined">
            Esta acción cambia el origen del producto y queda registrada en
            auditoría. No modifica el Kardex histórico ni borra movimientos.
          </Alert>

          <TextField
            label="Producto"
            value={
              product ? `${product.categoria_name} — ${product.modelo}` : ""
            }
            fullWidth
            disabled
          />

          <TextField
            label="Origen actual"
            value={product ? getProductOriginLabel(product.origen) : ""}
            fullWidth
            disabled
          />

          <TextField
            select
            label="Nuevo origen"
            value={origin}
            onChange={(event) =>
              onOriginChange(event.target.value as ProductOrigin)
            }
            fullWidth
            required
          >
            {productOriginOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {origin === "SERVICIO" ? (
            <Alert severity="warning" variant="outlined">
              Un servicio no puede manejar stock físico, stock mínimo, Kardex ni
              pendientes por recibir. El backend bloqueará el cambio si el
              producto ya tiene historial incompatible.
            </Alert>
          ) : null}

          {origin === "OTRO" ? (
            <TextField
              label="Detalle del origen"
              value={originObservation}
              onChange={(event) =>
                onOriginObservationChange(event.target.value)
              }
              fullWidth
              required
              helperText="Explique por qué este producto no corresponde a Comprado, Fabricado o Servicio."
            />
          ) : null}

          <TextField
            label="Motivo del cambio"
            value={motivo}
            onChange={(event) => onMotivoChange(event.target.value)}
            fullWidth
            required
            multiline
            minRows={3}
            helperText="Este motivo quedará asociado a la auditoría del producto."
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={
            saving ||
            !product ||
            !motivo.trim() ||
            (origin === "OTRO" && !originObservation.trim())
          }
        >
          {saving ? "Guardando..." : "Cambiar origen"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
