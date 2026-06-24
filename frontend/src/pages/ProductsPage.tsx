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
import { MetricCard } from "../components/MetricCard";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { getApiErrorMessage as getErrorMessage } from "../services/api";
import {
  cancelPendingReceipt,
  createPendingReceipt,
  createProduct,
  ensureCategoryByName,
  fetchCategories,
  fetchKardexMovements,
  fetchProducts,
  fetchPendingReceipts,
  changeProductLifecycle,
  receivePendingReceipt,
  registerInventoryAdjustment,
  registerManualStockEntry,
  updateProduct,
} from "../services/inventoryService";
import type {
  Category,
  KardexMovement,
  PendingReceipt,
  PendingReceiptStatus,
  Product,
  ProductLifecycleAction,
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

type PendingReceiptCreateDialogState = {
  open: boolean;
  product: Product | null;
  cantidad: string;
  referencia: string;
  motivo: string;
};

type PendingReceiptOperationMode = "RECIBIR" | "CANCELAR";

type PendingReceiptOperationDialogState = {
  open: boolean;
  mode: PendingReceiptOperationMode;
  pendingReceipt: PendingReceipt | null;
  cantidad: string;
  motivo: string;
};

type ProductLifecycleDialogState = {
  open: boolean;
  product: Product | null;
  action: ProductLifecycleAction | null;
  motivo: string;
};

const emptyProductForm: ProductFormState = {
  categoria_name: "",
  modelo: "",
  detalle: "",
  codigo_sap: "",
  stock_critico: "0",
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

const emptyPendingReceiptCreateDialog: PendingReceiptCreateDialogState = {
  open: false,
  product: null,
  cantidad: "",
  referencia: "",
  motivo: "",
};

const emptyPendingReceiptOperationDialog: PendingReceiptOperationDialogState = {
  open: false,
  mode: "RECIBIR",
  pendingReceipt: null,
  cantidad: "",
  motivo: "",
};

const emptyProductLifecycleDialog: ProductLifecycleDialogState = {
  open: false,
  product: null,
  action: null,
  motivo: "",
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

function getPendingReceiptStatusColor(status: PendingReceiptStatus) {
  if (status === "PENDIENTE") {
    return colors.status.warning;
  }

  if (status === "PARCIAL") {
    return colors.status.info;
  }

  if (status === "RECIBIDA") {
    return colors.status.success;
  }

  if (status === "CANCELADA") {
    return colors.status.error;
  }

  return colors.text.muted;
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
  const [productLifecycleDialog, setProductLifecycleDialog] =
    useState<ProductLifecycleDialogState>(emptyProductLifecycleDialog);
  const [savingProductLifecycle, setSavingProductLifecycle] = useState(false);

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
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [pendingReceiptsLoading, setPendingReceiptsLoading] = useState(true);

  const [pendingReceiptCreateDialog, setPendingReceiptCreateDialog] =
    useState<PendingReceiptCreateDialogState>(emptyPendingReceiptCreateDialog);

  const [pendingReceiptOperationDialog, setPendingReceiptOperationDialog] =
    useState<PendingReceiptOperationDialogState>(
      emptyPendingReceiptOperationDialog,
    );

  const [savingPendingReceipt, setSavingPendingReceipt] = useState(false);

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

  const loadPendingReceipts = async () => {
    try {
      setPendingReceiptsLoading(true);
      setErrorMessage("");

      const pendingReceiptsData = await fetchPendingReceipts({
        ordering: "-created_at",
      });

      setPendingReceipts(pendingReceiptsData);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingReceiptsLoading(false);
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
      fetchPendingReceipts({
        ordering: "-created_at",
      }),
    ])
      .then(
        ([productsData, categoriesData, kardexData, pendingReceiptsData]) => {
          if (!isMounted) return;

          setProductos(productsData);
          setCategorias(categoriesData);
          setGlobalKardexMovements(kardexData);
          setPendingReceipts(pendingReceiptsData);
          setErrorMessage("");
        },
      )
      .catch((error: unknown) => {
        if (!isMounted) return;

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) return;

        setLoading(false);
        setGlobalKardexLoading(false);
        setPendingReceiptsLoading(false);
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

  const incomingStockTotal = pendingReceipts.reduce(
    (sum, pendingReceipt) =>
      sum + Number(pendingReceipt.cantidad_pendiente || 0),
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

      const productPayload = {
        categoria: category.id,
        modelo: productForm.modelo.trim(),
        detalle: productForm.detalle.trim(),
        codigo_sap: productForm.codigo_sap.trim(),
        stock_critico: Math.max(parseInteger(productForm.stock_critico), 0),
        controla_stock: productForm.controla_stock,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productPayload);

        setSuccessMessage(
          `Producto "${productPayload.modelo}" actualizado correctamente.`,
        );
      } else {
        const initialStock = productForm.controla_stock
          ? Math.max(parseInteger(productForm.initial_stock), 0)
          : 0;

        await createProduct({
          ...productPayload,
          stock_inicial: initialStock,
          motivo_stock_inicial:
            initialStock > 0
              ? productForm.initial_stock_motivo.trim()
              : undefined,
        });

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

  const openProductLifecycleDialog = (
    product: Product,
    action: ProductLifecycleAction,
  ) => {
    setProductLifecycleDialog({
      open: true,
      product,
      action,
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeProductLifecycleDialog = () => {
    if (savingProductLifecycle) {
      return;
    }

    setProductLifecycleDialog(emptyProductLifecycleDialog);
  };

  const getProductLifecycleActionLabel = (action: ProductLifecycleAction) => {
    const labels: Record<ProductLifecycleAction, string> = {
      INACTIVAR: "Inactivar",
      ARCHIVAR: "Archivar",
      REACTIVAR: "Reactivar",
      DESCONTINUAR: "Descontinuar",
      REANUDAR: "Reanudar",
    };

    return labels[action];
  };

  const getProductLifecycleSuccessLabel = (action: ProductLifecycleAction) => {
    const labels: Record<ProductLifecycleAction, string> = {
      INACTIVAR: "inactivado",
      ARCHIVAR: "archivado",
      REACTIVAR: "reactivado",
      DESCONTINUAR: "descontinuado",
      REANUDAR: "reanudado",
    };

    return labels[action];
  };

  const getLifecycleDestinationFilter = (action: ProductLifecycleAction) => {
    const filters: Record<ProductLifecycleAction, string> = {
      INACTIVAR: "INACTIVO",
      ARCHIVAR: "ARCHIVADO",
      REACTIVAR: "ACTIVO",
      DESCONTINUAR: "DESCONTINUADO",
      REANUDAR: "ACTIVO",
    };

    return filters[action];
  };

  const handleProductLifecycle = async () => {
    const product = productLifecycleDialog.product;
    const action = productLifecycleDialog.action;
    const motivo = productLifecycleDialog.motivo.trim();

    if (!product || !action || !motivo) {
      setErrorMessage("El motivo del cambio de estado es obligatorio.");
      return;
    }

    try {
      setSavingProductLifecycle(true);
      setErrorMessage("");
      setSuccessMessage("");

      await changeProductLifecycle(product.id, {
        accion: action,
        motivo,
      });

      const destinationStatus = getLifecycleDestinationFilter(action);

      setStatusFilter(destinationStatus);

      setSuccessMessage(
        `Producto "${product.modelo}" ${getProductLifecycleSuccessLabel(action)} correctamente.`,
      );

      setProductLifecycleDialog(emptyProductLifecycleDialog);

      await loadProducts({
        search: searchTerm,
        status: destinationStatus,
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProductLifecycle(false);
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

  const openPendingReceiptCreateDialog = (product: Product) => {
    setPendingReceiptCreateDialog({
      open: true,
      product,
      cantidad: "",
      referencia: "",
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closePendingReceiptCreateDialog = () => {
    if (savingPendingReceipt) {
      return;
    }

    setPendingReceiptCreateDialog(emptyPendingReceiptCreateDialog);
  };

  const openPendingReceiptOperationDialog = (
    pendingReceipt: PendingReceipt,
    mode: PendingReceiptOperationMode,
  ) => {
    setPendingReceiptOperationDialog({
      open: true,
      mode,
      pendingReceipt,
      cantidad:
        mode === "RECIBIR" ? String(pendingReceipt.cantidad_pendiente) : "",
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closePendingReceiptOperationDialog = () => {
    if (savingPendingReceipt) {
      return;
    }

    setPendingReceiptOperationDialog(emptyPendingReceiptOperationDialog);
  };

  const handleCreatePendingReceipt = async () => {
    const product = pendingReceiptCreateDialog.product;
    const cantidad = parseInteger(pendingReceiptCreateDialog.cantidad);

    if (!product || cantidad <= 0) {
      setErrorMessage("Debe indicar una cantidad válida por recibir.");
      return;
    }

    if (
      !pendingReceiptCreateDialog.referencia.trim() &&
      !pendingReceiptCreateDialog.motivo.trim()
    ) {
      setErrorMessage("Debe indicar una referencia o un motivo.");
      return;
    }

    try {
      setSavingPendingReceipt(true);
      setErrorMessage("");
      setSuccessMessage("");

      await createPendingReceipt({
        producto: product.id,
        cantidad,
        referencia: pendingReceiptCreateDialog.referencia,
        motivo: pendingReceiptCreateDialog.motivo,
      });

      setSuccessMessage(
        `Se registraron ${formatNumber(cantidad)} unidades por recibir para "${product.modelo}". El stock físico no cambió.`,
      );

      closePendingReceiptCreateDialog();

      await Promise.all([loadProducts(searchTerm), loadPendingReceipts()]);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingPendingReceipt(false);
    }
  };

  const handlePendingReceiptOperation = async () => {
    const pendingReceipt = pendingReceiptOperationDialog.pendingReceipt;
    const cantidad = parseInteger(pendingReceiptOperationDialog.cantidad);
    const motivo = pendingReceiptOperationDialog.motivo.trim();

    if (!pendingReceipt) {
      return;
    }

    if (cantidad <= 0) {
      setErrorMessage("Debe indicar una cantidad válida.");
      return;
    }

    if (cantidad > pendingReceipt.cantidad_pendiente) {
      setErrorMessage(
        `La cantidad no puede superar las ${formatNumber(
          pendingReceipt.cantidad_pendiente,
        )} unidades pendientes.`,
      );
      return;
    }

    if (!motivo) {
      setErrorMessage("El motivo es obligatorio.");
      return;
    }

    try {
      setSavingPendingReceipt(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (pendingReceiptOperationDialog.mode === "RECIBIR") {
        await receivePendingReceipt(pendingReceipt.id, {
          cantidad,
          motivo,
        });

        setSuccessMessage(
          `Se recibieron ${formatNumber(cantidad)} unidades de "${pendingReceipt.producto_modelo}". El stock y Kardex fueron actualizados.`,
        );

        await Promise.all([
          loadProducts(searchTerm),
          loadPendingReceipts(),
          loadGlobalKardex(),
        ]);
      } else {
        await cancelPendingReceipt(pendingReceipt.id, {
          cantidad,
          motivo,
        });

        setSuccessMessage(
          `Se cancelaron ${formatNumber(cantidad)} unidades pendientes de "${pendingReceipt.producto_modelo}". El stock físico no cambió.`,
        );

        await Promise.all([loadProducts(searchTerm), loadPendingReceipts()]);
      }

      closePendingReceiptOperationDialog();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingPendingReceipt(false);
    }
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
      field: "por_recibir",
      headerName: "Por recibir",
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
      field: "estado_producto_display",
      headerName: "Estado",
      width: 160,
      renderCell: (params) => (
        <Chip
          label={String(params.value || "Sin estado")}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 800 }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 900,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const product = params.row as Product;

        const isOperationallyActive = product.status === "ACTIVO";

        const canRegisterManualEntry =
          isOperationallyActive &&
          product.controla_stock &&
          !product.descontinuado;

        const canAdjustInventory =
          isOperationallyActive && product.controla_stock;

        const canRegisterPendingReceipt =
          isOperationallyActive &&
          product.controla_stock &&
          !product.descontinuado;

        const canInactivate =
          isOperationallyActive &&
          Number(product.stock_actual || 0) === 0 &&
          Number(product.por_recibir || 0) === 0;

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              disabled={!isOperationallyActive}
              startIcon={<EditIcon />}
              onClick={() => handleOpenEditProduct(product)}
            >
              Editar
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddBoxIcon />}
              disabled={!canRegisterManualEntry}
              onClick={() => openMovementDialog(product, "ENTRADA_MANUAL")}
            >
              Entrada
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<LocalShippingIcon />}
              disabled={!canRegisterPendingReceipt}
              onClick={() => openPendingReceiptCreateDialog(product)}
            >
              Por recibir
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<TuneIcon />}
              disabled={!canAdjustInventory}
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

            {isOperationallyActive ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    openProductLifecycleDialog(
                      product,
                      product.descontinuado ? "REANUDAR" : "DESCONTINUAR",
                    )
                  }
                >
                  {product.descontinuado ? "Reanudar" : "Descontinuar"}
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canInactivate}
                  title={
                    canInactivate
                      ? ""
                      : "Solo se puede inactivar un producto sin stock ni unidades pendientes."
                  }
                  onClick={() =>
                    openProductLifecycleDialog(product, "INACTIVAR")
                  }
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
              </>
            ) : null}

            {product.status === "INACTIVO" ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    openProductLifecycleDialog(product, "REACTIVAR")
                  }
                >
                  Reactivar
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    openProductLifecycleDialog(product, "ARCHIVAR")
                  }
                >
                  Archivar
                </Button>
              </>
            ) : null}

            {product.status === "ARCHIVADO" ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => openProductLifecycleDialog(product, "REACTIVAR")}
              >
                Reactivar
              </Button>
            ) : null}
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

  const pendingReceiptColumns: GridColDef[] = [
    {
      field: "created_at",
      headerName: "Registrado",
      width: 160,
      renderCell: (params) => formatDateTime(String(params.value || "")),
    },
    {
      field: "producto_categoria",
      headerName: "Categoría",
      minWidth: 150,
      flex: 0.7,
    },
    {
      field: "producto_modelo",
      headerName: "Producto",
      minWidth: 210,
      flex: 1,
    },
    {
      field: "producto_codigo_sap",
      headerName: "Código SAP",
      minWidth: 145,
      flex: 0.6,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "cantidad_original",
      headerName: "Original",
      width: 105,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_recibida",
      headerName: "Recibida",
      width: 110,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_cancelada",
      headerName: "Cancelada",
      width: 115,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "cantidad_pendiente",
      headerName: "Pendiente",
      width: 115,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "estado",
      headerName: "Estado",
      width: 155,
      renderCell: (params) => {
        const pendingReceipt = params.row as PendingReceipt;
        const color = getPendingReceiptStatusColor(pendingReceipt.estado);

        return (
          <Chip
            label={pendingReceipt.estado_display}
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
      field: "referencia",
      headerName: "Referencia",
      minWidth: 170,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin referencia",
    },
    {
      field: "motivo",
      headerName: "Motivo",
      minWidth: 250,
      flex: 1.2,
      renderCell: (params) => params.value || "Sin motivo",
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 240,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const pendingReceipt = params.row as PendingReceipt;

        const canOperate =
          pendingReceipt.cantidad_pendiente > 0 &&
          (pendingReceipt.estado === "PENDIENTE" ||
            pendingReceipt.estado === "PARCIAL");

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddBoxIcon />}
              disabled={!canOperate}
              onClick={() =>
                openPendingReceiptOperationDialog(pendingReceipt, "RECIBIR")
              }
            >
              Recibir
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!canOperate}
              onClick={() =>
                openPendingReceiptOperationDialog(pendingReceipt, "CANCELAR")
              }
              sx={{
                color: colors.status.error,
                borderColor: colors.status.error,
                "&:hover": {
                  bgcolor: colors.status.errorSoft,
                  borderColor: colors.status.error,
                },
              }}
            >
              Cancelar
            </Button>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PageHeader
        title="Inventario de Productos"
        subtitle="Módulo central del sistema: productos, categorías, stock actual, stock crítico, unidades por recibir y movimientos Kardex."
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
              onClick={() => {
                void loadProducts();
                void loadPendingReceipts();
              }}
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
          title="Unidades por recibir"
          value={formatNumber(incomingStockTotal)}
          helper="Pendientes de recepción física"
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
        subtitle="Stock actual, stock crítico, unidades por recibir, Kardex y acciones operativas."
      >
        <SmartDataGrid rows={productos} columns={columns} loading={loading} />
      </SectionCard>

      <SectionCard
        title="Pendientes por recibir"
        subtitle="Unidades esperadas que todavía no modifican el stock físico."
      >
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Registrar una unidad por recibir no aumenta el stock. El stock solo
          cambia cuando se confirma la recepción física y se crea su movimiento
          Kardex.
        </Alert>

        <SmartDataGrid
          rows={pendingReceipts}
          columns={pendingReceiptColumns}
          loading={pendingReceiptsLoading}
        />
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
            <MenuItem value="ENTRADA_RECEPCION">Entrada por recepción</MenuItem>
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
                  helperText="Se registrará en la misma operación de creación mediante una entrada Kardex auditada."
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
        open={pendingReceiptCreateDialog.open}
        onClose={closePendingReceiptCreateDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Registrar unidades por recibir</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Registrar unidades por recibir no modifica el stock físico ni crea
              Kardex. El stock cambia solamente al confirmar la recepción
              física.
            </Alert>

            <TextField
              label="Producto"
              value={
                pendingReceiptCreateDialog.product
                  ? `${pendingReceiptCreateDialog.product.categoria_name} — ${pendingReceiptCreateDialog.product.modelo}`
                  : ""
              }
              fullWidth
              disabled
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Cantidad por recibir"
                type="number"
                value={pendingReceiptCreateDialog.cantidad}
                onChange={(event) =>
                  setPendingReceiptCreateDialog((current) => ({
                    ...current,
                    cantidad: event.target.value,
                  }))
                }
                fullWidth
                required
              />

              <TextField
                label="Referencia"
                value={pendingReceiptCreateDialog.referencia}
                onChange={(event) =>
                  setPendingReceiptCreateDialog((current) => ({
                    ...current,
                    referencia: event.target.value,
                  }))
                }
                fullWidth
                helperText="Ejemplo: OC-2026-001."
              />
            </Stack>

            <TextField
              label="Motivo"
              value={pendingReceiptCreateDialog.motivo}
              onChange={(event) =>
                setPendingReceiptCreateDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
              helperText="Debe indicar una referencia o un motivo."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closePendingReceiptCreateDialog}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => void handleCreatePendingReceipt()}
            disabled={
              savingPendingReceipt ||
              !pendingReceiptCreateDialog.product ||
              parseInteger(pendingReceiptCreateDialog.cantidad) <= 0 ||
              (!pendingReceiptCreateDialog.referencia.trim() &&
                !pendingReceiptCreateDialog.motivo.trim())
            }
          >
            {savingPendingReceipt ? "Registrando..." : "Registrar pendiente"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pendingReceiptOperationDialog.open}
        onClose={closePendingReceiptOperationDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {pendingReceiptOperationDialog.mode === "RECIBIR"
            ? "Recibir unidades pendientes"
            : "Cancelar unidades pendientes"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert
              severity={
                pendingReceiptOperationDialog.mode === "RECIBIR"
                  ? "success"
                  : "warning"
              }
              variant="outlined"
            >
              {pendingReceiptOperationDialog.mode === "RECIBIR"
                ? "Esta operación aumenta el stock físico y crea un movimiento Kardex auditado."
                : "Esta operación no modifica el stock físico ni crea un movimiento Kardex."}
            </Alert>

            <TextField
              label="Producto"
              value={
                pendingReceiptOperationDialog.pendingReceipt
                  ? `${pendingReceiptOperationDialog.pendingReceipt.producto_categoria} — ${pendingReceiptOperationDialog.pendingReceipt.producto_modelo}`
                  : ""
              }
              fullWidth
              disabled
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Pendiente disponible"
                value={formatNumber(
                  pendingReceiptOperationDialog.pendingReceipt
                    ?.cantidad_pendiente ?? 0,
                )}
                fullWidth
                disabled
              />

              <TextField
                label={
                  pendingReceiptOperationDialog.mode === "RECIBIR"
                    ? "Cantidad a recibir"
                    : "Cantidad a cancelar"
                }
                type="number"
                value={pendingReceiptOperationDialog.cantidad}
                onChange={(event) =>
                  setPendingReceiptOperationDialog((current) => ({
                    ...current,
                    cantidad: event.target.value,
                  }))
                }
                fullWidth
                required
              />
            </Stack>

            <TextField
              label="Motivo"
              value={pendingReceiptOperationDialog.motivo}
              onChange={(event) =>
                setPendingReceiptOperationDialog((current) => ({
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
          <Button onClick={closePendingReceiptOperationDialog}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => void handlePendingReceiptOperation()}
            disabled={
              savingPendingReceipt ||
              !pendingReceiptOperationDialog.pendingReceipt ||
              parseInteger(pendingReceiptOperationDialog.cantidad) <= 0 ||
              parseInteger(pendingReceiptOperationDialog.cantidad) >
                (pendingReceiptOperationDialog.pendingReceipt
                  ?.cantidad_pendiente ?? 0) ||
              !pendingReceiptOperationDialog.motivo.trim()
            }
          >
            {savingPendingReceipt
              ? "Procesando..."
              : pendingReceiptOperationDialog.mode === "RECIBIR"
                ? "Confirmar recepción"
                : "Confirmar cancelación"}
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

      <Dialog
        open={productLifecycleDialog.open}
        onClose={closeProductLifecycleDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {productLifecycleDialog.action
            ? getProductLifecycleActionLabel(productLifecycleDialog.action)
            : "Gestionar producto"}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert
              severity={
                productLifecycleDialog.action === "ARCHIVAR" ||
                productLifecycleDialog.action === "INACTIVAR"
                  ? "warning"
                  : "info"
              }
              variant="outlined"
            >
              {productLifecycleDialog.action === "DESCONTINUAR"
                ? "El producto dejará de aceptar nuevas entradas manuales, importaciones y nuevas unidades por recibir. Su Kardex e historial se conservarán."
                : productLifecycleDialog.action === "REANUDAR"
                  ? "El producto volverá a estar disponible para nuevas operaciones de inventario."
                  : productLifecycleDialog.action === "INACTIVAR"
                    ? "El producto dejará de estar disponible para operaciones. Solo puede inactivarse sin stock físico ni unidades pendientes."
                    : productLifecycleDialog.action === "ARCHIVAR"
                      ? "El producto quedará fuera del catálogo operativo, manteniendo su historial disponible para auditoría."
                      : "El producto volverá a estar activo y disponible para operaciones de inventario."}
            </Alert>

            <TextField
              label="Producto"
              value={
                productLifecycleDialog.product
                  ? `${productLifecycleDialog.product.categoria_name} — ${productLifecycleDialog.product.modelo}`
                  : ""
              }
              fullWidth
              disabled
            />

            <TextField
              label="Motivo"
              value={productLifecycleDialog.motivo}
              onChange={(event) =>
                setProductLifecycleDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={3}
              helperText="Este motivo quedará asociado a la auditoría del producto."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closeProductLifecycleDialog}
            disabled={savingProductLifecycle}
          >
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleProductLifecycle()}
            disabled={
              savingProductLifecycle ||
              !productLifecycleDialog.product ||
              !productLifecycleDialog.action ||
              !productLifecycleDialog.motivo.trim()
            }
          >
            {savingProductLifecycle
              ? "Procesando..."
              : productLifecycleDialog.action
                ? getProductLifecycleActionLabel(productLifecycleDialog.action)
                : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
