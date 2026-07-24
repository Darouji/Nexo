import type { SerkanGridFilter } from "../components/SerkanDataGrid";
import { api } from "./api";

export type PurchaseCurrency = "CLP" | "USD";
export type PurchaseOrderStatus =
  | "BORRADOR" | "EN_REVISION" | "APROBADA" | "EMITIDA"
  | "PARCIALMENTE_RECIBIDA" | "RECIBIDA" | "CERRADA" | "CANCELADA";

export type Supplier = {
  id: number;
  tax_id: string;
  name: string;
  trade_name: string;
  country: string;
  contact_name: string;
  email: string;
  phone: string;
  active: boolean;
};

export type PurchaseOrderLine = {
  id?: number;
  description: string;
  product: number | null;
  product_label?: string;
  destination_location: number | null;
  destination_label?: string;
  inventory_managed: boolean;
  quantity: number;
  received_quantity?: number;
  unit_price: number;
};

export type PurchaseOrder = {
  id: number;
  number: string;
  supplier: number;
  supplier_name: string;
  status: PurchaseOrderStatus;
  currency: PurchaseCurrency;
  exchange_rate: number | null;
  issue_date: string;
  expected_date: string | null;
  supplier_amount: number;
  total_clp: number;
  notes: string;
  pending_units_total: number;
  lines: PurchaseOrderLine[];
};

export type PurchaseReceipt = {
  id: number;
  order: number;
  order_number: string;
  product_model: string;
  destination_location_name: string;
  status: string;
  committed_units: number;
  pending_units: number;
  received_units: number;
};

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type PurchaseListParams = {
  search?: string;
  status?: string;
  currency?: string;
  supplier?: string;
  ordering?: string;
  grid_filters?: string;
  page?: number;
  page_size?: number;
};

export type PurchaseOrderPayload = {
  number: string;
  supplier: number;
  currency: PurchaseCurrency;
  exchange_rate: number | null;
  issue_date: string;
  expected_date: string | null;
  notes: string;
  lines: PurchaseOrderLine[];
};

export type SupplierPayload = Omit<Supplier, "id">;
export type ReceiptPayload = {
  notes: string;
  lines: Array<{ line: number; quantity: number; destination_location: number | null }>;
};

type ApiSupplier = {
  id: number; legal_name: string; trade_name: string; tax_id: string; country: string;
  contact_name: string; email: string; phone: string; status: string;
};
type ApiLine = {
  id: number; product_id: number | null; product_model_snapshot: string;
  description: string; quantity: number; unit_price_original: number | string;
  destination_location_id: number | null;
};
type ApiOrder = {
  id: number; number: string; supplier: number; supplier_name: string;
  order_date: string; expected_date: string | null; currency: PurchaseCurrency;
  exchange_rate: number | string; state: PurchaseOrderStatus;
  subtotal_original: number | string; total_clp: number | string; notes: string;
  lines: ApiLine[]; receipt_commitments?: ApiCommitment[];
};
type ApiCommitment = {
  id: number; order_id: number; order_number: string; product_model: string;
  destination_location_name: string; committed_quantity: number;
  received_quantity: number; pending_quantity: number; state: string;
};

function normalizePage<T>(data: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
  return Array.isArray(data)
    ? { count: data.length, next: null, previous: null, results: data }
    : data;
}
function mapSupplier(value: ApiSupplier): Supplier {
  return {
    id: value.id, tax_id: value.tax_id, name: value.legal_name,
    trade_name: value.trade_name, country: value.country, contact_name: value.contact_name,
    email: value.email, phone: value.phone, active: value.status === "ACTIVO",
  };
}
function mapOrder(value: ApiOrder): PurchaseOrder {
  return {
    id: value.id, number: value.number, supplier: value.supplier,
    supplier_name: value.supplier_name, status: value.state, currency: value.currency,
    exchange_rate: Number(value.exchange_rate), issue_date: value.order_date,
    expected_date: value.expected_date, supplier_amount: Number(value.subtotal_original),
    total_clp: Number(value.total_clp), notes: value.notes,
    pending_units_total: (value.receipt_commitments || []).reduce((sum, item) => sum + item.pending_quantity, 0),
    lines: value.lines.map((line) => ({
      id: line.id, description: line.description || line.product_model_snapshot,
      product: line.product_id, product_label: line.product_model_snapshot,
      destination_location: line.destination_location_id,
      inventory_managed: Boolean(line.product_id), quantity: line.quantity,
      unit_price: Number(line.unit_price_original),
    })),
  };
}
function mapCommitment(value: ApiCommitment): PurchaseReceipt {
  return {
    id: value.id, order: value.order_id, order_number: value.order_number,
    product_model: value.product_model,
    destination_location_name: value.destination_location_name, status: value.state,
    committed_units: value.committed_quantity, pending_units: value.pending_quantity,
    received_units: value.received_quantity,
  };
}

export async function fetchPurchaseOrders(params: PurchaseListParams, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<ApiOrder> | ApiOrder[]>(
    "/purchases/ordenes/",
    { params: { ...params, state: params.status, status: undefined }, signal },
  );
  const page = normalizePage(response.data);
  return { ...page, results: page.results.map(mapOrder) };
}
export async function fetchSuppliers(params: PurchaseListParams, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<ApiSupplier> | ApiSupplier[]>(
    "/purchases/proveedores/", { params, signal },
  );
  const page = normalizePage(response.data);
  return { ...page, results: page.results.map(mapSupplier) };
}
export async function fetchPurchaseReceipts(params: PurchaseListParams, signal?: AbortSignal) {
  const response = await api.get<PaginatedResponse<ApiCommitment> | ApiCommitment[]>(
    "/purchases/compromisos-recepcion/",
    { params: { ...params, state: params.status, status: undefined }, signal },
  );
  const page = normalizePage(response.data);
  return { ...page, results: page.results.map(mapCommitment) };
}
export async function createSupplier(payload: SupplierPayload) {
  const response = await api.post<ApiSupplier>("/purchases/proveedores/", {
    legal_name: payload.name, trade_name: payload.trade_name, tax_id: payload.tax_id,
    country: payload.country, contact_name: payload.contact_name, email: payload.email, phone: payload.phone,
    status: payload.active ? "ACTIVO" : "INACTIVO",
  });
  return mapSupplier(response.data);
}
export async function createPurchaseOrder(payload: PurchaseOrderPayload, idempotencyKey: string) {
  const response = await api.post<ApiOrder>("/purchases/ordenes/", {
    number: payload.number,
    supplier: payload.supplier,
    order_date: payload.issue_date,
    expected_date: payload.expected_date,
    currency: payload.currency,
    exchange_rate: payload.currency === "CLP" ? 1 : payload.exchange_rate,
    exchange_rate_date: payload.currency === "USD" ? payload.issue_date : null,
    exchange_rate_source: payload.currency === "USD" ? "Ingresado manualmente" : "",
    notes: payload.notes,
    lines: payload.lines.map((line) => ({
      product: line.product,
      description: line.description,
      quantity: line.quantity,
      unit_price_original: line.unit_price,
      tax_rate: 0,
      destination_location: line.destination_location,
    })),
  }, { headers: { "Idempotency-Key": idempotencyKey } });
  return mapOrder(response.data);
}
const actions = {
  "submit-review": "enviar-a-revision", approve: "aprobar", issue: "emitir",
  cancel: "cancelar-remanentes", close: "cerrar",
} as const;
export async function transitionPurchaseOrder(
  orderId: number,
  action: keyof typeof actions,
  reason: string,
  idempotencyKey: string,
) {
  const response = await api.post<ApiOrder>(
    `/purchases/ordenes/${orderId}/${actions[action]}/`,
    { reason },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return mapOrder(response.data);
}
export async function receivePurchaseCommitment(
  commitmentId: number,
  quantity: number,
  reason: string,
  idempotencyKey: string,
) {
  const response = await api.post(
    `/purchases/compromisos-recepcion/${commitmentId}/recibir/`,
    { quantity, reason },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}
export async function receivePurchaseOrder(
  _orderId: number,
  payload: ReceiptPayload,
  idempotencyKey: string,
) {
  const first = payload.lines[0];
  if (!first) throw new Error("No hay compromisos para recibir.");
  return receivePurchaseCommitment(first.line, first.quantity, payload.notes, idempotencyKey);
}
export async function exportPurchases(
  resource: "orders" | "suppliers" | "receipts",
  params: PurchaseListParams & { columns?: string; scope?: "view" | "official" },
) {
  const endpoint = { orders: "ordenes", suppliers: "proveedores", receipts: "compromisos-recepcion" }[resource];
  const response = await api.get<Blob>(`/purchases/${endpoint}/export/`, {
    params: { ...params, mode: params.scope, scope: undefined, file_format: "xlsx" },
    responseType: "blob",
  });
  return response.data;
}
export function serializeGridFilters(filters: SerkanGridFilter[]) {
  return filters.length ? JSON.stringify(filters) : undefined;
}
