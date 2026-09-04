/**
 * Contratos y operaciones de logística asociada a Compras.
 *
 * Un envío conserva transportista, seguimiento, custodio, ETA, eventos y cobros.
 * Los eventos agregan historia y pueden actualizar estado, custodia o fecha
 * estimada; no reemplazan silenciosamente el recorrido anterior.
 */
import { api } from "./api";

export type ShipmentStatus =
  | "PREPARANDO"
  | "DESPACHADO"
  | "EN_TRANSITO"
  | "EN_ADUANA"
  | "RETENIDO"
  | "LIBERADO"
  | "EN_REPARTO"
  | "ENTREGADO"
  | "CON_INCIDENCIA"
  | "CANCELADO";

export type ShipmentTransportMode =
  | "COURIER"
  | "AEREO"
  | "MARITIMO"
  | "TERRESTRE"
  | "OTRO";

/** Parte que mantiene la custodia operacional del envío en un momento dado. */
export type ShipmentCustodian =
  | "PROVEEDOR"
  | "TRANSPORTISTA_ORIGEN"
  | "TRANSPORTISTA_INTERNACIONAL"
  | "ADUANA"
  | "AGENTE_ADUANA"
  | "COURIER_CHILE"
  | "ULTIMA_MILLA"
  | "EMPRESA"
  | "OTRO";

export type Carrier = {
  id: number;
  name: string;
  aliases: string[];
  country: string;
  website_url: string;
  tracking_url_template: string;
  contact_name: string;
  email: string;
  phone: string;
  status: "ACTIVO" | "INACTIVO";
};

/**
 * Hecho fechado del recorrido. Puede aportar evidencia y cambiar la fotografía
 * vigente, pero permanece disponible como parte del historial del envío.
 */
export type ShipmentEvent = {
  id: number;
  event_type: string;
  event_type_display: string;
  title: string;
  description: string;
  occurred_at: string;
  new_state: ShipmentStatus | "";
  new_state_display: string;
  new_custodian: ShipmentCustodian | "";
  new_custodian_display: string;
  updated_eta: string | null;
  evidence_reference: string;
  responsible_name: string;
  created_at: string;
};

/**
 * Costo logístico con moneda, tipo de cambio, fuente y estado de confirmación.
 * La interfaz no debe tratar cobros abiertos o en disputa como costo definitivo.
 */
export type ShipmentCharge = {
  id: number;
  charge_type: string;
  charge_type_display: string;
  description: string;
  amount_original: number | string;
  currency: string;
  exchange_rate: number | string;
  exchange_rate_date: string | null;
  exchange_rate_source: string;
  amount_clp: number | string;
  charged_by: string;
  reason: string;
  source_reference: string;
  charge_status: string;
  charge_status_display: string;
  responsible_name: string;
  created_at: string;
};

export type PurchaseShipment = {
  id: number;
  order: number;
  order_number: string;
  supplier_name: string;
  carrier: number;
  carrier_name: string;
  transport_mode: ShipmentTransportMode;
  transport_mode_display: string;
  tracking_number: string;
  tracking_url: string;
  origin_country: string;
  origin_place: string;
  destination_place: string;
  shipped_date: string | null;
  initial_eta: string | null;
  current_eta: string | null;
  effective_eta: string | null;
  days_remaining: number | null;
  actual_arrival_date: string | null;
  state: ShipmentStatus;
  state_display: string;
  current_custodian: ShipmentCustodian;
  current_custodian_display: string;
  customs_review_expected: boolean;
  customs_review_reason: string;
  notes: string;
  responsible: number;
  responsible_name: string;
  confirmed_charges_clp: number | string;
  open_charges_clp: number | string;
  events: ShipmentEvent[];
  charges: ShipmentCharge[];
  created_at: string;
  updated_at: string;
};

/** Indicadores operativos calculados por el backend para priorizar seguimiento. */
export type ShipmentSummary = {
  orders_in_review: number;
  open_shipments: number;
  delayed_shipments: number;
  customs_attention: number;
  charges_in_dispute: number;
};

export type ShipmentListParams = {
  search?: string;
  status?: string;
  carrier?: string;
  transport_mode?: string;
  ordering?: string;
  grid_filters?: string;
  page?: number;
  page_size?: number;
};

export type PaginatedShipments = {
  count: number;
  next: string | null;
  previous: string | null;
  results: PurchaseShipment[];
};

export type ShipmentPayload = {
  order: number;
  carrier: number;
  transport_mode: ShipmentTransportMode;
  tracking_number: string;
  origin_country: string;
  origin_place: string;
  destination_place: string;
  shipped_date: string | null;
  initial_eta: string | null;
  current_eta: string | null;
  state: ShipmentStatus;
  current_custodian: ShipmentCustodian;
  customs_review_expected: boolean;
  customs_review_reason: string;
  notes: string;
};

export type ShipmentEventPayload = {
  event_type: string;
  title: string;
  description: string;
  occurred_at: string;
  new_state: ShipmentStatus | "";
  new_custodian: ShipmentCustodian | "";
  updated_eta: string | null;
  evidence_reference: string;
};

export type ShipmentChargePayload = {
  charge_type: string;
  description: string;
  amount_original: number;
  currency: string;
  exchange_rate: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string;
  charged_by: string;
  reason: string;
  source_reference: string;
  charge_status: string;
};

export async function fetchPurchaseShipments(
  params: ShipmentListParams,
  signal?: AbortSignal,
) {
  const response = await api.get<PaginatedShipments>(
    "/purchases/envios/",
    {
      params: { ...params, state: params.status, status: undefined },
      signal,
    },
  );
  return response.data;
}

export async function fetchShipmentSummary(signal?: AbortSignal) {
  const response = await api.get<ShipmentSummary>(
    "/purchases/envios/resumen/",
    { signal },
  );
  return response.data;
}

/** Recupera el detalle completo, incluidos eventos y cobros históricos. */
export async function fetchPurchaseShipment(shipmentId: number) {
  const response = await api.get<PurchaseShipment>(
    `/purchases/envios/${shipmentId}/`,
  );
  return response.data;
}

/** Busca transportistas existentes antes de crear una variante duplicada. */
export async function fetchCarrierSuggestions(
  search: string,
  signal?: AbortSignal,
) {
  const response = await api.get<Carrier[]>(
    "/purchases/transportistas/sugerencias/",
    { params: { search }, signal },
  );
  return response.data;
}

/**
 * Resuelve un nombre contra transportistas y alias conocidos; el backend indica
 * si reutilizó un registro o creó uno nuevo.
 */
export async function resolveCarrier(name: string) {
  const response = await api.post<{ carrier: Carrier; created: boolean }>(
    "/purchases/transportistas/resolver/",
    { name },
  );
  return response.data;
}

/** Evita crear dos envíos cuando una misma solicitud se repite. */
export async function createPurchaseShipment(
  payload: ShipmentPayload,
  idempotencyKey: string,
) {
  const response = await api.post<PurchaseShipment>(
    "/purchases/envios/",
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

/**
 * Agrega un hecho trazable al envío. El backend valida coherencia temporal y las
 * transiciones de estado o custodia solicitadas por el evento.
 */
export async function registerShipmentEvent(
  shipmentId: number,
  payload: ShipmentEventPayload,
  idempotencyKey: string,
) {
  const response = await api.post<ShipmentEvent>(
    `/purchases/envios/${shipmentId}/eventos/`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

/** Registra un costo con su evidencia y calidad sin recalcularlo en el cliente. */
export async function registerShipmentCharge(
  shipmentId: number,
  payload: ShipmentChargePayload,
  idempotencyKey: string,
) {
  const response = await api.post<ShipmentCharge>(
    `/purchases/envios/${shipmentId}/cobros/`,
    payload,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return response.data;
}

/** Exporta la vista u oficio desde backend para respetar filtros y permisos. */
export async function exportPurchaseShipments(
  params: ShipmentListParams & {
    columns?: string;
    scope?: "view" | "official";
  },
) {
  const response = await api.get<Blob>("/purchases/envios/export/", {
    params: {
      ...params,
      mode: params.scope,
      scope: undefined,
      file_format: "xlsx",
    },
    responseType: "blob",
  });
  return response.data;
}
