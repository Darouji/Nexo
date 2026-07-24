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
  categoryFilter: string;
  statusFilter: string;
  stockControlFilter: string;
  stockStatusFilter: ProductStockStatus | "";
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
  columnFilters: SerkanGridFilter[];
};

type KardexQueryState = {
  searchTerm: string;
  movementType: string;
  origin: AuditOrigin | "";
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
};

type PendingReceiptQueryState = {
  searchTerm: string;
  statusFilter: PendingReceiptStatus | "";
  dateFrom: string;
  dateTo: string;
  ordering: string;
  paginationModel: SerkanGridPaginationModel;
  columnFilters: SerkanGridFilter[];
};

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
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;
  const resolvedColumnFilters = filters.columnFilters ?? state.columnFilters;

  return {
    search: resolvedSearch,
    ordering: resolvedOrdering,
    categoria: resolvedCategory ? Number(resolvedCategory) : undefined,
    status: resolvedStatus || undefined,
    controla_stock: parseOptionalBoolean(resolvedStockControl),
    stock_status: resolvedStockStatus || undefined,
    grid_filters:
      resolvedColumnFilters.length > 0
        ? JSON.stringify(resolvedColumnFilters)
        : undefined,
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}

export function buildKardexMovementPageParams(
  filters: KardexFilterOverrides,
  state: KardexQueryState,
) {
  const resolvedSearch = filters.search ?? state.searchTerm;
  const resolvedMovementType = filters.movementType ?? state.movementType;
  const resolvedOrigin = filters.origin ?? state.origin;
  const resolvedOrdering = filters.ordering ?? state.ordering;
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    search: resolvedSearch,
    movement_type: resolvedMovementType || undefined,
    origin: resolvedOrigin || undefined,
    producto: filters.product,
    ordering: resolvedOrdering,
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}

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
    estado: resolvedStatus || undefined,
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
