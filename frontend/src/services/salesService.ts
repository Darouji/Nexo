import { api } from "./api";

export type SaleStatus = "INGRESADA" | "CONCRETADA" | "ANULADA" | string;

export type SaleValidationSummary =
  | "OK"
  | "CON_ALERTAS"
  | "BLOQUEANTE"
  | string;

export type SaleDetail = {
  [key: string]: unknown;
  id: number;
  venta: number;
  producto: number;
  producto_modelo: string;
  producto_categoria: string;
  producto_controla_stock: boolean;
  cantidad: number;
  valor_unitario: string;
  valor_total: string;
  codigo_sap: string;
  controla_stock_snapshot: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SaleAlert = {
  [key: string]: unknown;
  id: number;
  code: string;
  code_display: string;
  message: string;
  severity: string;
  severity_display: string;
  is_active: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  [key: string]: unknown;
  id: number;
  operador: number | null;
  operador_nombre: string;
  sale_status: SaleStatus;
  sale_status_display: string;
  fecha_venta: string;
  fecha_factura: string | null;
  factura_numero: string;
  orden_compra: string;
  minera: number;
  minera_name: string;
  area: number | null;
  area_name: string;
  subarea: number | null;
  subarea_name: string;
  contacto: number | null;
  contacto_name: string;
  valor_neto: string;
  iva: string;
  total: string;
  tipo_documento: string;
  tipo_documento_display: string;
  numero_guia_hes: string;
  stock_descontado: boolean;
  concretada_at: string | null;
  concretada_by: number | null;
  anulada_at: string | null;
  anulada_by: number | null;
  anulacion_motivo: string;
  observations: string;
  detalles: SaleDetail[];
  alerts: SaleAlert[];
  validation_summary: SaleValidationSummary;
  status: string;
  created_at: string;
  updated_at: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type SaleListResponse = Sale[] | PaginatedResponse<Sale>;

type SaleListParams = {
  search?: string;
  ordering?: string;
};

function extractResults<T>(data: T[] | PaginatedResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

export async function fetchSales(params: SaleListParams = {}) {
  const response = await api.get<SaleListResponse>("/sales/ventas/", {
    params: {
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "-fecha_venta,-created_at",
    },
  });

  return extractResults(response.data);
}

export async function concretarSale(saleId: number) {
  const response = await api.post<Sale>(`/sales/ventas/${saleId}/concretar/`);
  return response.data;
}

export async function annulSale(saleId: number, motivo: string) {
  const response = await api.post<Sale>(`/sales/ventas/${saleId}/anular/`, {
    motivo: motivo.trim(),
  });

  return response.data;
}
