import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
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
import HistoryIcon from "@mui/icons-material/History";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import BlockIcon from "@mui/icons-material/Block";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { PageHeader } from "../components/PageHeader";
import { ProductDialog } from "../features/inventory/products/ProductDialog";
import {
  emptyProductForm,
  findCategoryByInputName,
  type ProductFormState,
} from "../features/inventory/products/productFormModel";
import { SectionCard } from "../components/SectionCard";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { CategoryManagerDialog } from "../features/inventory/categories/CategoryManagerDialog";
import { InventoryCatalogSection } from "../features/inventory/components/InventoryCatalogSection";
import { buildProductCatalogColumns } from "../features/inventory/products/productCatalogColumns";
import { getApiErrorMessage as getErrorMessage } from "../services/api";
import {
  cancelPendingReceipt,
  changeProductLifecycle,
  createPendingReceipt,
  createProduct,
  fetchCategories,
  fetchInventorySummary,
  fetchKardexMovements,
  fetchProductsPage,
  fetchPendingReceipts,
  receivePendingReceipt,
  registerInventoryAdjustment,
  registerManualStockEntry,
  updateProduct,
} from "../services/inventoryService";
import type {
  AuditOrigin,
  Category,
  InventorySummary,
  KardexMovement,
  PendingReceipt,
  PendingReceiptStatus,
  Product,
  ProductLifecycleAction,
  ProductListParams,
  ProductStockStatus,
} from "../services/inventoryService";
import { colors } from "../theme/colors";

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

type ProductActionMenuState = {
  anchorEl: HTMLElement | null;
  product: Product | null;
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

const emptyProductActionMenu: ProductActionMenuState = {
  anchorEl: null,
  product: null,
};

const defaultProductPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 25,
};

const emptyInventorySummary: InventorySummary = {
  productos_activos: 0,
  bajo_minimo: 0,
  por_recibir: 0,
};

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

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

const chileanDateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return chileanDateTimeFormatter.format(date);
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

export function ProductsPage() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [productRowCount, setProductRowCount] = useState(0);

  const [productPaginationModel, setProductPaginationModel] =
    useState<GridPaginationModel>(defaultProductPaginationModel);

  const [inventorySummary, setInventorySummary] = useState<InventorySummary>(
    emptyInventorySummary,
  );
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVO");
  const [stockControlFilter, setStockControlFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    ProductStockStatus | ""
  >("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

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
  const [globalKardexLoading, setGlobalKardexLoading] = useState(false);
  const [hasLoadedGlobalKardex, setHasLoadedGlobalKardex] = useState(false);
  const [globalKardexSearchTerm, setGlobalKardexSearchTerm] = useState("");
  const [globalKardexMovementType, setGlobalKardexMovementType] = useState("");
  const [globalKardexOrigin, setGlobalKardexOrigin] = useState<
    AuditOrigin | ""
  >("");
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [pendingReceiptsLoading, setPendingReceiptsLoading] = useState(true);

  const [pendingReceiptCreateDialog, setPendingReceiptCreateDialog] =
    useState<PendingReceiptCreateDialogState>(emptyPendingReceiptCreateDialog);

  const [pendingReceiptOperationDialog, setPendingReceiptOperationDialog] =
    useState<PendingReceiptOperationDialogState>(
      emptyPendingReceiptOperationDialog,
    );

  const [savingPendingReceipt, setSavingPendingReceipt] = useState(false);
  const pendingReceiptsSectionRef = useRef<HTMLDivElement | null>(null);

  const [inventoryActionMenu, setInventoryActionMenu] =
    useState<ProductActionMenuState>(emptyProductActionMenu);

  const [moreActionMenu, setMoreActionMenu] = useState<ProductActionMenuState>(
    emptyProductActionMenu,
  );

  type ProductFilterOverrides = {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
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
    const resolvedPage = filters.page ?? productPaginationModel.page;
    const resolvedPageSize =
      filters.pageSize ?? productPaginationModel.pageSize;

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

      const data = await fetchProductsPage({
        ...params,
        page: resolvedPage + 1,
        page_size: resolvedPageSize,
      });

      setProductos(data.results);
      setProductRowCount(data.count);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCategoriesChanged = async (message: string) => {
    const updatedCategories = await fetchCategories();

    setCategorias(updatedCategories);

    await loadProducts();

    setSuccessMessage(message);
  };

  const handleCloseCategoryManager = useCallback(() => {
    setCategoryManagerOpen(false);
  }, []);

  const handleClearCategoryManagerFeedback = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, []);

  const loadInventorySummary = async () => {
    try {
      const summary = await fetchInventorySummary();
      setInventorySummary(summary);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const loadFirstProductPage = (filters: ProductFilterOverrides = {}) => {
    const nextPaginationModel = {
      ...productPaginationModel,
      page: 0,
    };

    setProductPaginationModel(nextPaginationModel);

    void loadProducts({
      ...filters,
      page: 0,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleProductPaginationModelChange = (
    nextPaginationModel: GridPaginationModel,
  ) => {
    setProductPaginationModel(nextPaginationModel);

    void loadProducts({
      page: nextPaginationModel.page,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const loadGlobalKardex = async (
    filters: {
      search?: string;
      movementType?: string;
      origin?: AuditOrigin | "";
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
        origin: origin || undefined,
        ordering: "-created_at",
      });

      setGlobalKardexMovements(movements);
      setHasLoadedGlobalKardex(true);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setGlobalKardexLoading(false);
    }
  };

  const refreshGlobalKardexIfLoaded = async () => {
    if (!hasLoadedGlobalKardex) {
      return;
    }

    await loadGlobalKardex();
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
      fetchProductsPage({
        search: "",
        ordering: "categoria__name,modelo",
        status: "ACTIVO",
        page: 1,
        page_size: defaultProductPaginationModel.pageSize,
      }),
      fetchCategories(),
      fetchPendingReceipts({
        ordering: "-created_at",
      }),
      fetchInventorySummary(),
    ])
      .then(
        ([productsPage, categoriesData, pendingReceiptsData, summaryData]) => {
          if (!isMounted) {
            return;
          }

          setProductos(productsPage.results);
          setProductRowCount(productsPage.count);
          setCategorias(categoriesData);
          setPendingReceipts(pendingReceiptsData);
          setInventorySummary(summaryData);
          setErrorMessage("");
        },
      )
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setLoading(false);
        setPendingReceiptsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProductFiltersCount = [
    categoryFilter,
    statusFilter === "ACTIVO" ? "" : statusFilter,
    stockControlFilter,
    stockStatusFilter,
  ].filter(Boolean).length;

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
      origen: product.origen,
      origen_observacion: product.origen_observacion || "",
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
    const categoriaNombre = productForm.categoria_name.trim();
    const origenObservacion = productForm.origen_observacion.trim();
    const isServiceProduct = productForm.origen === "SERVICIO";

    const matchingCategory = findCategoryByInputName(
      categorias,
      categoriaNombre,
    );

    if (!categoriaNombre) {
      setErrorMessage("La categoría es obligatoria.");
      return;
    }

    if (
      !editingProduct &&
      matchingCategory &&
      !matchingCategory.is_available_for_products
    ) {
      setErrorMessage(
        "La categoría indicada está fusionada o archivada y no puede utilizarse. Selecciona una categoría disponible.",
      );
      return;
    }

    if (
      !editingProduct &&
      productForm.origen === "OTRO" &&
      !origenObservacion
    ) {
      setErrorMessage("Debe explicar el origen cuando selecciona OTRO.");
      return;
    }

    try {
      setSavingProduct(true);
      setErrorMessage("");
      setSuccessMessage("");

      const editableProductPayload = {
        modelo: productForm.modelo.trim(),
        detalle: productForm.detalle.trim(),
        codigo_sap: productForm.codigo_sap.trim(),
        stock_critico: isServiceProduct
          ? 0
          : Math.max(parseInteger(productForm.stock_critico), 0),
        controla_stock: isServiceProduct ? false : productForm.controla_stock,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, editableProductPayload);

        setSuccessMessage(
          `Producto "${editableProductPayload.modelo}" actualizado correctamente.`,
        );
      } else {
        const initialStock =
          isServiceProduct || !editableProductPayload.controla_stock
            ? 0
            : Math.max(parseInteger(productForm.initial_stock), 0);

        const createdProduct = await createProduct({
          categoria_nombre: categoriaNombre,
          ...editableProductPayload,
          origen: productForm.origen,
          origen_observacion: origenObservacion,
          stock_inicial: initialStock,
          motivo_stock_inicial:
            initialStock > 0
              ? productForm.initial_stock_motivo.trim()
              : undefined,
        });

        setSuccessMessage(
          `Producto "${createdProduct.modelo}" creado correctamente en la categoría "${createdProduct.categoria_name}".`,
        );
      }

      const updatedCategories = await fetchCategories();
      setCategorias(updatedCategories);

      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);

      await loadProducts(editingProduct ? searchTerm : "");
      await refreshGlobalKardexIfLoaded();

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

  const closeProductActionMenus = () => {
    setInventoryActionMenu(emptyProductActionMenu);
    setMoreActionMenu(emptyProductActionMenu);
  };

  const openInventoryActionMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, product: Product) => {
      setMoreActionMenu(emptyProductActionMenu);
      setInventoryActionMenu({
        anchorEl: event.currentTarget,
        product,
      });
    },
    [],
  );

  const openMoreActionMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, product: Product) => {
      setInventoryActionMenu(emptyProductActionMenu);
      setMoreActionMenu({
        anchorEl: event.currentTarget,
        product,
      });
    },
    [],
  );

  const focusPendingReceipts = () => {
    closeProductActionMenus();

    window.requestAnimationFrame(() => {
      pendingReceiptsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
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

  const openPendingReceiptOperationDialog = useCallback(
    (pendingReceipt: PendingReceipt, mode: PendingReceiptOperationMode) => {
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
    },
    [],
  );

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
          loadInventorySummary(),
          loadProducts(searchTerm),
          loadPendingReceipts(),
          refreshGlobalKardexIfLoaded(),
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
      await refreshGlobalKardexIfLoaded();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingMovement(false);
    }
  };

  const columns = useMemo<GridColDef[]>(
    () =>
      buildProductCatalogColumns({
        onOpenInventoryActionMenu: openInventoryActionMenu,
        onOpenMoreActionMenu: openMoreActionMenu,
      }),
    [openInventoryActionMenu, openMoreActionMenu],
  );

  const kardexColumns = useMemo<GridColDef[]>(
    () => [
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
    ],
    [],
  );

  const pendingReceiptColumns = useMemo<GridColDef[]>(
    () => [
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
        headerName: "OC / referencia",
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
    ],
    [openPendingReceiptOperationDialog],
  );

  const inventoryMenuProduct = inventoryActionMenu.product;

  const inventoryMenuIsOperationallyActive = Boolean(
    inventoryMenuProduct && inventoryMenuProduct.status === "ACTIVO",
  );

  const inventoryMenuCanRegisterManualEntry = Boolean(
    inventoryMenuProduct &&
    inventoryMenuIsOperationallyActive &&
    inventoryMenuProduct.controla_stock &&
    !inventoryMenuProduct.descontinuado,
  );

  const inventoryMenuCanAdjustStock = Boolean(
    inventoryMenuProduct &&
    inventoryMenuIsOperationallyActive &&
    inventoryMenuProduct.controla_stock,
  );

  const inventoryMenuCanRegisterPendingReceipt = Boolean(
    inventoryMenuProduct &&
    inventoryMenuIsOperationallyActive &&
    inventoryMenuProduct.controla_stock &&
    !inventoryMenuProduct.descontinuado,
  );

  const moreActionProduct = moreActionMenu.product;

  const moreActionIsOperationallyActive = Boolean(
    moreActionProduct && moreActionProduct.status === "ACTIVO",
  );

  const moreActionCanInactivate = Boolean(
    moreActionProduct &&
    moreActionIsOperationallyActive &&
    Number(moreActionProduct.stock_actual || 0) === 0 &&
    Number(moreActionProduct.por_recibir || 0) === 0,
  );

  const handleSubmitProductSearch = () => {
    loadFirstProductPage();
  };

  const handleExecuteProductSearch = () => {
    void loadProducts();
  };

  const handleToggleProductFilters = () => {
    setFiltersOpen((current) => !current);
  };

  const handleClearProductFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setStatusFilter("ACTIVO");
    setStockControlFilter("");
    setStockStatusFilter("");
    setFiltersOpen(false);

    loadFirstProductPage({
      search: "",
      category: "",
      status: "ACTIVO",
      stockControl: "",
      stockStatus: "",
    });
  };

  const handleOpenCategoryManager = () => {
    setCategoryManagerOpen(true);
  };

  const handleOpenProductFromCategoryManager = (
    product: Product,
    category: Category,
  ) => {
    setCategoryManagerOpen(false);
    setSearchTerm(product.modelo);
    setCategoryFilter(String(category.id));
    setStatusFilter("");
    setStockControlFilter("");
    setStockStatusFilter("");
    setFiltersOpen(true);
    setErrorMessage("");

    setSuccessMessage(
      `Mostrando "${product.modelo}" desde la categoría "${category.name}".`,
    );

    loadFirstProductPage({
      search: product.modelo,
      category: String(category.id),
      status: "",
      stockControl: "",
      stockStatus: "",
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PageHeader
        title="Inventario de Productos"
        subtitle="Módulo central del sistema: productos, categorías, stock actual, stock mínimo, unidades por recibir y movimientos Kardex."
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
                loadFirstProductPage();
                void loadInventorySummary();
                void loadPendingReceipts();
                void refreshGlobalKardexIfLoaded();
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

      <InventoryCatalogSection
        inventorySummary={inventorySummary}
        products={productos}
        categories={categorias}
        columns={columns}
        loading={loading}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSubmitProductSearch={handleSubmitProductSearch}
        onExecuteProductSearch={handleExecuteProductSearch}
        filtersOpen={filtersOpen}
        onToggleFilters={handleToggleProductFilters}
        activeProductFiltersCount={activeProductFiltersCount}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        stockControlFilter={stockControlFilter}
        onStockControlFilterChange={setStockControlFilter}
        stockStatusFilter={stockStatusFilter}
        onStockStatusFilterChange={setStockStatusFilter}
        onClearProductFilters={handleClearProductFilters}
        productPaginationModel={productPaginationModel}
        onProductPaginationModelChange={handleProductPaginationModelChange}
        productRowCount={productRowCount}
        onOpenCategoryManager={handleOpenCategoryManager}
        feedbackSlot={
          <>
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
          </>
        }
      />

      <Box ref={pendingReceiptsSectionRef} sx={{ scrollMarginTop: 24 }}>
        <SectionCard
          title="Pendientes por recibir"
          subtitle="Unidades esperadas que todavía no modifican el stock físico."
        >
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            Registrar una unidad por recibir no aumenta el stock. El stock solo
            cambia cuando se confirma la recepción física y se crea su
            movimiento Kardex.
          </Alert>

          <SmartDataGrid
            rows={pendingReceipts}
            columns={pendingReceiptColumns}
            loading={pendingReceiptsLoading}
          />
        </SectionCard>
      </Box>

      <SectionCard
        title="Kardex de Inventario"
        subtitle="Historial de movimientos de stock."
        actions={
          <Button
            variant={hasLoadedGlobalKardex ? "outlined" : "contained"}
            startIcon={<HistoryIcon />}
            onClick={() => void loadGlobalKardex()}
            disabled={globalKardexLoading}
            sx={
              hasLoadedGlobalKardex
                ? {
                    color: colors.text.primary,
                    borderColor: colors.border.medium,
                  }
                : undefined
            }
          >
            {globalKardexLoading
              ? "Cargando..."
              : hasLoadedGlobalKardex
                ? "Actualizar Kardex"
                : "Cargar Kardex"}
          </Button>
        }
      >
        {!hasLoadedGlobalKardex ? (
          <Stack spacing={2} sx={{ py: 2, alignItems: "flex-start" }}>
            <Alert severity="info" variant="outlined" sx={{ width: "100%" }}>
              El historial global se carga solo cuando se necesita. Esto
              mantiene el acceso a Inventario más rápido sin alterar la
              trazabilidad ni los movimientos registrados.
            </Alert>

            <Button
              variant="contained"
              startIcon={<HistoryIcon />}
              onClick={() => void loadGlobalKardex()}
              disabled={globalKardexLoading}
            >
              {globalKardexLoading
                ? "Cargando historial..."
                : "Cargar historial Kardex"}
            </Button>
          </Stack>
        ) : (
          <>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Buscar movimiento"
                value={globalKardexSearchTerm}
                onChange={(event) =>
                  setGlobalKardexSearchTerm(event.target.value)
                }
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
                <MenuItem value="ENTRADA_RECEPCION">
                  Entrada por recepción
                </MenuItem>
                <MenuItem value="AJUSTE_INVENTARIO">
                  Ajuste de inventario
                </MenuItem>
                <MenuItem value="SALIDA_VENTA">Salida por venta</MenuItem>
                <MenuItem value="REVERSA_ANULACION">
                  Reversa por anulación
                </MenuItem>
                <MenuItem value="ENTRADA_IMPORTACION">
                  Entrada por importación
                </MenuItem>
              </TextField>

              <TextField
                select
                label="Origen"
                value={globalKardexOrigin}
                onChange={(event) => {
                  const nextOrigin = event.target.value;

                  if (
                    nextOrigin === "" ||
                    nextOrigin === "MANUAL" ||
                    nextOrigin === "API" ||
                    nextOrigin === "IMPORTACION_EXCEL" ||
                    nextOrigin === "AUTOMATICO" ||
                    nextOrigin === "SISTEMA"
                  ) {
                    setGlobalKardexOrigin(nextOrigin);
                  }
                }}
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
          </>
        )}
      </SectionCard>

      <ProductDialog
        key={
          productDialogOpen
            ? editingProduct
              ? `edit-product-${editingProduct.id}`
              : "create-product-open"
            : "product-dialog-closed"
        }
        open={productDialogOpen}
        editingProduct={editingProduct}
        productForm={productForm}
        categories={categorias}
        savingProduct={savingProduct}
        onFormChange={setProductForm}
        onClose={handleCloseProductDialog}
        onSave={handleSaveProduct}
      />

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
                label="Orden de compra / referencia"
                value={pendingReceiptCreateDialog.referencia}
                onChange={(event) =>
                  setPendingReceiptCreateDialog((current) => ({
                    ...current,
                    referencia: event.target.value,
                  }))
                }
                fullWidth
                placeholder="Ej.: OC-2026-001"
                helperText="Usa la OC o el identificador que explique el origen de este pendiente."
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

      <CategoryManagerDialog
        open={categoryManagerOpen}
        categories={categorias}
        onClose={handleCloseCategoryManager}
        onCategoriesChanged={handleCategoriesChanged}
        onError={setErrorMessage}
        onClearFeedback={handleClearCategoryManagerFeedback}
        onOpenProductInCatalog={handleOpenProductFromCategoryManager}
      />

      <Menu
        anchorEl={inventoryActionMenu.anchorEl}
        open={Boolean(inventoryActionMenu.anchorEl)}
        onClose={closeProductActionMenus}
      >
        {inventoryMenuProduct ? (
          <>
            <MenuItem
              disabled={!inventoryMenuCanRegisterManualEntry}
              onClick={() => {
                closeProductActionMenus();
                openMovementDialog(inventoryMenuProduct, "ENTRADA_MANUAL");
              }}
            >
              <ListItemIcon>
                <AddBoxIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Registrar entrada física</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!inventoryMenuCanAdjustStock}
              onClick={() => {
                closeProductActionMenus();
                openMovementDialog(inventoryMenuProduct, "AJUSTE_INVENTARIO");
              }}
            >
              <ListItemIcon>
                <TuneIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ajustar stock</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!inventoryMenuCanRegisterPendingReceipt}
              onClick={() => {
                closeProductActionMenus();
                openPendingReceiptCreateDialog(inventoryMenuProduct);
              }}
            >
              <ListItemIcon>
                <LocalShippingIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Registrar por recibir</ListItemText>
            </MenuItem>

            <MenuItem onClick={focusPendingReceipts}>
              <ListItemIcon>
                <LocalShippingIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Gestionar pendientes por recibir</ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>

      <Menu
        anchorEl={moreActionMenu.anchorEl}
        open={Boolean(moreActionMenu.anchorEl)}
        onClose={closeProductActionMenus}
      >
        {moreActionProduct ? (
          <>
            <MenuItem
              onClick={() => {
                closeProductActionMenus();
                void openKardexDialog(moreActionProduct);
              }}
            >
              <ListItemIcon>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ver Kardex</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!moreActionIsOperationallyActive}
              onClick={() => {
                closeProductActionMenus();
                handleOpenEditProduct(moreActionProduct);
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Editar producto</ListItemText>
            </MenuItem>

            {moreActionProduct.status === "ACTIVO" ? (
              <>
                <MenuItem
                  onClick={() => {
                    closeProductActionMenus();
                    openProductLifecycleDialog(
                      moreActionProduct,
                      moreActionProduct.descontinuado
                        ? "REANUDAR"
                        : "DESCONTINUAR",
                    );
                  }}
                >
                  <ListItemIcon>
                    <WarningAmberIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>
                    {moreActionProduct.descontinuado
                      ? "Reanudar producto"
                      : "Descontinuar producto"}
                  </ListItemText>
                </MenuItem>

                <MenuItem
                  disabled={!moreActionCanInactivate}
                  onClick={() => {
                    closeProductActionMenus();
                    openProductLifecycleDialog(moreActionProduct, "INACTIVAR");
                  }}
                >
                  <ListItemIcon>
                    <BlockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Inactivar producto</ListItemText>
                </MenuItem>
              </>
            ) : null}

            {moreActionProduct.status === "INACTIVO" ? (
              <>
                <MenuItem
                  onClick={() => {
                    closeProductActionMenus();
                    openProductLifecycleDialog(moreActionProduct, "REACTIVAR");
                  }}
                >
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Reactivar producto</ListItemText>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    closeProductActionMenus();
                    openProductLifecycleDialog(moreActionProduct, "ARCHIVAR");
                  }}
                >
                  <ListItemIcon>
                    <ArchiveOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Archivar producto</ListItemText>
                </MenuItem>
              </>
            ) : null}

            {moreActionProduct.status === "ARCHIVADO" ? (
              <MenuItem
                onClick={() => {
                  closeProductActionMenus();
                  openProductLifecycleDialog(moreActionProduct, "REACTIVAR");
                }}
              >
                <ListItemIcon>
                  <RefreshIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Reactivar producto</ListItemText>
              </MenuItem>
            ) : null}
          </>
        ) : null}
      </Menu>
    </Box>
  );
}
