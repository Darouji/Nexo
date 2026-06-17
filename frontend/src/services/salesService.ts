import { api } from "./api";
import type { KardexMovement } from "./inventoryService";

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

export type SalesSummary = {
  ventas: {
    total: number;
    vigentes: number;
    por_estado: Record<string, number>;
  };
  montos: {
    valor_neto: string;
    iva: string;
    total: string;
    total_concretado: string;
  };
  documentos: {
    sin_factura: number;
    sin_guia: number;
  };
  alertas: {
    activas: number;
    bloqueantes: number;
    ventas_con_alertas: number;
    ventas_bloqueantes: number;
  };
};

export type SaleTraceChange = {
  [key: string]: unknown;
  id: number;
  content_type: number;
  content_type_label: string;
  object_id: string;
  action: string;
  action_display: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: number | null;
  changed_by_name: string;
  origin: string;
  origin_display: string;
  reason: string;
  created_at: string;
};

export type SaleTraceability = {
  venta: Sale;
  cambios: SaleTraceChange[];
  movimientos_kardex: KardexMovement[];
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type SaleListResponse = Sale[] | PaginatedResponse<Sale>;

type CsvParam<T extends string | number> = T | T[];

export type SaleListParams = {
  search?: string;
  ordering?: string;

  sale_status?: CsvParam<SaleStatus>;
  status?: CsvParam<string>;

  minera?: CsvParam<number>;
  area?: CsvParam<number>;
  subarea?: CsvParam<number>;
  contacto?: CsvParam<number>;
  operador?: CsvParam<number>;

  fecha_desde?: string;
  fecha_hasta?: string;
  fecha_factura_desde?: string;
  fecha_factura_hasta?: string;

  stock_descontado?: boolean;
  has_alerts?: boolean;
  alert_severity?: CsvParam<string>;
  validation_summary?: SaleValidationSummary;
  has_factura?: boolean;
  has_guia?: boolean;
};

export type CreateSaleLinePayload = {
  producto: number;
  cantidad: number;
  valor_unitario: string;
  codigo_sap?: string;
};

export type CreateSalePayload = {
  fecha_venta: string;
  fecha_factura?: string | null;
  factura_numero?: string;
  orden_compra?: string;
  minera: number;
  area?: number | null;
  subarea?: number | null;
  contacto?: number | null;
  tipo_documento?: string;
  numero_guia_hes?: string;
  observations?: string;
  lineas: CreateSaleLinePayload[];
};

export type UpdateSaleMetadataPayload = Partial<
  Pick<
    CreateSalePayload,
    | "fecha_venta"
    | "fecha_factura"
    | "factura_numero"
    | "orden_compra"
    | "minera"
    | "area"
    | "subarea"
    | "contacto"
    | "tipo_documento"
    | "numero_guia_hes"
    | "observations"
  >
>;

export type UpdateSaleLinesPayload = {
  motivo: string;
  lineas: CreateSaleLinePayload[];
};

function extractResults<T>(data: T[] | PaginatedResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

function toCsv<T extends string | number>(value?: CsvParam<T>) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const cleanValues = value.filter((item) => item !== "" && item !== null);

    return cleanValues.length > 0 ? cleanValues.join(",") : undefined;
  }

  return value;
}

function toBooleanParam(value?: boolean) {
  if (value === undefined) {
    return undefined;
  }

  return value ? "true" : "false";
}

function buildSaleListParams(params: SaleListParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || "-fecha_venta,-created_at",

    sale_status: toCsv(params.sale_status),
    status: toCsv(params.status),

    minera: toCsv(params.minera),
    area: toCsv(params.area),
    subarea: toCsv(params.subarea),
    contacto: toCsv(params.contacto),
    operador: toCsv(params.operador),

    fecha_desde: params.fecha_desde || undefined,
    fecha_hasta: params.fecha_hasta || undefined,
    fecha_factura_desde: params.fecha_factura_desde || undefined,
    fecha_factura_hasta: params.fecha_factura_hasta || undefined,

    stock_descontado: toBooleanParam(params.stock_descontado),
    has_alerts: toBooleanParam(params.has_alerts),
    alert_severity: toCsv(params.alert_severity),
    validation_summary: params.validation_summary || undefined,
    has_factura: toBooleanParam(params.has_factura),
    has_guia: toBooleanParam(params.has_guia),
  };
}

export async function fetchSales(params: SaleListParams = {}) {
  const response = await api.get<SaleListResponse>("/sales/ventas/", {
    params: buildSaleListParams(params),
  });

  return extractResults(response.data);
}

export async function fetchSalesSummary(params: SaleListParams = {}) {
  const response = await api.get<SalesSummary>("/sales/ventas/resumen/", {
    params: buildSaleListParams(params),
  });

  return response.data;
}

export async function fetchSale(saleId: number) {
  const response = await api.get<Sale>(`/sales/ventas/${saleId}/`);
  return response.data;
}

export async function createSale(payload: CreateSalePayload) {
  const response = await api.post<Sale>("/sales/ventas/", payload);
  return response.data;
}

export async function updateSaleMetadata(
  saleId: number,
  payload: UpdateSaleMetadataPayload,
) {
  const response = await api.patch<Sale>(`/sales/ventas/${saleId}/`, payload);
  return response.data;
}

export async function updateSaleLines(
  saleId: number,
  payload: UpdateSaleLinesPayload,
) {
  const response = await api.post<Sale>(
    `/sales/ventas/${saleId}/actualizar-lineas/`,
    {
      motivo: payload.motivo.trim(),
      lineas: payload.lineas,
    },
  );

  return response.data;
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

export async function fetchSaleTraceability(saleId: number) {
  const response = await api.get<SaleTraceability>(
    `/sales/ventas/${saleId}/trazabilidad/`,
  );

  return response.data;
}
