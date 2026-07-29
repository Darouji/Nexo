import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { Product, InventoryLocation } from "../../services/inventoryService";
import type { Supplier } from "../../services/purchasesService";
import { colors } from "../../theme/colors";
import {
  EMPTY_PURCHASE_LINE,
  purchaseTaxRateForCountry,
  type PurchaseOrderForm,
} from "./purchaseModels";

type Props = {
  open: boolean;
  form: PurchaseOrderForm;
  suppliers: Supplier[];
  products: Product[];
  locations: InventoryLocation[];
  errors: Record<string, string>;
  generalError: string;
  optionsError: string;
  optionsLoading: boolean;
  loading: boolean;
  onChange: (form: PurchaseOrderForm) => void;
  onClose: () => void;
  onSave: () => void;
};

export function PurchaseOrderDialog({
  open,
  form,
  suppliers,
  products,
  locations,
  errors,
  generalError,
  optionsError,
  optionsLoading,
  loading,
  onChange,
  onClose,
  onSave,
}: Props) {
  const updateLine = (
    index: number,
    patch: Partial<PurchaseOrderForm["lines"][number]>,
  ) => {
    onChange({
      ...form,
      lines: form.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    });
  };

  const netAmount = form.lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  );
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === Number(form.supplier),
  );
  const taxRate = purchaseTaxRateForCountry(selectedSupplier?.country);
  const taxAmount = netAmount * (taxRate / 100);
  const totalAmount = netAmount + taxAmount;
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: form.currency,
      maximumFractionDigits: form.currency === "USD" ? 2 : 0,
    }).format(value);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Nueva orden de compra</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {optionsLoading ? (
            <Alert severity="info">
              Cargando proveedores, productos y ubicaciones disponibles...
            </Alert>
          ) : null}
          {optionsError ? <Alert severity="error">{optionsError}</Alert> : null}
          {generalError ? <Alert severity="error">{generalError}</Alert> : null}

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
              Datos generales
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              <TextField
                label="Número de orden (opcional)"
                value={form.number}
                onChange={(event) => onChange({ ...form, number: event.target.value })}
                error={Boolean(errors.number)}
                helperText={errors.number || "Si lo dejas vacío, SERKAN asignará el siguiente número oficial."}
              />
              <TextField
                select
                label="Proveedor"
                value={form.supplier}
                onChange={(event) => onChange({ ...form, supplier: event.target.value })}
                error={Boolean(errors.supplier)}
                helperText={errors.supplier}
              >
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Moneda"
                value={form.currency}
                onChange={(event) =>
                  onChange({
                    ...form,
                    currency: event.target.value as "CLP" | "USD",
                    exchangeRate: event.target.value === "CLP" ? "" : form.exchangeRate,
                  })
                }
              >
                <MenuItem value="CLP">CLP</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
              <TextField
                label="Tipo de cambio"
                type="number"
                value={form.exchangeRate}
                disabled={form.currency === "CLP"}
                onChange={(event) => onChange({ ...form, exchangeRate: event.target.value })}
                error={Boolean(errors.exchange_rate)}
                helperText={
                  errors.exchange_rate ||
                  (form.currency === "USD"
                    ? "Se conservará el valor usado al crear la orden."
                    : "No aplica para CLP.")
                }
              />
              <TextField
                label="Fecha de emisión"
                type="date"
                value={form.issueDate}
                onChange={(event) => onChange({ ...form, issueDate: event.target.value })}
                error={Boolean(errors.issue_date)}
                helperText={errors.issue_date}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Recepción esperada"
                type="date"
                value={form.expectedDate}
                onChange={(event) => onChange({ ...form, expectedDate: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Box>

          <Box>
            <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                Bienes y servicios
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  onChange({ ...form, lines: [...form.lines, { ...EMPTY_PURCHASE_LINE }] })
                }
              >
                Agregar línea
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {form.lines.map((line, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 2,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: colors.radius.md,
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 850 }}>Línea {index + 1}</Typography>
                    <IconButton
                      aria-label={`Eliminar línea ${index + 1}`}
                      disabled={form.lines.length === 1}
                      onClick={() =>
                        onChange({
                          ...form,
                          lines: form.lines.filter((_, lineIndex) => lineIndex !== index),
                        })
                      }
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={line.inventoryManaged}
                        disabled={Boolean(line.product)}
                        onChange={(event) =>
                          updateLine(index, {
                            inventoryManaged: event.target.checked,
                            product: event.target.checked ? line.product : "",
                            destinationLocation: event.target.checked
                              ? line.destinationLocation
                              : "",
                          })
                        }
                      />
                    }
                    label={line.product ? (line.inventoryManaged ? "El producto controla stock y requiere recepción física" : "El producto no controla stock ni genera Kardex") : "Línea inventariable"}
                  />
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "2fr 2fr 2fr 1fr 1fr" },
                      gap: 1.25,
                    }}
                  >
                    <TextField
                      label="Descripción"
                      value={line.description}
                      onChange={(event) => updateLine(index, { description: event.target.value })}
                      error={Boolean(errors[`lines.${index}.description`])}
                      helperText={errors[`lines.${index}.description`]}
                    />
                    <TextField
                      select
                      label="Producto"
                      value={line.product}
                      onChange={(event) => {
                        const product = products.find((item) => String(item.id) === event.target.value);
                        updateLine(index, {
                          product: event.target.value,
                          inventoryManaged: Boolean(product?.controla_stock),
                          destinationLocation: product?.controla_stock ? line.destinationLocation : "",
                        });
                      }}
                      error={Boolean(errors[`lines.${index}.product`])}
                      helperText={errors[`lines.${index}.product`]}
                    >
                      {products.map((product) => (
                        <MenuItem key={product.id} value={product.id}>
                          {product.modelo} · {product.codigo_sap || "Sin SAP"}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Ubicación destino"
                      value={line.destinationLocation}
                      disabled={!line.inventoryManaged}
                      onChange={(event) =>
                        updateLine(index, { destinationLocation: event.target.value })
                      }
                      error={Boolean(errors[`lines.${index}.destination_location`])}
                      helperText={errors[`lines.${index}.destination_location`]}
                    >
                      {locations.filter((location) => location.status === "ACTIVO").map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Cantidad"
                      type="number"
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      error={Boolean(errors[`lines.${index}.quantity`])}
                      helperText={errors[`lines.${index}.quantity`]}
                    />
                    <TextField
                      label="Precio unitario"
                      type="number"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                      error={Boolean(errors[`lines.${index}.unit_price`])}
                      helperText={errors[`lines.${index}.unit_price`]}
                    />
                  </Box>
                </Box>
              ))}
              {errors.lines ? <Alert severity="error">{errors.lines}</Alert> : null}
            </Stack>
          </Box>

          <Alert severity="info" variant="outlined">
            {taxRate === 19
              ? "IVA nacional calculado automáticamente al 19%. "
              : "Proveedor extranjero: IVA de la orden en 0%; el IVA de importación se registra en seguimiento logístico. "}
            Monto neto: <strong>{formatMoney(netAmount)}</strong>{" "}
            · IVA: <strong>{formatMoney(taxAmount)}</strong> · Total con IVA:{" "}
            <strong>{formatMoney(totalAmount)}</strong>
          </Alert>
          <TextField
            label="Observaciones"
            value={form.notes}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={loading || optionsLoading || Boolean(optionsError)}
        >
          {loading
            ? "Guardando..."
            : optionsLoading
              ? "Cargando opciones..."
              : "Guardar borrador"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
