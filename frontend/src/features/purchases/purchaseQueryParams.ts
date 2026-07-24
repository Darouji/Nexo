import type {
  SerkanGridFilter,
  SerkanGridPaginationModel,
  SerkanGridSortModel,
} from "../../components/SerkanDataGrid";
import type { PurchaseListParams } from "../../services/purchasesService";
import { serializeGridFilters } from "../../services/purchasesService";

export type PurchaseQueryState = {
  search: string;
  statuses: string[];
  currencies: string[];
  pagination: SerkanGridPaginationModel;
  sort: SerkanGridSortModel;
  columnFilters: SerkanGridFilter[];
};

export function buildPurchaseQueryParams(
  state: PurchaseQueryState,
): PurchaseListParams {
  return {
    search: state.search || undefined,
    status: state.statuses.length ? state.statuses.join(",") : undefined,
    currency: state.currencies.length ? state.currencies.join(",") : undefined,
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.field}`
      : undefined,
    grid_filters: serializeGridFilters(state.columnFilters),
    page: state.pagination.page + 1,
    page_size: state.pagination.pageSize,
  };
}
