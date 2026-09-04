/**
 * Controlador de estado y consultas del catálogo de productos.
 *
 * Mantiene la página como una capa de composición: concentra filtros, paginación,
 * orden remoto, vistas nombradas y cancelación de solicitudes, mientras el backend
 * conserva la validación y las reglas de negocio del producto.
 */
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  NexoGridFilter,
  NexoGridPaginationModel,
  NexoGridSortModel,
} from "../../../components/NexoDataGrid";
import { getApiErrorMessage } from "../../../services/api";
import type { SavedGridViewConfig } from "../../../services/gridService";
import {
  fetchProductsPage,
  type Product,
  type ProductStockStatus,
} from "../../../services/inventoryService";
import {
  defaultProductPaginationModel,
  type ProductFilterOverrides,
} from "../state/inventoryPageState";
import { buildProductPageParams } from "../utils/inventoryQueryParams";


type ProductCatalogControllerOptions = {
  onError: (message: string) => void;
  enabled?: boolean;
};


export function useProductCatalogController({
  onError,
  enabled = true,
}: ProductCatalogControllerOptions) {
  const [products, setProducts] = useState<Product[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] =
    useState<NexoGridPaginationModel>(defaultProductPaginationModel);
  const [sortModel, setSortModel] = useState<NexoGridSortModel>({
    field: "categoria__name",
    direction: "asc",
  });
  const [ordering, setOrdering] = useState("categoria__name,modelo");
  const [columnFilters, setColumnFilters] = useState<NexoGridFilter[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["ACTIVO"]);
  const [stockControlFilter, setStockControlFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    ProductStockStatus[]
  >([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(enabled);

  // La cancelación reduce trabajo innecesario y la secuencia evita que una respuesta
  // antigua sobrescriba el resultado de filtros aplicados posteriormente.
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadProducts = useCallback(
    async (
      searchOrFilters: string | ProductFilterOverrides = searchTerm,
    ) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const requestSequence = ++requestSequenceRef.current;

      try {
        setLoading(true);
        onError("");

        const data = await fetchProductsPage(
          buildProductPageParams(searchOrFilters, {
            searchTerm,
            categoryFilter,
            statusFilter,
            stockControlFilter,
            stockStatusFilter,
            ordering,
            paginationModel,
            columnFilters,
          }),
          abortController.signal,
        );

        if (requestSequence !== requestSequenceRef.current) {
          return;
        }

        setProducts(data.results);
        setRowCount(data.count);
      } catch (error: unknown) {
        if (!axios.isCancel(error)) {
          onError(getApiErrorMessage(error));
        }
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [
      categoryFilter,
      columnFilters,
      onError,
      ordering,
      paginationModel,
      searchTerm,
      statusFilter,
      stockControlFilter,
      stockStatusFilter,
    ],
  );

  // La carga inicial usa explícitamente la vista operativa predeterminada: productos
  // activos, primera página y orden estable por categoría y modelo.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestSequence = ++requestSequenceRef.current;

    void fetchProductsPage(
      {
        search: "",
        ordering: "categoria__name,modelo",
        status: "ACTIVO",
        page: 1,
        page_size: defaultProductPaginationModel.pageSize,
      },
      abortController.signal,
    )
      .then((data) => {
        if (requestSequence === requestSequenceRef.current) {
          setProducts(data.results);
          setRowCount(data.count);
          onError("");
        }
      })
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          onError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      });

    return () => abortController.abort();
  }, [enabled, onError]);

  const loadFirstPage = useCallback(
    (filters: ProductFilterOverrides = {}) => {
      const nextPaginationModel = { ...paginationModel, page: 0 };
      setPaginationModel(nextPaginationModel);
      void loadProducts({
        ...filters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadProducts, paginationModel],
  );

  const changePagination = useCallback(
    (nextPaginationModel: NexoGridPaginationModel) => {
      setPaginationModel(nextPaginationModel);
      void loadProducts({
        page: nextPaginationModel.page,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadProducts],
  );

  const changeSort = useCallback(
    (nextSortModel: NexoGridSortModel) => {
      const nextOrdering = nextSortModel
        ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
        : "categoria__name,modelo";
      const nextPaginationModel = { ...paginationModel, page: 0 };

      setSortModel(nextSortModel);
      setOrdering(nextOrdering);
      setPaginationModel(nextPaginationModel);
      void loadProducts({
        ordering: nextOrdering,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadProducts, paginationModel],
  );

  const changeColumnFilters = useCallback(
    (nextFilters: NexoGridFilter[]) => {
      const nextPaginationModel = { ...paginationModel, page: 0 };

      setColumnFilters(nextFilters);
      setPaginationModel(nextPaginationModel);
      void loadProducts({
        columnFilters: nextFilters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadProducts, paginationModel],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setCategoryFilter([]);
    setStatusFilter(["ACTIVO"]);
    setStockControlFilter("");
    setStockStatusFilter([]);
    setFiltersOpen(false);
    setColumnFilters([]);
    setFilterResetKey((current) => current + 1);
    loadFirstPage({
      search: "",
      category: [],
      status: ["ACTIVO"],
      stockControl: "",
      stockStatus: [],
      columnFilters: [],
    });
  }, [loadFirstPage]);

  /**
   * Restaura una vista nombrada como una operación atómica de interfaz: primero
   * reconstruye todos sus filtros y luego solicita la primera página con ese mismo
   * estado, evitando mezclar valores guardados con filtros anteriores de la pantalla.
   */
  const applyNamedView = useCallback(
    (config: SavedGridViewConfig) => {
      const readFilter = (key: string) => {
        const value = config.filters[key];
        return typeof value === "string" ? value : "";
      };
      const readMultiFilter = (key: string, fallback: string[] = []) => {
        const value = config.filters[key];


        if (typeof value === "string" && value) {
          return value.split(",").filter(Boolean);
        }

        return fallback;
      };
      const savedColumnFilters = config.filters.column_filters;
      const nextColumnFilters = Array.isArray(savedColumnFilters)
        ? (savedColumnFilters as NexoGridFilter[])
        : [];
      const nextSortModel = config.sort;
      const nextOrdering = nextSortModel
        ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
        : "categoria__name,modelo";
      const nextSearch = readFilter("search");
      const nextCategory = readMultiFilter("category");
      const nextStatus = readMultiFilter("status", ["ACTIVO"]);
      const nextStockControl = readFilter("stock_control");
      const nextStockStatus = readMultiFilter(
        "stock_status",
      ) as ProductStockStatus[];
      const nextPaginationModel = {
        page: 0,
        pageSize: config.page_size,
      };

      setSearchTerm(nextSearch);
      setCategoryFilter(nextCategory);
      setStatusFilter(nextStatus);
      setStockControlFilter(nextStockControl);
      setStockStatusFilter(nextStockStatus);
      setColumnFilters(nextColumnFilters);
      setSortModel(nextSortModel);
      setOrdering(nextOrdering);
      setPaginationModel(nextPaginationModel);
      setFiltersOpen(
        Boolean(
          nextCategory.length ||
            (nextStatus.length !== 1 || nextStatus[0] !== "ACTIVO") ||
            nextStockControl ||
            nextStockStatus.length ||
            nextColumnFilters.length,
        ),
      );

      void loadProducts({
        search: nextSearch,
        category: nextCategory,
        status: nextStatus,
        stockControl: nextStockControl,
        stockStatus: nextStockStatus,
        ordering: nextOrdering,
        columnFilters: nextColumnFilters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadProducts],
  );

  // El estado ACTIVO es la vista base y no se contabiliza como filtro adicional.
  const activeFiltersCount = useMemo(
    () =>
      Number(categoryFilter.length > 0) +
      Number(
        statusFilter.length !== 1 || statusFilter[0] !== "ACTIVO",
      ) +
      Number(Boolean(stockControlFilter)) +
      Number(stockStatusFilter.length > 0) +
      columnFilters.length,
    [
      categoryFilter,
      columnFilters.length,
      statusFilter,
      stockControlFilter,
      stockStatusFilter,
    ],
  );

  return {
    products,
    rowCount,
    paginationModel,
    sortModel,
    ordering,
    columnFilters,
    filterResetKey,
    visibleColumns,
    setVisibleColumns,
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
    activeFiltersCount,
    loadProducts,
    loadFirstPage,
    changePagination,
    changeSort,
    changeColumnFilters,
    clearFilters,
    applyNamedView,
  };
}
