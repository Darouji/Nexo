import type { Dispatch, SetStateAction } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type {
  Category,
  Product,
  ProductOrigin,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";
import {
  findCategoryByInputName,
  getProductOriginLabel,
  productOriginLabels,
  type ProductFormState,
} from "./productFormModel";

type ProductDialogProps = {
  open: boolean;
  editingProduct: Product | null;
  productForm: ProductFormState;
  categories: Category[];
  savingProduct: boolean;
  onFormChange: Dispatch<SetStateAction<ProductFormState>>;
  onClose: () => void;
  onSave: () => void | Promise<void>;
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

export function ProductDialog({
  open,
  editingProduct,
  productForm,
  categories,
  savingProduct,
  onFormChange,
  onClose,
  onSave,
}: ProductDialogProps) {
  const availableCategoriesForProducts = categories.filter(
    (category) => category.is_available_for_products,
  );

  const productCategoryMatch = findCategoryByInputName(
    categories,
    productForm.categoria_name,
  );

  const productCategoryIsUnavailable = Boolean(
    !editingProduct &&
    productCategoryMatch &&
    !productCategoryMatch.is_available_for_products,
  );

  const updateFormField = <Field extends keyof ProductFormState>(
    field: Field,
    value: ProductFormState[Field],
  ) => {
    onFormChange((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleOriginChange = (nextOrigin: ProductOrigin) => {
    onFormChange((current) => ({
      ...current,
      origen: nextOrigin,
      origen_observacion:
        nextOrigin === "OTRO" ? current.origen_observacion : "",
      controla_stock:
        nextOrigin === "SERVICIO" ? false : current.controla_stock,
      stock_critico: nextOrigin === "SERVICIO" ? "0" : current.stock_critico,
      initial_stock: nextOrigin === "SERVICIO" ? "0" : current.initial_stock,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {editingProduct ? "Editar producto" : "Nuevo producto"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Autocomplete<Category, false, false, true>
            freeSolo
            disabled={Boolean(editingProduct)}
            options={availableCategoriesForProducts}
            inputValue={productForm.categoria_name}
            onInputChange={(_event, newInputValue) =>
              updateFormField("categoria_name", newInputValue)
            }
            onChange={(_event, newValue) =>
              updateFormField(
                "categoria_name",
                typeof newValue === "string"
                  ? newValue
                  : newValue?.name || productForm.categoria_name,
              )
            }
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.name
            }
            renderInput={(params) => {
              const categoryName = productForm.categoria_name.trim();

              const helperText = !categoryName
                ? "Escribe una categoría. Si ya existe, se reutilizará."
                : !productCategoryMatch
                  ? `Se creará la nueva categoría "${categoryName}" al guardar junto con el producto.`
                  : productCategoryMatch.is_available_for_products
                    ? `Se reutilizará la categoría existente "${productCategoryMatch.name}".`
                    : `La categoría "${productCategoryMatch.name}" es histórica o fue fusionada y no puede utilizarse.`;

              const helperColor = !categoryName
                ? colors.text.muted
                : !productCategoryMatch
                  ? colors.status.warning
                  : productCategoryMatch.is_available_for_products
                    ? colors.status.success
                    : colors.status.error;

              return (
                <TextField
                  {...params}
                  label="Categoría"
                  required
                  helperText={helperText}
                  sx={{
                    "& .MuiFormHelperText-root": {
                      color: helperColor,
                      fontWeight: categoryName ? 800 : 500,
                    },
                  }}
                />
              );
            }}
          />

          {editingProduct ? (
            <Stack spacing={1.5}>
              <TextField
                label="Origen del producto"
                value={getProductOriginLabel(productForm.origen)}
                fullWidth
                disabled
                helperText="El origen se modifica únicamente mediante una acción controlada y auditada."
              />

              {productForm.origen === "OTRO" ? (
                <TextField
                  label="Detalle del origen"
                  value={productForm.origen_observacion}
                  fullWidth
                  disabled
                />
              ) : null}
            </Stack>
          ) : (
            <>
              <TextField
                select
                label="Origen del producto"
                value={productForm.origen}
                onChange={(event) =>
                  handleOriginChange(event.target.value as ProductOrigin)
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

              {productForm.origen === "OTRO" ? (
                <TextField
                  label="Detalle del origen"
                  value={productForm.origen_observacion}
                  onChange={(event) =>
                    updateFormField("origen_observacion", event.target.value)
                  }
                  fullWidth
                  required
                  helperText="Explique por qué este producto no corresponde a Comprado, Fabricado o Servicio."
                />
              ) : null}

              {productForm.origen === "SERVICIO" ? (
                <Alert severity="info" variant="outlined">
                  Un producto de tipo Servicio no puede manejar stock físico,
                  stock mínimo ni unidades por recibir.
                </Alert>
              ) : null}
            </>
          )}

          <TextField
            label="Modelo"
            value={productForm.modelo}
            onChange={(event) => updateFormField("modelo", event.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Código SAP"
            value={productForm.codigo_sap}
            onChange={(event) =>
              updateFormField("codigo_sap", event.target.value)
            }
            fullWidth
          />

          <TextField
            label="Detalle"
            value={productForm.detalle}
            onChange={(event) => updateFormField("detalle", event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          <TextField
            label="Stock mínimo"
            type="number"
            value={productForm.stock_critico}
            onChange={(event) =>
              updateFormField("stock_critico", event.target.value)
            }
            fullWidth
            disabled={productForm.origen === "SERVICIO"}
            helperText={
              productForm.origen === "SERVICIO"
                ? "Los servicios no manejan stock mínimo."
                : undefined
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={productForm.controla_stock}
                disabled={productForm.origen === "SERVICIO"}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    controla_stock: event.target.checked,
                    initial_stock: event.target.checked
                      ? current.initial_stock
                      : "0",
                  }))
                }
              />
            }
            label="Este producto maneja inventario y genera Kardex"
          />

          {productForm.controla_stock && !editingProduct ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Stock inicial"
                type="number"
                value={productForm.initial_stock}
                onChange={(event) =>
                  updateFormField("initial_stock", event.target.value)
                }
                fullWidth
                helperText="Se registrará en la misma operación de creación mediante una entrada Kardex auditada."
              />

              <TextField
                label="Motivo stock inicial"
                value={productForm.initial_stock_motivo}
                onChange={(event) =>
                  updateFormField("initial_stock_motivo", event.target.value)
                }
                fullWidth
              />
            </Stack>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>

        <Button
          variant="contained"
          onClick={() => void onSave()}
          disabled={
            savingProduct ||
            !productForm.categoria_name.trim() ||
            !productForm.modelo.trim() ||
            productCategoryIsUnavailable ||
            (!editingProduct &&
              productForm.origen === "OTRO" &&
              !productForm.origen_observacion.trim())
          }
        >
          {savingProduct
            ? "Guardando..."
            : editingProduct
              ? "Guardar cambios"
              : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
