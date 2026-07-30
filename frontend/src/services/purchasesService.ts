/**
 * Contratos y operaciones del flujo de Compras y Abastecimiento implementado.
 *
 * El servicio adapta los nombres de la API a modelos de presentación estables y
 * envía las transiciones de estado, recepciones y cancelaciones al backend. Las
 * reglas de aprobación, moneda, cantidades e inventario permanecen en servicios
 * transaccionales del servidor.
 */
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

/**
 * Línea de orden. `inventory_managed` indica si su recepción participa en
 * pendientes y stock; no todas las compras representan inventario comercial.
 */
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
  tax_amount: number;
  total_original: number;
  total_clp: number;
  notes: string;
  pending_units_total: number;
  lines: PurchaseOrderLine[];
};

/**
 * Compromiso de recepción física proveniente de una orden o de un pendiente
 * manual. Mantiene cantidades comprometidas, recibidas, canceladas y restantes.
 */
export type PurchaseReceipt = {
  id: number;
  pending_receipt_id: number;
  order: number | null;
  order_number: string;
  supplier_name: string;
  origin: "PURCHASE_ORDER" | "MANUAL";
  origin_display: string;
  product_model: string;
  product_sap: string;
  product_category: string;
  destination_location_name: string;
  status: string;
  status_display: string;
  reference: string;
  reason: string;
  committed_units: number;
  pending_units: number;
  received_units: number;
  cancelled_units: number;
  created_at: string;
};

/** Foto de una operación histórica sobre un compromiso de recepción. */
export type PurchaseReceiptHistory = {
  id: number;
  operation_type: "RECEIVE" | "CANCEL";
  operation_type_display: string;
  quantity: number;
  reason: string;
  responsible_name: string;
  pending_before: number;
  pending_after: number;
  previous_state_display: string;
  new_state_display: string;
  kardex_movement: number | null;
  occurred_at: string;
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
  tax_rate: number;
  currency: PurchaseCurrency;
  exchange_rate: number | null;
  issue_date: string;
  expected_date: string | null;
  notes: string;
  lines: PurchaseOrderLine[];
};

export type SupplierPayload = Omit<Supplier, "id">;

// Contratos de transporte de la API. Se mantienen separados de los modelos de
// pantalla para no filtrar nombres internos de serializers a todos los componentes.
type ApiSupplier = {
  id: number; legal_name: string; trade_name: string; tax_id: string; country: string;
  contact_name: string; email: string; phone: string; status: string;
};
type ApiLine = {
  id: number; product_id: number | null; controls_inventory_snapshot: boolean; product_model_snapshot: string;
  description: string; quantity: number; unit_price_original: number | string;
  destination_location_id: number | null;
};
type ApiOrder = {
  id: number; number: string; supplier: number; supplier_name: string;
  order_date: string; expected_date: string | null; currency: PurchaseCurrency;
  exchange_rate: number | string; state: PurchaseOrderStatus;
  subtotal_original: number | string; tax_total_original: number | string;
  total_original: number | string; total_clp: number | string; notes: string;
  lines: ApiLine[]; receipt_commitments?: ApiCommitment[];
};
type ApiCommitment = {
  id: number; pending_receipt_id: number; order_id: number | null; order_number: string;
  supplier_name: string; origin: "PURCHASE_ORDER" | "MANUAL"; origin_display: string;
  product_model: string; product_sap: string; product_category: string;
  destination_location_name: string; committed_quantity: number;
  received_quantity: number; cancelled_quantity: number; pending_quantity: number;
  state: string; state_display: string; referencia: string; motivo: string; created_at: string;
};

/** Unifica listas directas y páginas DRF sin perder metadatos de paginación. */
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

/**
 * Convierte montos decimales serializados a números para presentación y deriva
 * el pendiente visible desde los compromisos informados por el backend.
 */
function mapOrder(value: ApiOrder): PurchaseOrder {
  return {
    id: value.id, number: value.number, supplier: value.supplier,
    supplier_name: value.supplier_name, status: value.state, currency: value.currency,
    exchange_rate: Number(value.exchange_rate), issue_date: value.order_date,
    expected_date: value.expected_date, supplier_amount: Number(value.subtotal_original),
    tax_amount: Number(value.tax_total_original), total_original: Number(value.total_original),
    total_clp: Number(value.total_clp), notes: value.notes,
    pending_units_total: (value.receipt_commitments || []).reduce((sum, item) => sum + item.pending_quantity, 0),
    lines: value.lines.map((line) => ({
      id: line.id, description: line.description || line.product_model_snapshot,
      product: line.product_id, product_label: line.product_model_snapshot,
      destination_location: line.destination_location_id,
      inventory_managed: line.controls_inventory_snapshot, quantity: line.quantity,
      unit_price: Number(line.unit_price_original),
    })),
  };
}

function mapCommitment(value: ApiCommitment): PurchaseReceipt {
  return {
    id: value.id, pending_receipt_id: value.pending_receipt_id,
    order: value.order_id, order_number: value.order_number,
    supplier_name: value.supplier_name, origin: value.origin,
    origin_display: value.origin_display, product_model: value.product_model,
    product_sap: value.product_sap, product_category: value.product_category,
    destination_location_name: value.destination_location_name, status: value.state,
    status_display: value.state_display, reference: value.referencia, reason: value.motivo,
    committed_units: value.committed_quantity, pending_units: value.pending_quantity,
    received_units: value.received_quantity, cancelled_units: value.cancelled_quantity,
    created_at: value.created_at,
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
    "/purchases/recepciones-fisicas/",
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

/**
 * Traduce la forma del formulario al contrato del backend y congela la fuente y
 * fecha del tipo de cambio informado para órdenes en USD.
 */
function purchaseOrderApiPayload(payload: PurchaseOrderPayload) {
  return {
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
      tax_rate: payload.tax_rate,
      destination_location: line.destination_location,
    })),
  };
}

/** La clave idempotente protege la creación frente a reintentos del cliente. */
export async function createPurchaseOrder(payload: PurchaseOrderPayload, idempotencyKey: string) {
  const response = await api.post<ApiOrder>(
    "/purchases/ordenes/", purchaseOrderApiPayload(payload),
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return mapOrder(response.data);
}

/**
 * Después de actualizar se recupera la representación completa para incluir
 * líneas, snapshots y compromisos recalculados por el backend.
 */
export async function updatePurchaseOrder(orderId: number, payload: PurchaseOrderPayload) {
  await api.put(`/purchases/ordenes/${orderId}/`, purchaseOrderApiPayload(payload));
  const response = await api.get<ApiOrder>(`/purchases/ordenes/${orderId}/`);
  return mapOrder(response.data);
}

// Mapa explícito de transiciones permitidas por la interfaz; la máquina de
// estados y sus permisos se validan nuevamente en el backend.
const actions = {
  "submit-review": "enviar-a-revision", approve: "aprobar", issue: "emitir",
  cancel: "cancelar-remanentes", close: "cerrar",
} as const;

/**
 * Ejecuta una transición con motivo e idempotencia, sin modificar localmente el
 * estado antes de recibir la orden confirmada por el servidor.
 */
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

/**
 * Solicita la recepción de una cantidad. El backend coordina compromiso,
 * pendiente, ubicación y movimiento Kardex dentro de su regla transaccional.
 */
export async function receivePhysicalReceipt(
  receiptId: number,
  quantity: number,
  reason: string,
  idempotencyKey: string,
) {
  const response = await api.post(
    `/purchases/recepciones-fisicas/${receiptId}/recibir/`,
    { quantity, reason },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

/** Cancela sólo unidades pendientes y conserva las recepciones ya registradas. */
export async function cancelPhysicalReceipt(
  receiptId: number,
  quantity: number,
  reason: string,
  idempotencyKey: string,
) {
  const response = await api.post(
    `/purchases/recepciones-fisicas/${receiptId}/cancelar/`,
    { quantity, reason },
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

export async function fetchPhysicalReceiptHistory(receiptId: number) {
  const response = await api.get<PurchaseReceiptHistory[]>(
    `/purchases/recepciones-fisicas/${receiptId}/historial/`,
  );
  return response.data;
}

/**
 * Exporta desde backend para aplicar los mismos filtros, permisos, etiquetas y
 * columnas que rigen la vista u oficio seleccionado.
 */
export async function exportPurchases(
  resource: "orders" | "suppliers" | "receipts",
  params: PurchaseListParams & { columns?: string; scope?: "view" | "official" },
) {
  const endpoint = { orders: "ordenes", suppliers: "proveedores", receipts: "recepciones-fisicas" }[resource];
  const response = await api.get<Blob>(`/purchases/${endpoint}/export/`, {
    params: { ...params, mode: params.scope, scope: undefined, file_format: "xlsx" },
    responseType: "blob",
  });
  return response.data;
}

/** Serializa filtros remotos únicamente cuando existe al menos uno. */
export function serializeGridFilters(filters: SerkanGridFilter[]) {
  return filters.length ? JSON.stringify(filters) : undefined;
}
