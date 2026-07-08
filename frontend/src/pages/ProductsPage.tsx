import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Alert, Box, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { PageHeader } from "../components/PageHeader";
import { ProductDialog } from "../features/inventory/products/ProductDialog";
import {
  emptyProductForm,
  findCategoryByInputName,
  getProductOriginLabel,
  type ProductFormState,
} from "../features/inventory/products/productFormModel";
import { CategoryManagerDialog } from "../features/inventory/categories/CategoryManagerDialog";
import { InventoryCatalogSection } from "../features/inventory/components/InventoryCatalogSection";
import { PendingReceiptsSection } from "../features/inventory/components/PendingReceiptsSection";
import { GlobalKardexSection } from "../features/inventory/components/GlobalKardexSection";
import { ProductKardexDialog } from "../features/inventory/components/ProductKardexDialog";
import { ProductLifecycleDialog } from "../features/inventory/components/ProductLifecycleDialog";
import { StockMovementDialog } from "../features/inventory/components/StockMovementDialog";
import { PendingReceiptDialogs } from "../features/inventory/components/PendingReceiptDialogs";
import { ProductOriginChangeDialog } from "../features/inventory/components/ProductOriginChangeDialog";
import { ProductCategoryChangeDialog } from "../features/inventory/components/ProductCategoryChangeDialog";
import { ProductActionMenus } from "../features/inventory/components/ProductActionMenus";
import { buildProductCatalogColumns } from "../features/inventory/products/productCatalogColumns";
import { buildPendingReceiptColumns } from "../features/inventory/pendingReceipts/pendingReceiptColumns";
import { buildKardexColumns } from "../features/inventory/kardex/kardexColumns";
import { getApiErrorMessage as getErrorMessage } from "../services/api";
import {
  cancelPendingReceipt,
  changeProductCategory,
  changeProductLifecycle,
  changeProductOrigin,
  createPendingReceipt,
  createProduct,
  fetchCategories,
  fetchInventorySummary,
  fetchKardexMovementsPage,
  fetchProductsPage,
  fetchPendingReceiptsPage,
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
  ProductOrigin,
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
  rowCount: number;
  paginationModel: GridPaginationModel;
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

type ProductOriginDialogState = {
  open: boolean;
  product: Product | null;
  origen: ProductOrigin;
  origen_observacion: string;
  motivo: string;
};

type ProductCategoryDialogState = {
  open: boolean;
  product: Product | null;
  destinationCategory: Category | null;
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

const defaultKardexPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 10,
};

const emptyKardexDialog: KardexDialogState = {
  open: false,
  product: null,
  movements: [],
  rowCount: 0,
  paginationModel: defaultKardexPaginationModel,
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

const emptyProductOriginDialog: ProductOriginDialogState = {
  open: false,
  product: null,
  origen: "COMPRADO",
  origen_observacion: "",
  motivo: "",
};

const emptyProductCategoryDialog: ProductCategoryDialogState = {
  open: false,
  product: null,
  destinationCategory: null,
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

const defaultPendingReceiptPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 10,
};

const emptyInventorySummary: InventorySummary = {
  productos_activos: 0,
  bajo_minimo: 0,
  por_recibir: 0,
};

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
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

  const [productOriginDialog, setProductOriginDialog] =
    useState<ProductOriginDialogState>(emptyProductOriginDialog);
  const [savingProductOrigin, setSavingProductOrigin] = useState(false);

  const [productCategoryDialog, setProductCategoryDialog] =
    useState<ProductCategoryDialogState>(emptyProductCategoryDialog);
  const [savingProductCategory, setSavingProductCategory] = useState(false);

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
  const [globalKardexRowCount, setGlobalKardexRowCount] = useState(0);
  const [globalKardexPaginationModel, setGlobalKardexPaginationModel] =
    useState<GridPaginationModel>(defaultKardexPaginationModel);
  const [globalKardexSearchTerm, setGlobalKardexSearchTerm] = useState("");
  const [globalKardexMovementType, setGlobalKardexMovementType] = useState("");
  const [globalKardexOrigin, setGlobalKardexOrigin] = useState<
    AuditOrigin | ""
  >("");
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [pendingReceiptsLoading, setPendingReceiptsLoading] = useState(true);
  const [pendingReceiptRowCount, setPendingReceiptRowCount] = useState(0);
  const [pendingReceiptPaginationModel, setPendingReceiptPaginationModel] =
    useState<GridPaginationModel>(defaultPendingReceiptPaginationModel);
  const [pendingReceiptSearchTerm, setPendingReceiptSearchTerm] = useState("");
  const [pendingReceiptStatusFilter, setPendingReceiptStatusFilter] = useState<
    PendingReceiptStatus | ""
  >("");

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

  type PendingReceiptFilterOverrides = {
    search?: string;
    status?: PendingReceiptStatus | "";
    page?: number;
    pageSize?: number;
  };

  type KardexFilterOverrides = {
    search?: string;
    movementType?: string;
    origin?: AuditOrigin | "";
    product?: number;
    page?: number;
    pageSize?: number;
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

  const loadGlobalKardex = async (filters: KardexFilterOverrides = {}) => {
    const resolvedSearch = filters.search ?? globalKardexSearchTerm;
    const resolvedMovementType =
      filters.movementType ?? globalKardexMovementType;
    const resolvedOrigin = filters.origin ?? globalKardexOrigin;
    const resolvedPage = filters.page ?? globalKardexPaginationModel.page;
    const resolvedPageSize =
      filters.pageSize ?? globalKardexPaginationModel.pageSize;

    try {
      setGlobalKardexLoading(true);
      setErrorMessage("");

      const movementsPage = await fetchKardexMovementsPage({
        search: resolvedSearch,
        movement_type: resolvedMovementType || undefined,
        origin: resolvedOrigin || undefined,
        ordering: "-created_at",
        page: resolvedPage + 1,
        page_size: resolvedPageSize,
      });

      setGlobalKardexMovements(movementsPage.results);
      setGlobalKardexRowCount(movementsPage.count);
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

  const handleGlobalKardexPaginationModelChange = (
    nextPaginationModel: GridPaginationModel,
  ) => {
    setGlobalKardexPaginationModel(nextPaginationModel);

    void loadGlobalKardex({
      page: nextPaginationModel.page,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleSearchGlobalKardex = () => {
    const nextPaginationModel = {
      ...globalKardexPaginationModel,
      page: 0,
    };

    setGlobalKardexPaginationModel(nextPaginationModel);

    void loadGlobalKardex({
      page: 0,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleClearGlobalKardexFilters = () => {
    const nextPaginationModel = {
      ...globalKardexPaginationModel,
      page: 0,
    };

    setGlobalKardexSearchTerm("");
    setGlobalKardexMovementType("");
    setGlobalKardexOrigin("");
    setGlobalKardexPaginationModel(nextPaginationModel);

    void loadGlobalKardex({
      search: "",
      movementType: "",
      origin: "",
      page: 0,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const loadPendingReceipts = async (
    filters: PendingReceiptFilterOverrides = {},
  ) => {
    const resolvedSearch = filters.search ?? pendingReceiptSearchTerm;
    const resolvedStatus = filters.status ?? pendingReceiptStatusFilter;
    const resolvedPage = filters.page ?? pendingReceiptPaginationModel.page;
    const resolvedPageSize =
      filters.pageSize ?? pendingReceiptPaginationModel.pageSize;

    try {
      setPendingReceiptsLoading(true);
      setErrorMessage("");

      const pendingReceiptsPage = await fetchPendingReceiptsPage({
        ordering: "-created_at",
        search: resolvedSearch,
        estado: resolvedStatus || undefined,
        page: resolvedPage + 1,
        page_size: resolvedPageSize,
      });

      setPendingReceipts(pendingReceiptsPage.results);
      setPendingReceiptRowCount(pendingReceiptsPage.count);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingReceiptsLoading(false);
    }
  };

  const handlePendingReceiptPaginationModelChange = (
    nextPaginationModel: GridPaginationModel,
  ) => {
    setPendingReceiptPaginationModel(nextPaginationModel);

    void loadPendingReceipts({
      page: nextPaginationModel.page,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleSearchPendingReceipts = () => {
    const nextPaginationModel = {
      ...pendingReceiptPaginationModel,
      page: 0,
    };

    setPendingReceiptPaginationModel(nextPaginationModel);

    void loadPendingReceipts({
      search: pendingReceiptSearchTerm,
      status: pendingReceiptStatusFilter,
      page: 0,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleClearPendingReceiptFilters = () => {
    const nextPaginationModel = {
      ...pendingReceiptPaginationModel,
      page: 0,
    };

    setPendingReceiptSearchTerm("");
    setPendingReceiptStatusFilter("");
    setPendingReceiptPaginationModel(nextPaginationModel);

    void loadPendingReceipts({
      search: "",
      status: "",
      page: 0,
      pageSize: nextPaginationModel.pageSize,
    });
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
      fetchPendingReceiptsPage({
        ordering: "-created_at",
        page: 1,
        page_size: defaultPendingReceiptPaginationModel.pageSize,
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
          setPendingReceipts(pendingReceiptsData.results);
          setPendingReceiptRowCount(pendingReceiptsData.count);
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

  const openProductOriginDialog = (product: Product) => {
    setProductOriginDialog({
      open: true,
      product,
      origen: product.origen,
      origen_observacion: product.origen_observacion || "",
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeProductOriginDialog = () => {
    if (savingProductOrigin) {
      return;
    }

    setProductOriginDialog(emptyProductOriginDialog);
  };

  const handleProductOriginChange = async () => {
    const product = productOriginDialog.product;
    const motivo = productOriginDialog.motivo.trim();
    const origenObservacion = productOriginDialog.origen_observacion.trim();

    if (!product) {
      return;
    }

    if (!motivo) {
      setErrorMessage("El motivo del cambio de origen es obligatorio.");
      return;
    }

    if (productOriginDialog.origen === "OTRO" && !origenObservacion) {
      setErrorMessage("Debe explicar el origen cuando selecciona OTRO.");
      return;
    }

    const normalizedNextObservation =
      productOriginDialog.origen === "OTRO" ? origenObservacion : "";

    if (
      product.origen === productOriginDialog.origen &&
      (product.origen_observacion || "").trim() === normalizedNextObservation
    ) {
      setErrorMessage("El producto ya tiene el origen indicado.");
      return;
    }

    try {
      setSavingProductOrigin(true);
      setErrorMessage("");
      setSuccessMessage("");

      const updatedProduct = await changeProductOrigin(product.id, {
        origen: productOriginDialog.origen,
        origen_observacion: normalizedNextObservation,
        motivo,
      });

      setProductOriginDialog(emptyProductOriginDialog);

      setSuccessMessage(
        `Origen de "${updatedProduct.modelo}" cambiado a ${getProductOriginLabel(updatedProduct.origen)} correctamente.`,
      );

      await Promise.all([loadProducts(searchTerm), loadInventorySummary()]);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProductOrigin(false);
    }
  };

  const openProductCategoryDialog = (product: Product) => {
    setProductCategoryDialog({
      open: true,
      product,
      destinationCategory: null,
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const closeProductCategoryDialog = () => {
    if (savingProductCategory) {
      return;
    }

    setProductCategoryDialog(emptyProductCategoryDialog);
  };

  const handleProductCategoryChange = async () => {
    const product = productCategoryDialog.product;
    const destinationCategory = productCategoryDialog.destinationCategory;
    const motivo = productCategoryDialog.motivo.trim();

    if (!product) {
      return;
    }

    if (!destinationCategory) {
      setErrorMessage("Debe seleccionar una categoría destino.");
      return;
    }

    if (!motivo) {
      setErrorMessage("El motivo del cambio de categoría es obligatorio.");
      return;
    }

    if (product.categoria === destinationCategory.id) {
      setErrorMessage("El producto ya pertenece a la categoría indicada.");
      return;
    }

    try {
      setSavingProductCategory(true);
      setErrorMessage("");
      setSuccessMessage("");

      const updatedProduct = await changeProductCategory(product.id, {
        categoria_destino: destinationCategory.id,
        motivo,
      });

      const updatedCategories = await fetchCategories();

      setCategorias(updatedCategories);
      setProductCategoryDialog(emptyProductCategoryDialog);

      setSearchTerm(updatedProduct.modelo);
      setCategoryFilter(String(destinationCategory.id));
      setStatusFilter("");
      setStockControlFilter("");
      setStockStatusFilter("");
      setFiltersOpen(true);

      setSuccessMessage(
        `Producto "${updatedProduct.modelo}" reclasificado a "${destinationCategory.name}" correctamente.`,
      );

      await Promise.all([
        loadProducts({
          search: updatedProduct.modelo,
          category: String(destinationCategory.id),
          status: "",
          stockControl: "",
          stockStatus: "",
        }),
        loadInventorySummary(),
      ]);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingProductCategory(false);
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

  const loadProductKardexPage = async (
    product: Product,
    paginationModel: GridPaginationModel = defaultKardexPaginationModel,
  ) => {
    setKardexDialog((current) => ({
      ...current,
      open: true,
      product,
      paginationModel,
      loading: true,
    }));

    try {
      const movementsPage = await fetchKardexMovementsPage({
        producto: product.id,
        ordering: "-created_at",
        page: paginationModel.page + 1,
        page_size: paginationModel.pageSize,
      });

      setKardexDialog((current) => ({
        ...current,
        open: true,
        product,
        movements: movementsPage.results,
        rowCount: movementsPage.count,
        paginationModel,
        loading: false,
      }));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));

      setKardexDialog((current) => ({
        ...current,
        open: true,
        product,
        movements: [],
        rowCount: 0,
        paginationModel,
        loading: false,
      }));
    }
  };

  const openKardexDialog = (product: Product) => {
    setErrorMessage("");
    setSuccessMessage("");

    void loadProductKardexPage(product, defaultKardexPaginationModel);
  };

  const handleProductKardexPaginationModelChange = (
    nextPaginationModel: GridPaginationModel,
  ) => {
    const product = kardexDialog.product;

    if (!product) {
      return;
    }

    setKardexDialog((current) => ({
      ...current,
      paginationModel: nextPaginationModel,
    }));

    void loadProductKardexPage(product, nextPaginationModel);
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

      await Promise.all([
        loadProducts(searchTerm),
        loadPendingReceipts({
          page: pendingReceiptPaginationModel.page,
          pageSize: pendingReceiptPaginationModel.pageSize,
        }),
      ]);
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
          loadPendingReceipts({
            page: pendingReceiptPaginationModel.page,
            pageSize: pendingReceiptPaginationModel.pageSize,
          }),
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

        await Promise.all([
          loadProducts(searchTerm),
          loadPendingReceipts({
            page: pendingReceiptPaginationModel.page,
            pageSize: pendingReceiptPaginationModel.pageSize,
          }),
        ]);
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

  const kardexColumns = useMemo<GridColDef[]>(() => buildKardexColumns(), []);

  const pendingReceiptColumns = useMemo<GridColDef[]>(
    () =>
      buildPendingReceiptColumns({
        onOpenPendingReceiptOperationDialog: openPendingReceiptOperationDialog,
      }),
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

  const availableCategoryOptions = useMemo(
    () =>
      categorias.filter(
        (category) =>
          category.is_available_for_products &&
          category.id !== productCategoryDialog.product?.categoria,
      ),
    [categorias, productCategoryDialog.product?.categoria],
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
                loadPendingReceipts({
                  page: pendingReceiptPaginationModel.page,
                  pageSize: pendingReceiptPaginationModel.pageSize,
                });
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

      <PendingReceiptsSection
        sectionRef={pendingReceiptsSectionRef}
        pendingReceipts={pendingReceipts}
        columns={pendingReceiptColumns}
        loading={pendingReceiptsLoading}
        searchTerm={pendingReceiptSearchTerm}
        onSearchTermChange={setPendingReceiptSearchTerm}
        statusFilter={pendingReceiptStatusFilter}
        onStatusFilterChange={setPendingReceiptStatusFilter}
        onSearch={handleSearchPendingReceipts}
        onClearFilters={handleClearPendingReceiptFilters}
        paginationModel={pendingReceiptPaginationModel}
        onPaginationModelChange={handlePendingReceiptPaginationModelChange}
        rowCount={pendingReceiptRowCount}
      />

      <GlobalKardexSection
        hasLoaded={hasLoadedGlobalKardex}
        movements={globalKardexMovements}
        columns={kardexColumns}
        loading={globalKardexLoading}
        searchTerm={globalKardexSearchTerm}
        onSearchTermChange={setGlobalKardexSearchTerm}
        movementType={globalKardexMovementType}
        onMovementTypeChange={setGlobalKardexMovementType}
        origin={globalKardexOrigin}
        onOriginChange={setGlobalKardexOrigin}
        onSearch={handleSearchGlobalKardex}
        onClearFilters={handleClearGlobalKardexFilters}
        paginationModel={globalKardexPaginationModel}
        onPaginationModelChange={handleGlobalKardexPaginationModelChange}
        rowCount={globalKardexRowCount}
      />

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

      <PendingReceiptDialogs
        createOpen={pendingReceiptCreateDialog.open}
        createProduct={pendingReceiptCreateDialog.product}
        createCantidad={pendingReceiptCreateDialog.cantidad}
        createReferencia={pendingReceiptCreateDialog.referencia}
        createMotivo={pendingReceiptCreateDialog.motivo}
        operationOpen={pendingReceiptOperationDialog.open}
        operationMode={pendingReceiptOperationDialog.mode}
        operationPendingReceipt={pendingReceiptOperationDialog.pendingReceipt}
        operationCantidad={pendingReceiptOperationDialog.cantidad}
        operationMotivo={pendingReceiptOperationDialog.motivo}
        saving={savingPendingReceipt}
        onCreateCantidadChange={(cantidad) =>
          setPendingReceiptCreateDialog((current) => ({
            ...current,
            cantidad,
          }))
        }
        onCreateReferenciaChange={(referencia) =>
          setPendingReceiptCreateDialog((current) => ({
            ...current,
            referencia,
          }))
        }
        onCreateMotivoChange={(motivo) =>
          setPendingReceiptCreateDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onCreateClose={closePendingReceiptCreateDialog}
        onCreateConfirm={() => void handleCreatePendingReceipt()}
        onOperationCantidadChange={(cantidad) =>
          setPendingReceiptOperationDialog((current) => ({
            ...current,
            cantidad,
          }))
        }
        onOperationMotivoChange={(motivo) =>
          setPendingReceiptOperationDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onOperationClose={closePendingReceiptOperationDialog}
        onOperationConfirm={() => void handlePendingReceiptOperation()}
      />

      <StockMovementDialog
        open={movementDialog.open}
        mode={movementDialog.mode}
        product={movementDialog.product}
        cantidad={movementDialog.cantidad}
        motivo={movementDialog.motivo}
        saving={savingMovement}
        onCantidadChange={(cantidad) =>
          setMovementDialog((current) => ({
            ...current,
            cantidad,
          }))
        }
        onMotivoChange={(motivo) =>
          setMovementDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onClose={closeMovementDialog}
        onConfirm={() => void handleSaveMovement()}
      />

      <ProductKardexDialog
        open={kardexDialog.open}
        product={kardexDialog.product}
        movements={kardexDialog.movements}
        columns={kardexColumns}
        loading={kardexDialog.loading}
        rowCount={kardexDialog.rowCount}
        paginationModel={kardexDialog.paginationModel}
        onPaginationModelChange={handleProductKardexPaginationModelChange}
        onClose={closeKardexDialog}
      />

      <ProductLifecycleDialog
        open={productLifecycleDialog.open}
        product={productLifecycleDialog.product}
        action={productLifecycleDialog.action}
        motivo={productLifecycleDialog.motivo}
        saving={savingProductLifecycle}
        onMotivoChange={(motivo) =>
          setProductLifecycleDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onClose={closeProductLifecycleDialog}
        onConfirm={() => void handleProductLifecycle()}
      />

      <ProductOriginChangeDialog
        open={productOriginDialog.open}
        product={productOriginDialog.product}
        origin={productOriginDialog.origen}
        originObservation={productOriginDialog.origen_observacion}
        motivo={productOriginDialog.motivo}
        saving={savingProductOrigin}
        onOriginChange={(origen) =>
          setProductOriginDialog((current) => ({
            ...current,
            origen,
            origen_observacion:
              origen === "OTRO" ? current.origen_observacion : "",
          }))
        }
        onOriginObservationChange={(origen_observacion) =>
          setProductOriginDialog((current) => ({
            ...current,
            origen_observacion,
          }))
        }
        onMotivoChange={(motivo) =>
          setProductOriginDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onClose={closeProductOriginDialog}
        onConfirm={() => void handleProductOriginChange()}
      />

      <ProductCategoryChangeDialog
        open={productCategoryDialog.open}
        product={productCategoryDialog.product}
        destinationCategory={productCategoryDialog.destinationCategory}
        availableCategories={availableCategoryOptions}
        motivo={productCategoryDialog.motivo}
        saving={savingProductCategory}
        onDestinationCategoryChange={(destinationCategory) =>
          setProductCategoryDialog((current) => ({
            ...current,
            destinationCategory,
          }))
        }
        onMotivoChange={(motivo) =>
          setProductCategoryDialog((current) => ({
            ...current,
            motivo,
          }))
        }
        onClose={closeProductCategoryDialog}
        onConfirm={() => void handleProductCategoryChange()}
      />

      <CategoryManagerDialog
        open={categoryManagerOpen}
        categories={categorias}
        onClose={handleCloseCategoryManager}
        onCategoriesChanged={handleCategoriesChanged}
        onError={setErrorMessage}
        onClearFeedback={handleClearCategoryManagerFeedback}
        onOpenProductInCatalog={handleOpenProductFromCategoryManager}
      />

      <ProductActionMenus
        inventoryAnchorEl={inventoryActionMenu.anchorEl}
        inventoryProduct={inventoryMenuProduct}
        inventoryCanRegisterManualEntry={inventoryMenuCanRegisterManualEntry}
        inventoryCanAdjustStock={inventoryMenuCanAdjustStock}
        inventoryCanRegisterPendingReceipt={
          inventoryMenuCanRegisterPendingReceipt
        }
        moreAnchorEl={moreActionMenu.anchorEl}
        moreProduct={moreActionProduct}
        moreIsOperationallyActive={moreActionIsOperationallyActive}
        moreCanInactivate={moreActionCanInactivate}
        onClose={closeProductActionMenus}
        onOpenMovementDialog={openMovementDialog}
        onOpenPendingReceiptCreateDialog={openPendingReceiptCreateDialog}
        onFocusPendingReceipts={focusPendingReceipts}
        onOpenKardexDialog={openKardexDialog}
        onOpenEditProduct={handleOpenEditProduct}
        onOpenProductOriginDialog={openProductOriginDialog}
        onOpenProductCategoryDialog={openProductCategoryDialog}
        onOpenProductLifecycleDialog={openProductLifecycleDialog}
      />
    </Box>
  );
}
