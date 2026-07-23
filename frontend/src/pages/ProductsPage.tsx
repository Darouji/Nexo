import AddIcon from "@mui/icons-material/Add";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Alert, Button } from "@mui/material";
import { PageShell } from "../components/PageShell";
import { CategoryManagerDialog } from "../features/inventory/categories/CategoryManagerDialog";
import { colors } from "../theme/colors";
import { getAvailableProductCategoryOptions } from "../features/inventory/categories/categoryOptions";
import { GlobalKardexSection } from "../features/inventory/components/GlobalKardexSection";
import { InventoryCatalogSection } from "../features/inventory/components/InventoryCatalogSection";
import { PendingReceiptDialogs } from "../features/inventory/components/PendingReceiptDialogs";
import { PendingReceiptsSection } from "../features/inventory/components/PendingReceiptsSection";
import { ProductActionMenus } from "../features/inventory/components/ProductActionMenus";
import { ProductCategoryChangeDialog } from "../features/inventory/components/ProductCategoryChangeDialog";
import { ProductKardexDialog } from "../features/inventory/components/ProductKardexDialog";
import { ProductLifecycleDialog } from "../features/inventory/components/ProductLifecycleDialog";
import { ProductOriginChangeDialog } from "../features/inventory/components/ProductOriginChangeDialog";
import { StockMovementDialog } from "../features/inventory/components/StockMovementDialog";
import { buildKardexColumns } from "../features/inventory/kardex/kardexColumns";
import { buildGlobalKardexColumns } from "../features/inventory/kardex/globalKardexColumns";
import { buildPendingReceiptColumns } from "../features/inventory/pendingReceipts/pendingReceiptColumns";
import { getProductActionMenuPermissions } from "../features/inventory/products/productActionPermissions";
import { buildProductCatalogColumns } from "../features/inventory/products/productCatalogColumns";
import { ProductDialog } from "../features/inventory/products/ProductDialog";
import {
  formatNumber,
  parseInteger,
} from "../features/inventory/utils/inventoryFormatters";
import {
  buildKardexMovementPageParams,
  buildPendingReceiptPageParams,
  buildProductPageParams,
} from "../features/inventory/utils/inventoryQueryParams";
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
  fetchPendingReceiptsPage,
  exportProducts,
  receivePendingReceipt,
  registerInventoryAdjustment,
  registerManualStockEntry,
  updateProduct,
} from "../services/inventoryService";
import { getStoredAccess } from "../services/authService";

import type {
  SerkanGridPaginationModel,
  SerkanGridSortModel,
} from "../components/SerkanDataGrid";
import type {
  AuditOrigin,
  Category,
  InventorySummary,
  KardexMovement,
  PendingReceipt,
  PendingReceiptStatus,
  Product,
  ProductLifecycleAction,
} from "../services/inventoryService";
import { useProductCatalogController } from "../features/inventory/products/useProductCatalogController";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  emptyProductForm,
  findCategoryByInputName,
  getProductOriginLabel,
  type ProductFormState,
} from "../features/inventory/products/productFormModel";
import {
  defaultKardexPaginationModel,
  defaultKardexSortModel,
  defaultPendingReceiptPaginationModel,
  emptyInventorySummary,
  emptyKardexDialog,
  emptyMovementDialog,
  emptyPendingReceiptCreateDialog,
  emptyPendingReceiptOperationDialog,
  emptyProductActionMenu,
  emptyProductCategoryDialog,
  emptyProductLifecycleDialog,
  emptyProductOriginDialog,
  type KardexDialogState,
  type KardexFilterOverrides,
  type MovementDialogState,
  type PendingReceiptCreateDialogState,
  type PendingReceiptFilterOverrides,
  type PendingReceiptOperationDialogState,
  type PendingReceiptOperationMode,
  type ProductActionMenuState,
  type ProductCategoryDialogState,
  type ProductLifecycleDialogState,
  type ProductOriginDialogState,
} from "../features/inventory/state/inventoryPageState";

export function ProductsPage() {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const {
    products: productos,
    rowCount: productRowCount,
    paginationModel: productPaginationModel,
    sortModel: productSortModel,
    ordering: productOrdering,
    columnFilters: productColumnFilters,
    filterResetKey: productFilterResetKey,
    visibleColumns: visibleProductColumns,
    setVisibleColumns: setVisibleProductColumns,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    stockControlFilter,
    setStockControlFilter,
    stockStatusFilter,
    setStockStatusFilter,
    filtersOpen,
    setFiltersOpen,
    loading,
    activeFiltersCount: activeProductFiltersCount,
    loadProducts,
    loadFirstPage: loadFirstProductPage,
    changePagination: handleProductPaginationModelChange,
    changeSort: handleProductSortModelChange,
    changeColumnFilters: handleProductColumnFiltersChange,
    clearFilters: clearProductCatalogFilters,
  } = useProductCatalogController({ onError: setErrorMessage });

  const [exportingProducts, setExportingProducts] = useState(false);

  const [inventorySummary, setInventorySummary] = useState<InventorySummary>(
    emptyInventorySummary,
  );
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
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
    useState<SerkanGridPaginationModel>(defaultKardexPaginationModel);
  const [globalKardexSortModel, setGlobalKardexSortModel] =
    useState<SerkanGridSortModel>({
      field: "created_at",
      direction: "desc",
    });

  const [globalKardexOrdering, setGlobalKardexOrdering] =
    useState("-created_at");

  const [globalKardexSearchTerm, setGlobalKardexSearchTerm] = useState("");
  const [globalKardexMovementType, setGlobalKardexMovementType] = useState("");
  const [globalKardexOrigin, setGlobalKardexOrigin] = useState<
    AuditOrigin | ""
  >("");
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [pendingReceiptsLoading, setPendingReceiptsLoading] = useState(true);
  const [pendingReceiptRowCount, setPendingReceiptRowCount] = useState(0);
  const [pendingReceiptPaginationModel, setPendingReceiptPaginationModel] =
    useState<SerkanGridPaginationModel>(defaultPendingReceiptPaginationModel);
  const [pendingReceiptSortModel, setPendingReceiptSortModel] =
    useState<SerkanGridSortModel>({
      field: "created_at",
      direction: "desc",
    });

  const [pendingReceiptOrdering, setPendingReceiptOrdering] =
    useState("-created_at");
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

  const loadGlobalKardex = async (filters: KardexFilterOverrides = {}) => {
    try {
      setGlobalKardexLoading(true);
      setErrorMessage("");

      const movementsPage = await fetchKardexMovementsPage(
        buildKardexMovementPageParams(filters, {
          searchTerm: globalKardexSearchTerm,
          movementType: globalKardexMovementType,
          origin: globalKardexOrigin,
          ordering: globalKardexOrdering,
          paginationModel: globalKardexPaginationModel,
        }),
      );

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
    nextPaginationModel: SerkanGridPaginationModel,
  ) => {
    setGlobalKardexPaginationModel(nextPaginationModel);

    void loadGlobalKardex({
      page: nextPaginationModel.page,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handleGlobalKardexSortModelChange = (
    nextSortModel: SerkanGridSortModel,
  ) => {
    const nextOrdering = nextSortModel
      ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
      : "-created_at";

    const nextPaginationModel = {
      ...globalKardexPaginationModel,
      page: 0,
    };

    setGlobalKardexSortModel(nextSortModel);
    setGlobalKardexOrdering(nextOrdering);
    setGlobalKardexPaginationModel(nextPaginationModel);

    void loadGlobalKardex({
      ordering: nextOrdering,
      page: 0,
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
    try {
      setPendingReceiptsLoading(true);
      setErrorMessage("");

      const pendingReceiptsPage = await fetchPendingReceiptsPage(
        buildPendingReceiptPageParams(filters, {
          searchTerm: pendingReceiptSearchTerm,
          statusFilter: pendingReceiptStatusFilter,
          ordering: pendingReceiptOrdering,
          paginationModel: pendingReceiptPaginationModel,
        }),
      );

      setPendingReceipts(pendingReceiptsPage.results);
      setPendingReceiptRowCount(pendingReceiptsPage.count);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingReceiptsLoading(false);
    }
  };

  const handlePendingReceiptPaginationModelChange = (
    nextPaginationModel: SerkanGridPaginationModel,
  ) => {
    setPendingReceiptPaginationModel(nextPaginationModel);

    void loadPendingReceipts({
      page: nextPaginationModel.page,
      pageSize: nextPaginationModel.pageSize,
    });
  };

  const handlePendingReceiptSortModelChange = (
    nextSortModel: SerkanGridSortModel,
  ) => {
    const nextOrdering = nextSortModel
      ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
      : "-created_at";

    const nextPaginationModel = {
      ...pendingReceiptPaginationModel,
      page: 0,
    };

    setPendingReceiptSortModel(nextSortModel);
    setPendingReceiptOrdering(nextOrdering);
    setPendingReceiptPaginationModel(nextPaginationModel);

    void loadPendingReceipts({
      ordering: nextOrdering,
      page: 0,
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
      fetchCategories(),
      fetchPendingReceiptsPage({
        ordering: "-created_at",
        page: 1,
        page_size: defaultPendingReceiptPaginationModel.pageSize,
      }),
      fetchInventorySummary(),
    ])
      .then(
        ([categoriesData, pendingReceiptsData, summaryData]) => {
          if (!isMounted) {
            return;
          }

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

        setPendingReceiptsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
      codigo_sap_motivo: "",
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
        await updateProduct(editingProduct.id, {
          ...editableProductPayload,
          motivo_codigo_sap: productForm.codigo_sap_motivo.trim() || undefined,
        });

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
    paginationModel: SerkanGridPaginationModel = defaultKardexPaginationModel,
    ordering = "-created_at",
    sortModel: SerkanGridSortModel = defaultKardexSortModel,
  ) => {
    setKardexDialog((current) => ({
      ...current,
      open: true,
      product,
      paginationModel,
      sortModel,
      ordering,
      loading: true,
    }));

    try {
      const movementsPage = await fetchKardexMovementsPage({
        producto: product.id,
        ordering,
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
        sortModel,
        ordering,
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
        sortModel,
        ordering,
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
    nextPaginationModel: SerkanGridPaginationModel,
  ) => {
    const product = kardexDialog.product;

    if (!product) {
      return;
    }

    setKardexDialog((current) => ({
      ...current,
      paginationModel: nextPaginationModel,
    }));

    void loadProductKardexPage(
      product,
      nextPaginationModel,
      kardexDialog.ordering,
      kardexDialog.sortModel,
    );
  };

  const handleProductKardexSortModelChange = (
    nextSortModel: SerkanGridSortModel,
  ) => {
    const product = kardexDialog.product;

    if (!product) {
      return;
    }

    const nextOrdering = nextSortModel
      ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
      : "-created_at";

    const nextPaginationModel = {
      ...kardexDialog.paginationModel,
      page: 0,
    };

    setKardexDialog((current) => ({
      ...current,
      paginationModel: nextPaginationModel,
      sortModel: nextSortModel,
      ordering: nextOrdering,
    }));

    void loadProductKardexPage(
      product,
      nextPaginationModel,
      nextOrdering,
      nextSortModel,
    );
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

  const columns = useMemo(
    () =>
      buildProductCatalogColumns({
        onOpenInventoryActionMenu: openInventoryActionMenu,
        onOpenMoreActionMenu: openMoreActionMenu,
      }),
    [openInventoryActionMenu, openMoreActionMenu],
  );

  const kardexColumns = useMemo(() => buildKardexColumns(), []);
  const globalKardexColumns = useMemo(() => buildGlobalKardexColumns(), []);

  const pendingReceiptColumns = useMemo(
    () =>
      buildPendingReceiptColumns({
        onOpenPendingReceiptOperationDialog: openPendingReceiptOperationDialog,
      }),
    [openPendingReceiptOperationDialog],
  );

  const {
    inventoryProduct: inventoryMenuProduct,
    inventoryCanRegisterManualEntry: inventoryMenuCanRegisterManualEntry,
    inventoryCanAdjustStock: inventoryMenuCanAdjustStock,
    inventoryCanRegisterPendingReceipt: inventoryMenuCanRegisterPendingReceipt,
    moreProduct: moreActionProduct,
    moreIsOperationallyActive: moreActionIsOperationallyActive,
    moreCanInactivate: moreActionCanInactivate,
  } = useMemo(
    () =>
      getProductActionMenuPermissions({
        inventoryProduct: inventoryActionMenu.product,
        moreProduct: moreActionMenu.product,
      }),
    [inventoryActionMenu.product, moreActionMenu.product],
  );

  const availableCategoryOptions = useMemo(
    () =>
      getAvailableProductCategoryOptions(
        categorias,
        productCategoryDialog.product?.categoria,
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
    clearProductCatalogFilters();
  };

  const handleOpenCategoryManager = () => {
    setCategoryManagerOpen(true);
  };

  const handleExportProducts = async (mode: "view" | "official") => {
    try {
      setExportingProducts(true);
      setErrorMessage("");

      const queryParams = buildProductPageParams(
        {},
        {
          searchTerm,
          categoryFilter,
          statusFilter,
          stockControlFilter,
          stockStatusFilter,
          ordering: productOrdering,
          paginationModel: productPaginationModel,
          columnFilters: productColumnFilters,
        },
      );

      const { blob, filename } = await exportProducts({
        ...queryParams,
        mode,
        file_format: "xlsx",
        columns: mode === "view" ? visibleProductColumns : undefined,
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccessMessage(
        mode === "official"
          ? "Exportación oficial generada correctamente."
          : "La vista actual se exportó correctamente.",
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "No se pudo exportar el catálogo."));
    } finally {
      setExportingProducts(false);
    }
  };

  const canExportOfficial = Boolean(
    getStoredAccess()?.permissions?.grid_labels?.can_update,
  );

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
    <PageShell
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
    >

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
        productSortModel={productSortModel}
        onProductSortModelChange={handleProductSortModelChange}
        onProductColumnFiltersChange={handleProductColumnFiltersChange}
        productFilterResetKey={productFilterResetKey}
        onVisibleColumnsChange={setVisibleProductColumns}
        exporting={exportingProducts}
        canExportOfficial={canExportOfficial}
        onExportView={() => void handleExportProducts("view")}
        onExportOfficial={() => void handleExportProducts("official")}
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
        sortModel={pendingReceiptSortModel}
        onSortModelChange={handlePendingReceiptSortModelChange}
      />

      <GlobalKardexSection
        hasLoaded={hasLoadedGlobalKardex}
        movements={globalKardexMovements}
        columns={globalKardexColumns}
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
        sortModel={globalKardexSortModel}
        onSortModelChange={handleGlobalKardexSortModelChange}
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
        sortModel={kardexDialog.sortModel}
        onSortModelChange={handleProductKardexSortModelChange}
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
    </PageShell>
  );
}
