import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { Category, Product } from "../../../services/inventoryService";

type ProductCategoryChangeDialogProps = {
  open: boolean;
  product: Product | null;
  destinationCategory: Category | null;
  availableCategories: Category[];
  motivo: string;
  saving: boolean;
  onDestinationCategoryChange: (category: Category | null) => void;
  onMotivoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProductCategoryChangeDialog({
  open,
  product,
  destinationCategory,
  availableCategories,
  motivo,
  saving,
  onDestinationCategoryChange,
  onMotivoChange,
  onClose,
  onConfirm,
}: ProductCategoryChangeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cambiar categoría del producto</DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert severity="info" variant="outlined">
            Esta acción reclasifica el producto en una nueva categoría
            disponible. El cambio queda registrado en auditoría y no modifica el
            Kardex histórico.
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
            label="Categoría actual"
            value={product?.categoria_name || ""}
            fullWidth
            disabled
          />

          <Autocomplete
            options={availableCategories}
            value={destinationCategory}
            onChange={(_event, nextCategory) =>
              onDestinationCategoryChange(nextCategory)
            }
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            noOptionsText="No hay categorías disponibles"
            renderInput={(params) => (
              <TextField
                {...params}
                label="Nueva categoría"
                required
                helperText="Solo se muestran categorías activas y disponibles."
              />
            )}
          />

          {destinationCategory ? (
            <Alert severity="warning" variant="outlined">
              Revise que la categoría destino sea correcta. Si en la categoría
              destino ya existe un producto con el mismo modelo, el backend
              bloqueará la reclasificación para evitar duplicados.
            </Alert>
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
            saving || !product || !destinationCategory || !motivo.trim()
          }
        >
          {saving ? "Guardando..." : "Cambiar categoría"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
