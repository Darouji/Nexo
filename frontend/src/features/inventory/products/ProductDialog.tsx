import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
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
import { fetchProductsPage } from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";
import {
  findCategoryByInputName,
  getProductOriginLabel,
  isForbiddenSapCode,
  normalizeProductComparisonValue,
  normalizeSapComparisonValue,
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

type DuplicateValidationState = {
  loading: boolean;
  duplicatedModelProduct: Product | null;
  duplicatedSapProduct: Product | null;
};

const initialDuplicateValidationState: DuplicateValidationState = {
  loading: false,
  duplicatedModelProduct: null,
  duplicatedSapProduct: null,
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

function isSameModel(product: Product, model: string) {
  const normalizedModel = normalizeProductComparisonValue(model);

  if (!normalizedModel) {
    return false;
  }

  const backendNormalizedModel =
    typeof product.modelo_normalized === "string"
      ? product.modelo_normalized
      : "";

  return (
    normalizeProductComparisonValue(product.modelo) === normalizedModel ||
    backendNormalizedModel === normalizedModel
  );
}

function isSameSapCode(product: Product, sapCode: string) {
  const normalizedSapCode = normalizeSapComparisonValue(sapCode);

  if (!normalizedSapCode) {
    return false;
  }

  const backendNormalizedSapCode =
    typeof product.codigo_sap_normalized === "string"
      ? product.codigo_sap_normalized
      : "";

  return (
    normalizeSapComparisonValue(product.codigo_sap) === normalizedSapCode ||
    backendNormalizedSapCode === normalizedSapCode
  );
}

function useProductDuplicateValidation({
  open,
  editingProduct,
  model,
  sapCode,
}: {
  open: boolean;
  editingProduct: Product | null;
  model: string;
  sapCode: string;
}) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<DuplicateValidationState>(
    initialDuplicateValidationState,
  );

  const cleanModel = model.trim();
  const cleanSapCode = sapCode.trim();

  const shouldCheckModel = cleanModel.length >= 3;
  const shouldCheckSapCode = cleanSapCode.length >= 2;
  const shouldValidate = open && (shouldCheckModel || shouldCheckSapCode);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!shouldValidate) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setState({
        loading: true,
        duplicatedModelProduct: null,
        duplicatedSapProduct: null,
      });

      Promise.all([
        shouldCheckModel
          ? fetchProductsPage({
              search: cleanModel,
              page: 1,
              page_size: 10,
            }).then((page) => page.results)
          : Promise.resolve([]),
        shouldCheckSapCode
          ? fetchProductsPage({
              search: cleanSapCode,
              page: 1,
              page_size: 10,
            }).then((page) => page.results)
          : Promise.resolve([]),
      ])
        .then(([modelResults, sapResults]) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          const duplicatedModelProduct =
            modelResults.find(
              (product) =>
                product.id !== editingProduct?.id &&
                isSameModel(product, cleanModel),
            ) ?? null;

          const duplicatedSapProduct =
            sapResults.find(
              (product) =>
                product.id !== editingProduct?.id &&
                isSameSapCode(product, cleanSapCode),
            ) ?? null;

          setState({
            loading: false,
            duplicatedModelProduct,
            duplicatedSapProduct,
          });
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setState({
            loading: false,
            duplicatedModelProduct: null,
            duplicatedSapProduct: null,
          });
        });
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    shouldValidate,
    shouldCheckModel,
    shouldCheckSapCode,
    cleanModel,
    cleanSapCode,
    editingProduct?.id,
  ]);

  const duplicatedModelProduct =
    shouldValidate &&
    shouldCheckModel &&
    state.duplicatedModelProduct &&
    isSameModel(state.duplicatedModelProduct, cleanModel)
      ? state.duplicatedModelProduct
      : null;

  const duplicatedSapProduct =
    shouldValidate &&
    shouldCheckSapCode &&
    state.duplicatedSapProduct &&
    isSameSapCode(state.duplicatedSapProduct, cleanSapCode)
      ? state.duplicatedSapProduct
      : null;

  return {
    loading: shouldValidate ? state.loading : false,
    duplicatedModelProduct,
    duplicatedSapProduct,
  };
}

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const duplicateValidation = useProductDuplicateValidation({
    open,
    editingProduct,
    model: productForm.modelo,
    sapCode: productForm.codigo_sap,
  });

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

  const categoryNameIsMissing = !productForm.categoria_name.trim();
  const modelIsMissing = !productForm.modelo.trim();
  const originObservationIsMissing =
    !editingProduct &&
    productForm.origen === "OTRO" &&
    !productForm.origen_observacion.trim();
  const sapCodeChanged = Boolean(
    editingProduct &&
    productForm.codigo_sap.trim() !==
      String(editingProduct.codigo_sap || "").trim(),
  );
  const sapChangeReasonIsMissing =
    sapCodeChanged && !productForm.codigo_sap_motivo.trim();
  const sapCodeIsForbidden = isForbiddenSapCode(productForm.codigo_sap);

  const hasRequiredFieldErrors =
    categoryNameIsMissing ||
    modelIsMissing ||
    originObservationIsMissing ||
    sapChangeReasonIsMissing;

  const hasDuplicateErrors = Boolean(
    duplicateValidation.duplicatedModelProduct ||
    duplicateValidation.duplicatedSapProduct,
  );

  const hasBlockingErrors =
    hasRequiredFieldErrors ||
    productCategoryIsUnavailable ||
    sapCodeIsForbidden ||
    hasDuplicateErrors ||
    duplicateValidation.loading;

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
      initial_stock_motivo:
        nextOrigin === "SERVICIO" ? "" : current.initial_stock_motivo,
    }));
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);

    if (hasBlockingErrors) {
      return;
    }

    void onSave();
  };

  const modelHelperText = duplicateValidation.duplicatedModelProduct
    ? `Ya existe un producto con este modelo: "${duplicateValidation.duplicatedModelProduct.modelo}".`
    : submitAttempted && modelIsMissing
      ? "El modelo es obligatorio para crear o editar un producto."
      : "Usa un nombre claro y único para evitar duplicados.";

  const sapHelperText = duplicateValidation.duplicatedSapProduct
    ? `Ya existe un producto con este código SAP: "${duplicateValidation.duplicatedSapProduct.modelo}".`
    : sapCodeIsForbidden
      ? "Código SAP no válido. Déjalo vacío si aún no existe; no uses N/A, SIN SAP, PENDIENTE ni 0000."
    : "Opcional. Si se informa, debe ser único.";

  const handleCloseDialog = () => {
    if (savingProduct) {
      return;
    }

    setSubmitAttempted(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="md">
      <DialogTitle>
        {editingProduct ? "Editar producto" : "Nuevo producto"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          {submitAttempted && hasRequiredFieldErrors ? (
            <Alert severity="warning" variant="outlined">
              Faltan campos obligatorios. Revisa los campos marcados antes de
              guardar.
            </Alert>
          ) : null}

          {hasDuplicateErrors ? (
            <Alert severity="error" variant="outlined">
              El modelo o código SAP ya existe en otro producto. Debes usar un
              valor único.
            </Alert>
          ) : null}

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

              const helperText =
                submitAttempted && categoryNameIsMissing
                  ? "La categoría es obligatoria."
                  : !categoryName
                    ? "Escribe una categoría. Si ya existe, se reutilizará."
                    : !productCategoryMatch
                      ? `Se creará la nueva categoría "${categoryName}" al guardar junto con el producto.`
                      : productCategoryMatch.is_available_for_products
                        ? `Se reutilizará la categoría existente "${productCategoryMatch.name}".`
                        : `La categoría "${productCategoryMatch.name}" es histórica o fue fusionada y no puede utilizarse.`;

              const helperColor =
                submitAttempted && categoryNameIsMissing
                  ? colors.status.error
                  : !categoryName
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
                  error={
                    (submitAttempted && categoryNameIsMissing) ||
                    productCategoryIsUnavailable
                  }
                  helperText={helperText}
                  sx={{
                    "& .MuiFormHelperText-root": {
                      color: helperColor,
                      fontWeight: categoryName || submitAttempted ? 800 : 500,
                    },
                  }}
                />
              );
            }}
          />

          <TextField
            label="Modelo"
            value={productForm.modelo}
            onChange={(event) => updateFormField("modelo", event.target.value)}
            fullWidth
            required
            error={
              (submitAttempted && modelIsMissing) ||
              Boolean(duplicateValidation.duplicatedModelProduct)
            }
            helperText={modelHelperText}
          />

          <TextField
            label="Código SAP"
            value={productForm.codigo_sap}
            onChange={(event) =>
              updateFormField("codigo_sap", event.target.value)
            }
            fullWidth
            error={
              sapCodeIsForbidden ||
              Boolean(duplicateValidation.duplicatedSapProduct)
            }
            helperText={sapHelperText}
          />

          {sapCodeChanged ? (
            <TextField
              label="Motivo del cambio de Código SAP"
              value={productForm.codigo_sap_motivo}
              onChange={(event) =>
                updateFormField("codigo_sap_motivo", event.target.value)
              }
              fullWidth
              required
              multiline
              minRows={2}
              error={submitAttempted && sapChangeReasonIsMissing}
              helperText={
                submitAttempted && sapChangeReasonIsMissing
                  ? "El motivo es obligatorio para conservar la trazabilidad del Código SAP."
                  : "El valor anterior, el nuevo valor, el responsable y este motivo quedarán auditados."
              }
            />
          ) : null}

          <TextField
            label="Detalle"
            value={productForm.detalle}
            onChange={(event) => updateFormField("detalle", event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          {editingProduct ? (
            <Stack spacing={1.5}>
              <TextField
                label="Origen del producto"
                value={getProductOriginLabel(productForm.origen)}
                fullWidth
                disabled
                helperText="El origen se modifica desde una acción separada con motivo y auditoría."
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
                  label="Observación de origen"
                  value={productForm.origen_observacion}
                  onChange={(event) =>
                    updateFormField("origen_observacion", event.target.value)
                  }
                  fullWidth
                  required
                  error={submitAttempted && originObservationIsMissing}
                  helperText={
                    submitAttempted && originObservationIsMissing
                      ? "Debe explicar el origen cuando selecciona OTRO."
                      : "Explique por qué este producto no corresponde a Comprado, Fabricado o Servicio."
                  }
                />
              ) : null}

              {productForm.origen === "SERVICIO" ? (
                <Alert severity="info" variant="outlined">
                  Un servicio no existe físicamente en bodega. No maneja stock,
                  stock mínimo, unidades por recibir ni Kardex.
                </Alert>
              ) : null}
            </>
          )}

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
                    initial_stock_motivo: event.target.checked
                      ? current.initial_stock_motivo
                      : "",
                    stock_critico: event.target.checked
                      ? current.stock_critico
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

          {productForm.controla_stock ? (
            <TextField
              label="Stock mínimo"
              type="number"
              value={productForm.stock_critico}
              onChange={(event) =>
                updateFormField("stock_critico", event.target.value)
              }
              fullWidth
              helperText="Último campo de stock; se usa para identificar existencias bajas."
            />
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCloseDialog}>Cancelar</Button>

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={savingProduct || duplicateValidation.loading}
        >
          {savingProduct
            ? "Guardando..."
            : duplicateValidation.loading
              ? "Validando..."
              : editingProduct
                ? "Guardar cambios"
                : "Crear producto"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
