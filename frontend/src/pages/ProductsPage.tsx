import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddBoxIcon from "@mui/icons-material/AddBox";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import {
  createProduct,
  fetchCategories,
  fetchProducts,
  registerInventoryAdjustment,
  registerManualStockEntry,
} from "../services/inventoryService";
import type {
  Category,
  CreateProductPayload,
  Product,
  ProductStockStatus,
} from "../services/inventoryService";
import { colors } from "../theme/colors";

type ProductFormState = {
  categoria: string;
  modelo: string;
  detalle: string;
  codigo_sap: string;
  stock_critico: string;
  en_camino: string;
  controla_stock: boolean;
  initial_stock: string;
  initial_stock_motivo: string;
};

type MovementDialogState = {
  open: boolean;
  mode: "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";
  product: Product | null;
  cantidad: string;
  motivo: string;
};

const emptyProductForm: ProductFormState = {
  categoria: "",
  modelo: "",
  detalle: "",
  codigo_sap: "",
  stock_critico: "0",
  en_camino: "0",
  controla_stock: true,
  initial_stock: "0",
  initial_stock_motivo: "Stock inicial registrado desde frontend.",
};

const emptyMovementDialog: MovementDialogState = {
  open: false,
  mode: "ENTRADA_MANUAL",
  product: null,
  cantidad: "",
  motivo: "",
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; [key: string]: unknown }
      | undefined;

    if (data?.detail) {
      return data.detail;
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field}: ${value.join(", ")}`;
          }

          return `${field}: ${String(value)}`;
        })
        .join(" | ");
    }
  }

  return "No se pudo completar la operación.";
}

function getStockStatusColor(status: ProductStockStatus) {
  if (status === "OK") {
    return colors.status.success;
  }

  if (status === "STOCK_CRITICO") {
    return colors.status.error;
  }

  if (status === "NO_CONTROLA_STOCK") {
    return colors.status.info;
  }

  return colors.status.warning;
}

function getStockStatusLabel(status: ProductStockStatus) {
  if (status === "OK") {
    return "Stock correcto";
  }

  if (status === "STOCK_CRITICO") {
    return "Stock crítico";
  }

  if (status === "NO_CONTROLA_STOCK") {
    return "No controla stock";
  }

  return String(status).replaceAll("_", " ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function parseInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function ProductsPage() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productForm, setProductForm] =
    useState<ProductFormState>(emptyProductForm);
  const [movementDialog, setMovementDialog] =
    useState<MovementDialogState>(emptyMovementDialog);

  const loadProducts = async (search = searchTerm) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await fetchProducts({
        search,
        ordering: "categoria__name,modelo",
      });

      setProductos(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchProducts({
        search: "",
        ordering: "categoria__name,modelo",
      }),
      fetchCategories(),
    ])
      .then(([productsData, categoriesData]) => {
        if (!isMounted) return;

        setProductos(productsData);
        setCategorias(categoriesData);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) return;

        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const stockCriticalCount = productos.filter(
    (producto) => producto.stock_status === "STOCK_CRITICO",
  ).length;

  const stockControlledCount = productos.filter(
    (producto) => producto.controla_stock,
  ).length;

  const incomingStockTotal = productos.reduce(
    (sum, producto) => sum + Number(producto.en_camino || 0),
    0,
  );

  const handleOpenCreateProduct = () => {
    setProductForm(emptyProductForm);
    setProductDialogOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCreateProduct = async () => {
    try {
      setSavingProduct(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload: CreateProductPayload = {
        categoria: Number(productForm.categoria),
        modelo: productForm.modelo.trim(),
        detalle: productForm.detalle.trim(),
        codigo_sap: productForm.codigo_sap.trim(),
        stock_critico: Math.max(parseInteger(productForm.stock_critico), 0),
        en_camino: Math.max(parseInteger(productForm.en_camino), 0),
        controla_stock: productForm.controla_stock,
      };

      const createdProduct = await createProduct(payload);
      const initialStock = parseInteger(productForm.initial_stock);

      if (payload.controla_stock && initialStock > 0) {
        await registerManualStockEntry(createdProduct.id, {
          cantidad: initialStock,
          motivo:
            productForm.initial_stock_motivo.trim() ||
            "Stock inicial registrado desde frontend.",
        });
      }

      setProductDialogOpen(false);
      setProductForm(emptyProductForm);
      setSuccessMessage("Producto creado correctamente.");
      await loadProducts("");
      setSearchTerm("");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProduct(false);
    }
  };

  const openMovementDialog = (
    product: Product,
    mode: MovementDialogState["mode"],
  ) => {
    setMovementDialog({
      open: true,
      mode,
      product,
      cantidad: "",
      motivo:
        mode === "ENTRADA_MANUAL"
          ? "Entrada manual de stock."
          : "Ajuste autorizado de inventario.",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeMovementDialog = () => {
    setMovementDialog(emptyMovementDialog);
  };

  const handleSaveMovement = async () => {
    if (!movementDialog.product) {
      return;
    }

    try {
      setSavingMovement(true);
      setErrorMessage("");
      setSuccessMessage("");

      const cantidad = parseInteger(movementDialog.cantidad);

      if (movementDialog.mode === "ENTRADA_MANUAL") {
        await registerManualStockEntry(movementDialog.product.id, {
          cantidad,
          motivo: movementDialog.motivo.trim(),
        });
      } else {
        await registerInventoryAdjustment(movementDialog.product.id, {
          cantidad,
          motivo: movementDialog.motivo.trim(),
        });
      }

      setSuccessMessage("Movimiento Kardex registrado correctamente.");
      closeMovementDialog();
      await loadProducts(searchTerm);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingMovement(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "categoria_name",
      headerName: "Categoría",
      minWidth: 180,
      flex: 0.8,
    },
    {
      field: "modelo",
      headerName: "Modelo",
      minWidth: 220,
      flex: 1.2,
    },
    {
      field: "codigo_sap",
      headerName: "Código SAP",
      minWidth: 140,
      flex: 0.7,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "detalle",
      headerName: "Detalle",
      minWidth: 240,
      flex: 1.2,
      renderCell: (params) => params.value || "Sin detalle",
    },
    {
      field: "stock_actual",
      headerName: "Stock actual",
      width: 135,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "stock_critico",
      headerName: "Stock crítico",
      width: 135,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "en_camino",
      headerName: "En camino",
      width: 130,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "controla_stock",
      headerName: "Control stock",
      width: 145,
      renderCell: (params) => {
        const controlaStock = Boolean(params.value);

        return (
          <Chip
            label={controlaStock ? "Sí" : "No"}
            size="small"
            sx={{
              color: controlaStock ? colors.status.success : colors.status.info,
              bgcolor: colors.surface.soft,
              borderColor: controlaStock
                ? colors.status.success
                : colors.status.info,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    {
      field: "stock_status",
      headerName: "Estado stock",
      width: 180,
      renderCell: (params) => {
        const status = String(params.value || "") as ProductStockStatus;
        const color = getStockStatusColor(status);

        return (
          <Chip
            label={getStockStatusLabel(status)}
            size="small"
            sx={{
              color,
              bgcolor: colors.surface.soft,
              borderColor: color,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    {
      field: "status",
      headerName: "Estado registro",
      width: 160,
      renderCell: (params) => (
        <Chip
          label={String(params.value || "SIN_ESTADO").replaceAll("_", " ")}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 800 }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 250,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const product = params.row as Product;
        const actionsDisabled = !product.controla_stock;

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddBoxIcon />}
              disabled={actionsDisabled}
              onClick={() => openMovementDialog(product, "ENTRADA_MANUAL")}
            >
              Entrada
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<TuneIcon />}
              disabled={actionsDisabled}
              onClick={() => openMovementDialog(product, "AJUSTE_INVENTARIO")}
            >
              Ajuste
            </Button>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            Inventario de Productos
          </Typography>

          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Módulo conectado al backend: productos, stock actual, stock crítico,
            productos en camino, creación real y movimientos Kardex autorizados.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateProduct}
          >
            Nuevo producto
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <Card
          sx={{
            p: 2.2,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.light}`,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Productos registrados
          </Typography>

          <Typography
            variant="h4"
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            {formatNumber(productos.length)}
          </Typography>
        </Card>

        <Card
          sx={{
            p: 2.2,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.light}`,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Controlan stock
          </Typography>

          <Typography
            variant="h4"
            sx={{ color: colors.status.success, fontWeight: 900 }}
          >
            {formatNumber(stockControlledCount)}
          </Typography>
        </Card>

        <Card
          sx={{
            p: 2.2,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.light}`,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Stock crítico
          </Typography>

          <Typography
            variant="h4"
            sx={{ color: colors.status.error, fontWeight: 900 }}
          >
            {formatNumber(stockCriticalCount)}
          </Typography>
        </Card>

        <Card
          sx={{
            p: 2.2,
            bgcolor: colors.background.paper,
            border: `1px solid ${colors.border.light}`,
          }}
        >
          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Unidades en camino
          </Typography>

          <Typography
            variant="h4"
            sx={{ color: colors.status.warning, fontWeight: 900 }}
          >
            {formatNumber(incomingStockTotal)}
          </Typography>
        </Card>
      </Box>

      <Card
        sx={{
          p: 2,
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Buscar producto"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void loadProducts(searchTerm);
              }
            }}
            fullWidth
            placeholder="Modelo, categoría, detalle o código SAP"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: colors.text.muted }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            variant="contained"
            onClick={() => void loadProducts(searchTerm)}
            disabled={loading}
            sx={{ minWidth: { xs: "100%", md: 140 } }}
          >
            Buscar
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              setSearchTerm("");
              void loadProducts("");
            }}
            disabled={loading}
            sx={{ minWidth: { xs: "100%", md: 120 } }}
          >
            Limpiar
          </Button>
        </Stack>
      </Card>

      {successMessage ? (
        <Alert severity="success" variant="outlined">
          {successMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" variant="outlined">
          {errorMessage}
        </Alert>
      ) : null}

      <SmartDataGrid rows={productos} columns={columns} loading={loading} />

      <Dialog
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Nuevo producto</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel id="product-category-label">Categoría</InputLabel>
              <Select
                labelId="product-category-label"
                label="Categoría"
                value={productForm.categoria}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    categoria: event.target.value,
                  }))
                }
              >
                {categorias.map((categoria) => (
                  <MenuItem key={categoria.id} value={String(categoria.id)}>
                    {categoria.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Modelo"
              value={productForm.modelo}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  modelo: event.target.value,
                }))
              }
              fullWidth
              required
            />

            <TextField
              label="Código SAP"
              value={productForm.codigo_sap}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  codigo_sap: event.target.value,
                }))
              }
              fullWidth
            />

            <TextField
              label="Detalle"
              value={productForm.detalle}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  detalle: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Stock crítico"
                type="number"
                value={productForm.stock_critico}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    stock_critico: event.target.value,
                  }))
                }
                fullWidth
              />

              <TextField
                label="En camino"
                type="number"
                value={productForm.en_camino}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    en_camino: event.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={productForm.controla_stock}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      controla_stock: event.target.checked,
                      initial_stock: event.target.checked
                        ? current.initial_stock
                        : "0",
                    }))
                  }
                />
              }
              label="Este producto controla stock y genera Kardex"
            />

            {productForm.controla_stock ? (
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Stock inicial"
                  type="number"
                  value={productForm.initial_stock}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      initial_stock: event.target.value,
                    }))
                  }
                  fullWidth
                  helperText="Se registrará como entrada manual Kardex después de crear el producto."
                />

                <TextField
                  label="Motivo stock inicial"
                  value={productForm.initial_stock_motivo}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      initial_stock_motivo: event.target.value,
                    }))
                  }
                  fullWidth
                />
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setProductDialogOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => void handleCreateProduct()}
            disabled={
              savingProduct ||
              !productForm.categoria ||
              !productForm.modelo.trim()
            }
          >
            {savingProduct ? "Guardando..." : "Crear producto"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={movementDialog.open}
        onClose={closeMovementDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {movementDialog.mode === "ENTRADA_MANUAL"
            ? "Entrada manual de stock"
            : "Ajuste de inventario"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              El stock no se edita directamente. Esta acción creará un
              movimiento Kardex auditado en backend.
            </Alert>

            <TextField
              label="Producto"
              value={movementDialog.product?.modelo || ""}
              fullWidth
              disabled
            />

            <TextField
              label={
                movementDialog.mode === "ENTRADA_MANUAL"
                  ? "Cantidad a ingresar"
                  : "Cantidad del ajuste"
              }
              type="number"
              value={movementDialog.cantidad}
              onChange={(event) =>
                setMovementDialog((current) => ({
                  ...current,
                  cantidad: event.target.value,
                }))
              }
              fullWidth
              helperText={
                movementDialog.mode === "AJUSTE_INVENTARIO"
                  ? "Usa números positivos para sumar stock o negativos para restar stock."
                  : "La entrada manual debe ser una cantidad positiva."
              }
            />

            <TextField
              label="Motivo"
              value={movementDialog.motivo}
              onChange={(event) =>
                setMovementDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeMovementDialog}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => void handleSaveMovement()}
            disabled={
              savingMovement ||
              !movementDialog.cantidad ||
              !movementDialog.motivo.trim()
            }
          >
            {savingMovement ? "Guardando..." : "Registrar Kardex"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
