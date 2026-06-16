import { api } from "./api";

export type DashboardStatistics = {
  generated_at: string;
  general: {
    users_active: number | null;
    collaborators_active: number | null;
    holdings_active: number;
    mineras_active: number;
    contacts_active: number;
    products_active: number;
    sales_total: number;
    documents_total: number;
    imports_total: number;
  };
  inventory: {
    categories_total: number;
    products_total: number;
    products_active: number;
    products_control_stock: number;
    stock_units_total: number;
    critical_products_count: number;
    movements_total: number;
  };
  sales: {
    sales_total: number;
    sales_valid: number;
    current_month: {
      count: number;
      total: string;
    };
    active_alerts_count: number;
  };
  documents: {
    documents_total: number;
    documents_active: number;
    versions_total: number;
    active_versions: number;
  };
  imports: {
    batches_total: number;
    rows_total: number;
    rows_with_error: number;
    rows_requires_review: number;
  };
};

export async function fetchDashboardStatistics() {
  const response = await api.get<DashboardStatistics>("/core/stats/");
  return response.data;
}
