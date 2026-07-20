import type { GridPaginationModel } from "@mui/x-data-grid";
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
  paginationModel: GridPaginationModel;
};

type KardexQueryState = {
  searchTerm: string;
  movementType: string;
  origin: AuditOrigin | "";
  paginationModel: GridPaginationModel;
};

type PendingReceiptQueryState = {
  searchTerm: string;
  statusFilter: PendingReceiptStatus | "";
  ordering: string;
  paginationModel: GridPaginationModel;
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

  return {
    search: resolvedSearch,
    ordering: resolvedOrdering,
    categoria: resolvedCategory ? Number(resolvedCategory) : undefined,
    status: resolvedStatus || undefined,
    controla_stock: parseOptionalBoolean(resolvedStockControl),
    stock_status: resolvedStockStatus || undefined,
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
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    search: resolvedSearch,
    movement_type: resolvedMovementType || undefined,
    origin: resolvedOrigin || undefined,
    producto: filters.product,
    ordering: "-created_at",
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
  const resolvedOrdering = filters.ordering ?? state.ordering;
  const resolvedPage = filters.page ?? state.paginationModel.page;
  const resolvedPageSize = filters.pageSize ?? state.paginationModel.pageSize;

  return {
    ordering: resolvedOrdering,
    search: resolvedSearch,
    estado: resolvedStatus || undefined,
    page: resolvedPage + 1,
    page_size: resolvedPageSize,
  };
}
