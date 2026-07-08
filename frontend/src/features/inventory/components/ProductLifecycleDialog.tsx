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
  Product,
  ProductLifecycleAction,
} from "../../../services/inventoryService";

type ProductLifecycleDialogProps = {
  open: boolean;
  product: Product | null;
  action: ProductLifecycleAction | null;
  motivo: string;
  saving: boolean;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

function getProductLifecycleActionLabel(action: ProductLifecycleAction) {
  const labels: Record<ProductLifecycleAction, string> = {
    INACTIVAR: "Inactivar",
    ARCHIVAR: "Archivar",
    REACTIVAR: "Reactivar",
    DESCONTINUAR: "Descontinuar",
    REANUDAR: "Reanudar",
  };

  return labels[action];
}

function getProductLifecycleAlertMessage(
  action: ProductLifecycleAction | null,
) {
  if (action === "DESCONTINUAR") {
    return "El producto dejará de aceptar nuevas entradas manuales, importaciones y nuevas unidades por recibir. Su Kardex e historial se conservarán.";
  }

  if (action === "REANUDAR") {
    return "El producto volverá a estar disponible para nuevas operaciones de inventario.";
  }

  if (action === "INACTIVAR") {
    return "El producto dejará de estar disponible para operaciones. Solo puede inactivarse sin stock físico ni unidades pendientes.";
  }

  if (action === "ARCHIVAR") {
    return "El producto quedará fuera del catálogo operativo, manteniendo su historial disponible para auditoría.";
  }

  return "El producto volverá a estar activo y disponible para operaciones de inventario.";
}

export function ProductLifecycleDialog({
  open,
  product,
  action,
  motivo,
  saving,
  onMotivoChange,
  onClose,
  onConfirm,
}: ProductLifecycleDialogProps) {
  const actionLabel = action ? getProductLifecycleActionLabel(action) : null;
  const isDestructiveAction = action === "ARCHIVAR" || action === "INACTIVAR";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{actionLabel ?? "Gestionar producto"}</DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert
            severity={isDestructiveAction ? "warning" : "info"}
            variant="outlined"
          >
            {getProductLifecycleAlertMessage(action)}
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
            label="Motivo"
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
          disabled={saving || !product || !action || !motivo.trim()}
        >
          {saving ? "Procesando..." : (actionLabel ?? "Confirmar")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
