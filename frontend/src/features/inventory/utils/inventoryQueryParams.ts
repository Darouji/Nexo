/**
 * Traduce el estado visual de las grillas de Inventario al contrato de consulta
 * del backend. Centralizar esta conversión mantiene consistentes la búsqueda,
 * paginación, orden y filtros remotos entre cargas iniciales, vistas nombradas y
 * cambios interactivos del usuario.
 */
import type {
  SerkanGridFilter,
  SerkanGridPaginationModel,
} from "../../../components/SerkanDataGrid";
import type {
  AuditOrigin,
  PendingReceiptStatus,
  ProductListParams,
  ProductStockStatus,
} from "../../../services/inventoryService";
import type {
  KardexFilterOverrides,
  PendingReceiptFilterOverrides,
  ProductFilterOverrides,
} from "../state/inventoryPageState";
import { parseOptionalBoolean } from "./inventoryFormatters";

type ProductQueryState = {
  searchTerm: string;
  categoryFilter: string[];
  statusFilter: string[];
  stockControlFilter: string;
  stockStatusFilter: ProductStockStatus[];
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
  columnFilters: SerkanGridFilter[];
};

type KardexQueryState = {
  searchTerm: string;
  movementType: string[];
  origin: AuditOrigin[];
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
  columnFilters: SerkanGridFilter[];
};

type PendingReceiptQueryState = {
  searchTerm: string;
  statusFilter: PendingReceiptStatus[];
  dateFrom: string;
  dateTo: string;
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
  columnFilters: SerkanGridFilter[];
};

/**
 * Combina el estado persistente de la pantalla con cambios puntuales. Los
 * overrides permiten solicitar, por ejemplo, la primera página con un filtro
 * recién aplicado sin esperar a que React confirme todos los estados locales.
 */
export function buildProductPageParams(
  searchOrFilters: string | ProductFilterOverrides,
  state: ProductQueryState,
): ProductListParams & { page: number; page_size: number } {
  const filters =
    typeof searchOrFilters === "string"
      ? { search: searchOrFilters }
      : searchOrFilters;

  const resolvedSearch = filters.search ?? state.searchTerm;
  const resolvedCategory = filters.category ?? state.categoryFilter;
  const resolvedStatus = filters.status ?? state.statusFilter;
  const resolvedStockControl = filters.stockControl ?? state.stockControlFilter;
  const resolvedStockStatus = filters.stockStatus ?? state.stockStatusFilter;
  const resolvedOrdering = filters.ordering ?? state.ordering;
  const resolvedColumnFilters = filters.columnFilters ?? state.columnFilters;
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    search: resolvedSearch,
    ordering: resolvedOrdering,
    categoria:
      resolvedCategory.length > 0
        ? resolvedCategory.map(Number).join(",")
        : undefined,
    status:
      resolvedStatus.length > 0 ? resolvedStatus.join(",") : undefined,
    controla_stock: parseOptionalBoolean(resolvedStockControl),
    stock_status:
      resolvedStockStatus.length > 0
        ? resolvedStockStatus.join(",")
        : undefined,
    grid_filters:
      resolvedColumnFilters.length > 0
        ? JSON.stringify(resolvedColumnFilters)
        : undefined,
    // AG Grid numera desde cero; la API paginada de Django comienza en uno.
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}

/** Construye la consulta paginada del libro global e inmutable de movimientos. */
export function buildKardexMovementPageParams(
  filters: KardexFilterOverrides,
  state: KardexQueryState,
) {
  const resolvedSearch = filters.search ?? state.searchTerm;
  const resolvedMovementType = filters.movementType ?? state.movementType;
  const resolvedOrigin = filters.origin ?? state.origin;
  const resolvedOrdering = filters.ordering ?? state.ordering;
  const resolvedColumnFilters = filters.columnFilters ?? state.columnFilters;
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    search: resolvedSearch,
    movement_type:
      resolvedMovementType.length > 0
        ? resolvedMovementType.join(",")
        : undefined,
    origin: resolvedOrigin.length > 0 ? resolvedOrigin.join(",") : undefined,
    producto: filters.product,
    grid_filters:
      resolvedColumnFilters.length > 0
        ? JSON.stringify(resolvedColumnFilters)
        : undefined,
    ordering: resolvedOrdering,
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}

/**
 * Conserva como opcionales los filtros vacíos para que el backend distinga una
 * consulta sin restricción de una fecha o estado efectivamente seleccionado.
 */
export function buildPendingReceiptPageParams(
  filters: PendingReceiptFilterOverrides,
  state: PendingReceiptQueryState,
) {
  const resolvedSearch = filters.search ?? state.searchTerm;
  const resolvedStatus = filters.status ?? state.statusFilter;
  const resolvedDateFrom = filters.dateFrom ?? state.dateFrom;
  const resolvedDateTo = filters.dateTo ?? state.dateTo;
  const resolvedOrdering = filters.ordering ?? state.ordering;
  const resolvedColumnFilters = filters.columnFilters ?? state.columnFilters;
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    ordering: resolvedOrdering,
    search: resolvedSearch,
    estado: resolvedStatus.length > 0 ? resolvedStatus.join(",") : undefined,
    fecha_desde: resolvedDateFrom || undefined,
    fecha_hasta: resolvedDateTo || undefined,
    grid_filters:
      resolvedColumnFilters.length > 0
        ? JSON.stringify(resolvedColumnFilters)
        : undefined,
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}
