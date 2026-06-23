import { useEffect, useState } from "react";
import HistoryIcon from "@mui/icons-material/History";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddBoxIcon from "@mui/icons-material/AddBox";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CategoryIcon from "@mui/icons-material/Category";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import type { GridColDef } from "@mui/x-data-grid";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { getApiErrorMessage as getErrorMessage } from "../services/api";
import {
  createProduct,
  ensureCategoryByName,
  fetchCategories,
  fetchKardexMovements,
  fetchProducts,
  inactivateProduct,
  registerInventoryAdjustment,
  registerManualStockEntry,
  updateProduct,
} from "../services/inventoryService";
import type {
  Category,
  CreateProductPayload,
  KardexMovement,
  Product,
  ProductListParams,
  ProductStockStatus,
} from "../services/inventoryService";
import { colors } from "../theme/colors";

type ProductFormState = {
  categoria_name: string;
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

type KardexDialogState = {
  open: boolean;
  product: Product | null;
  movements: KardexMovement[];
  loading: boolean;
};

const emptyProductForm: ProductFormState = {
  categoria_name: "",
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

const emptyKardexDialog: KardexDialogState = {
  open: false,
  product: null,
  movements: [],
  loading: false,
};

function getStockStatusColor(status: ProductStockStatus) {
  if (status === "STOCK_CORRECTO") {
    return colors.status.success;
  }

  if (status === "BAJO_MINIMO") {
    return colors.status.warning;
  }

  if (status === "SIN_STOCK") {
    return colors.status.error;
  }

  return colors.status.info;
}

function getStockStatusLabel(status: ProductStockStatus) {
  if (status === "STOCK_CORRECTO") {
    return "Stock correcto";
  }

  if (status === "BAJO_MINIMO") {
    return "Bajo mínimo";
  }

  if (status === "SIN_STOCK") {
    return "Sin stock";
  }

  return "No controla stock";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function parseInteger(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function parseOptionalBoolean(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function categoryExistsVisually(categories: Category[], name: string) {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    return false;
  }

  return categories.some(
    (category) => category.name.trim().toLowerCase() === normalizedName,
  );
}

export function ProductsPage() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVO");
  const [stockControlFilter, setStockControlFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    ProductStockStatus | ""
  >("");
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToInactivate, setProductToInactivate] =
    useState<Product | null>(null);
  const [inactivatingProduct, setInactivatingProduct] = useState(false);

  const [productForm, setProductForm] =
    useState<ProductFormState>(emptyProductForm);
  const [movementDialog, setMovementDialog] =
    useState<MovementDialogState>(emptyMovementDialog);
  const [kardexDialog, setKardexDialog] =
    useState<KardexDialogState>(emptyKardexDialog);
  const [globalKardexMovements, setGlobalKardexMovements] = useState<
    KardexMovement[]
  >([]);
  const [globalKardexLoading, setGlobalKardexLoading] = useState(true);
  const [globalKardexSearchTerm, setGlobalKardexSearchTerm] = useState("");
  const [globalKardexMovementType, setGlobalKardexMovementType] = useState("");
  const [globalKardexOrigin, setGlobalKardexOrigin] = useState("");

  type ProductFilterOverrides = {
    search?: string;
    category?: string;
    status?: string;
    stockControl?: string;
    stockStatus?: ProductStockStatus | "";
  };

  const loadProducts = async (
    searchOrFilters: string | ProductFilterOverrides = searchTerm,
  ) => {
    const filters =
      typeof searchOrFilters === "string"
        ? { search: searchOrFilters }
        : searchOrFilters;

    const resolvedSearch = filters.search ?? searchTerm;
    const resolvedCategory = filters.category ?? categoryFilter;
    const resolvedStatus = filters.status ?? statusFilter;
    const resolvedStockControl = filters.stockControl ?? stockControlFilter;
    const resolvedStockStatus = filters.stockStatus ?? stockStatusFilter;

    const params: ProductListParams = {
      search: resolvedSearch,
      ordering: "categoria__name,modelo",
      categoria: resolvedCategory ? Number(resolvedCategory) : undefined,
      status: resolvedStatus || undefined,
      controla_stock: parseOptionalBoolean(resolvedStockControl),
      stock_status: resolvedStockStatus || undefined,
    };

    try {
      setLoading(true);
      setErrorMessage("");

      const data = await fetchProducts(params);

      setProductos(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalKardex = async (
    filters: {
      search?: string;
      movementType?: string;
      origin?: string;
    } = {},
  ) => {
    const search = filters.search ?? globalKardexSearchTerm;
    const movementType = filters.movementType ?? globalKardexMovementType;
    const origin = filters.origin ?? globalKardexOrigin;

    try {
      setGlobalKardexLoading(true);
      setErrorMessage("");

      const movements = await fetchKardexMovements({
        search,
        movement_type: movementType,
        origin,
        ordering: "-created_at",
      });

      setGlobalKardexMovements(movements);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setGlobalKardexLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchProducts({
        search: "",
        ordering: "categoria__name,modelo",
        status: "ACTIVO",
      }),
      fetchCategories(),
      fetchKardexMovements({
        ordering: "-created_at",
      }),
    ])
      .then(([productsData, categoriesData, kardexData]) => {
        if (!isMounted) return;

        setProductos(productsData);
        setCategorias(categoriesData);
        setGlobalKardexMovements(kardexData);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) return;

        setLoading(false);
        setGlobalKardexLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const stockCriticalCount = productos.filter(
    (producto) =>
      producto.stock_status === "BAJO_MINIMO" ||
      producto.stock_status === "SIN_STOCK",
  ).length;

  const stockControlledCount = productos.filter(
    (producto) => producto.controla_stock,
  ).length;

  const incomingStockTotal = productos.reduce(
    (sum, producto) => sum + Number(producto.en_camino || 0),
    0,
  );

  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductDialogOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      categoria_name: product.categoria_name || "",
      modelo: product.modelo || "",
      detalle: product.detalle || "",
      codigo_sap: product.codigo_sap || "",
      stock_critico: String(product.stock_critico ?? 0),
      en_camino: String(product.en_camino ?? 0),
      controla_stock: product.controla_stock,
      initial_stock: "0",
      initial_stock_motivo: "Stock inicial registrado desde frontend.",
    });
    setProductDialogOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseProductDialog = () => {
    if (savingProduct) {
      return;
    }

    setProductDialogOpen(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm);
  };

  const handleSaveProduct = async () => {
    try {
      setSavingProduct(true);
      setErrorMessage("");
      setSuccessMessage("");

      const category = await ensureCategoryByName(
        productForm.categoria_name,
        categorias,
      );

      const payload: CreateProductPayload = {
        categoria: category.id,
        modelo: productForm.modelo.trim(),
        detalle: productForm.detalle.trim(),
        codigo_sap: productForm.codigo_sap.trim(),
        stock_critico: Math.max(parseInteger(productForm.stock_critico), 0),
        en_camino: Math.max(parseInteger(productForm.en_camino), 0),
        controla_stock: productForm.controla_stock,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);

        setSuccessMessage(
          `Producto "${payload.modelo}" actualizado correctamente.`,
        );
      } else {
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

        setSuccessMessage(
          `Producto creado correctamente en la categoría "${category.name}".`,
        );
      }

      const updatedCategories = await fetchCategories();
      setCategorias(updatedCategories);

      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
      await loadProducts(editingProduct ? searchTerm : "");
      await loadGlobalKardex();

      if (!editingProduct) {
        setSearchTerm("");
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleInactivateProduct = async () => {
    if (!productToInactivate) {
      return;
    }

    try {
      setInactivatingProduct(true);
      setErrorMessage("");
      setSuccessMessage("");

      await inactivateProduct(productToInactivate.id);

      setSuccessMessage(
        `Producto "${productToInactivate.modelo}" inactivado correctamente.`,
      );
      setProductToInactivate(null);
      await loadProducts(searchTerm);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setInactivatingProduct(false);
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

  const openKardexDialog = async (product: Product) => {
    setKardexDialog({
      open: true,
      product,
      movements: [],
      loading: true,
    });
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const movements = await fetchKardexMovements({
        producto: product.id,
        ordering: "-created_at",
      });

      setKardexDialog({
        open: true,
        product,
        movements,
        loading: false,
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
      setKardexDialog({
        open: true,
        product,
        movements: [],
        loading: false,
      });
    }
  };

  const closeKardexDialog = () => {
    setKardexDialog(emptyKardexDialog);
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
      await loadGlobalKardex();
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
      width: 560,
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
              startIcon={<EditIcon />}
              onClick={() => handleOpenEditProduct(product)}
            >
              Editar
            </Button>
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

            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => void openKardexDialog(product)}
            >
              Kardex
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={product.status !== "ACTIVO"}
              onClick={() => setProductToInactivate(product)}
              sx={{
                color: colors.status.error,
                borderColor: colors.status.error,
                "&:hover": {
                  bgcolor: colors.status.errorSoft,
                  borderColor: colors.status.error,
                },
              }}
            >
              Inactivar
            </Button>
          </Stack>
        );
      },
    },
  ];

  const kardexColumns: GridColDef[] = [
    {
      field: "created_at",
      headerName: "Fecha",
      width: 160,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_modelo",
      headerName: "Modelo",
      minWidth: 190,
      flex: 0.8,
    },
    {
      field: "producto_categoria",
      headerName: "Categoría",
      minWidth: 160,
      flex: 0.7,
    },
    {
      field: "producto_codigo_sap",
      headerName: "Código SAP",
      minWidth: 145,
      flex: 0.6,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "movement_type_display",
      headerName: "Movimiento",
      minWidth: 190,
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          label={String(params.value || "Movimiento")}
          size="small"
          sx={{
            color: colors.primary.main,
            bgcolor: colors.primary.soft,
            borderColor: colors.primary.border,
            border: "1px solid",
            fontWeight: 800,
          }}
        />
      ),
    },
    {
      field: "origin_display",
      headerName: "Origen",
      width: 135,
    },
    {
      field: "cantidad",
      headerName: "Cantidad",
      width: 120,
      type: "number",
      renderCell: (params) => {
        const value = Number(params.value || 0);

        return (
          <Typography
            sx={{
              color: value >= 0 ? colors.status.success : colors.status.error,
              fontWeight: 900,
            }}
          >
            {value > 0 ? `+${formatNumber(value)}` : formatNumber(value)}
          </Typography>
        );
      },
    },
    {
      field: "stock_antes",
      headerName: "Stock antes",
      width: 130,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_despues",
      headerName: "Stock después",
      width: 145,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "operador_nombre",
      headerName: "Operador",
      minWidth: 160,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin operador",
    },
    {
      field: "motivo",
      headerName: "Motivo",
      minWidth: 260,
      flex: 1.2,
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PageHeader
        title="Inventario de Productos"
        subtitle="Módulo central del sistema: productos, categorías, stock actual, stock crítico, unidades en camino y movimientos Kardex."
        eyebrow="Inventario y Kardex"
        icon={<Inventory2Icon />}
        tone={colors.modules.inventory}
        actions={
          <>
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
              sx={{
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
            >
              Actualizar
            </Button>
          </>
        }
      />

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
        <MetricCard
          title="Productos registrados"
          value={formatNumber(productos.length)}
          helper="Catálogo activo del sistema"
          icon={<Inventory2Icon />}
          tone={colors.modules.inventory}
        />

        <MetricCard
          title="Controlan stock"
          value={formatNumber(stockControlledCount)}
          helper="Generan movimientos Kardex"
          icon={<CategoryIcon />}
          tone={{
            main: colors.status.success,
            soft: colors.status.successSoft,
            border: colors.status.success,
          }}
        />

        <MetricCard
          title="Stock crítico"
          value={formatNumber(stockCriticalCount)}
          helper="Requieren revisión operativa"
          icon={<WarningAmberIcon />}
          tone={{
            main: colors.status.error,
            soft: colors.status.errorSoft,
            border: colors.status.error,
          }}
        />

        <MetricCard
          title="Unidades en camino"
          value={formatNumber(incomingStockTotal)}
          helper="Stock pendiente de recepción"
          icon={<LocalShippingIcon />}
          tone={{
            main: colors.status.warning,
            soft: colors.status.warningSoft,
            border: colors.secondary.border,
          }}
        />
      </Box>

      <SectionCard
        title="Búsqueda y filtros"
        subtitle="Busca por modelo, categoría, detalle o código SAP."
      >
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Buscar producto"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadProducts();
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
              onClick={() => void loadProducts()}
              disabled={loading}
              sx={{ minWidth: { xs: "100%", md: 140 } }}
            >
              Buscar
            </Button>

            <Button
              variant="outlined"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("");
                setStatusFilter("ACTIVO");
                setStockControlFilter("");
                setStockStatusFilter("");

                void loadProducts({
                  search: "",
                  category: "",
                  status: "ACTIVO",
                  stockControl: "",
                  stockStatus: "",
                });
              }}
              disabled={loading}
              sx={{
                minWidth: { xs: "100%", md: 120 },
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
            >
              Limpiar
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              select
              label="Categoría"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todas</MenuItem>
              {categorias.map((category) => (
                <MenuItem key={category.id} value={String(category.id)}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Estado del producto"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="ACTIVO">Activo</MenuItem>
              <MenuItem value="INACTIVO">Inactivo</MenuItem>
              <MenuItem value="DESCONTINUADO">Descontinuado</MenuItem>
              <MenuItem value="ARCHIVADO">Archivado</MenuItem>
            </TextField>

            <TextField
              select
              label="Control stock"
              value={stockControlFilter}
              onChange={(event) => setStockControlFilter(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="true">Controla stock</MenuItem>
              <MenuItem value="false">No controla stock</MenuItem>
            </TextField>

            <TextField
              select
              label="Estado stock"
              value={stockStatusFilter}
              onChange={(event) => {
                const nextStockStatus = event.target.value;

                if (
                  nextStockStatus === "" ||
                  nextStockStatus === "STOCK_CORRECTO" ||
                  nextStockStatus === "BAJO_MINIMO" ||
                  nextStockStatus === "SIN_STOCK" ||
                  nextStockStatus === "NO_CONTROLA_STOCK"
                ) {
                  setStockStatusFilter(nextStockStatus);
                }
              }}
              fullWidth
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="STOCK_CORRECTO">Stock correcto</MenuItem>
              <MenuItem value="BAJO_MINIMO">Bajo mínimo</MenuItem>
              <MenuItem value="SIN_STOCK">Sin stock</MenuItem>
              <MenuItem value="NO_CONTROLA_STOCK">No controla stock</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      </SectionCard>

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

      <SectionCard
        title="Catálogo de productos"
        subtitle="Stock actual, stock crítico, productos en camino, control de Kardex y acciones operativas."
      >
        <SmartDataGrid rows={productos} columns={columns} loading={loading} />
      </SectionCard>

      <SectionCard
        title="Kardex global"
        subtitle="Historial auditado de todos los movimientos de stock del sistema."
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Buscar movimiento"
            value={globalKardexSearchTerm}
            onChange={(event) => setGlobalKardexSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void loadGlobalKardex();
              }
            }}
            fullWidth
            placeholder="Producto, código SAP, motivo, referencia u operador"
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

          <TextField
            select
            label="Movimiento"
            value={globalKardexMovementType}
            onChange={(event) =>
              setGlobalKardexMovementType(event.target.value)
            }
            sx={{ minWidth: { xs: "100%", lg: 230 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ENTRADA_MANUAL">Entrada manual</MenuItem>
            <MenuItem value="AJUSTE_INVENTARIO">Ajuste de inventario</MenuItem>
            <MenuItem value="SALIDA_VENTA">Salida por venta</MenuItem>
            <MenuItem value="REVERSA_ANULACION">Reversa por anulación</MenuItem>
            <MenuItem value="ENTRADA_IMPORTACION">
              Entrada por importación
            </MenuItem>
          </TextField>

          <TextField
            select
            label="Origen"
            value={globalKardexOrigin}
            onChange={(event) => setGlobalKardexOrigin(event.target.value)}
            sx={{ minWidth: { xs: "100%", lg: 190 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="MANUAL">Manual</MenuItem>
            <MenuItem value="AUTOMATICO">Automático</MenuItem>
            <MenuItem value="API">API</MenuItem>
            <MenuItem value="IMPORTACION_EXCEL">Importación Excel</MenuItem>
            <MenuItem value="SISTEMA">Sistema</MenuItem>
          </TextField>

          <Button
            variant="contained"
            onClick={() => void loadGlobalKardex()}
            disabled={globalKardexLoading}
            sx={{ minWidth: { xs: "100%", lg: 140 } }}
          >
            Buscar
          </Button>

          <Button
            variant="outlined"
            disabled={globalKardexLoading}
            onClick={() => {
              setGlobalKardexSearchTerm("");
              setGlobalKardexMovementType("");
              setGlobalKardexOrigin("");

              void loadGlobalKardex({
                search: "",
                movementType: "",
                origin: "",
              });
            }}
            sx={{
              minWidth: { xs: "100%", lg: 120 },
              color: colors.text.primary,
              borderColor: colors.border.medium,
            }}
          >
            Limpiar
          </Button>
        </Stack>

        <SmartDataGrid
          rows={globalKardexMovements}
          columns={kardexColumns}
          loading={globalKardexLoading}
        />
      </SectionCard>

      <Dialog
        open={productDialogOpen}
        onClose={handleCloseProductDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {editingProduct ? "Editar producto" : "Nuevo producto"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Autocomplete<Category, false, false, true>
              freeSolo
              options={categorias}
              inputValue={productForm.categoria_name}
              onInputChange={(_event, newInputValue) =>
                setProductForm((current) => ({
                  ...current,
                  categoria_name: newInputValue,
                }))
              }
              onChange={(_event, newValue) =>
                setProductForm((current) => ({
                  ...current,
                  categoria_name:
                    typeof newValue === "string"
                      ? newValue
                      : newValue?.name || current.categoria_name,
                }))
              }
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option.name
              }
              renderInput={(params) => {
                const categoryName = productForm.categoria_name.trim();
                const categoryExists = categoryExistsVisually(
                  categorias,
                  categoryName,
                );

                const helperText = !categoryName
                  ? "Escribe una categoría. Si ya existe, se reutilizará."
                  : categoryExists
                    ? "Se reutilizará una categoría existente."
                    : `Se creará la nueva categoría "${categoryName}" al guardar.`;

                const helperColor = !categoryName
                  ? colors.text.muted
                  : categoryExists
                    ? colors.status.success
                    : colors.status.warning;

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

            {productForm.controla_stock && !editingProduct ? (
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
          <Button onClick={handleCloseProductDialog}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => void handleSaveProduct()}
            disabled={
              savingProduct ||
              !productForm.categoria_name.trim() ||
              !productForm.modelo.trim()
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

      <Dialog
        open={kardexDialog.open}
        onClose={closeKardexDialog}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Kardex del producto
          {kardexDialog.product ? `: ${kardexDialog.product.modelo}` : ""}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Historial real de movimientos de stock. Cada registro muestra
              cantidad, stock anterior, stock posterior, motivo, operador y
              fecha.
            </Alert>

            <SmartDataGrid
              rows={kardexDialog.movements}
              columns={kardexColumns}
              loading={kardexDialog.loading}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeKardexDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(productToInactivate)}
        title="Inactivar producto"
        description={
          productToInactivate
            ? `El producto "${productToInactivate.modelo}" quedará inactivo. No se eliminará físicamente y su historial Kardex seguirá disponible.`
            : undefined
        }
        confirmLabel="Inactivar"
        destructive
        loading={inactivatingProduct}
        onClose={() => {
          if (!inactivatingProduct) {
            setProductToInactivate(null);
          }
        }}
        onConfirm={() => void handleInactivateProduct()}
      />
    </Box>
  );
}
