import type {
  ShipmentChargePayload,
  ShipmentCustodian,
  ShipmentEventPayload,
  ShipmentPayload,
  ShipmentStatus,
  ShipmentTransportMode,
} from "../../services/purchasesLogisticsService";

export const SHIPMENT_STATUS_OPTIONS: Array<{
  value: ShipmentStatus;
  label: string;
}> = [
  { value: "PREPARANDO", label: "Preparando envío" },
  { value: "DESPACHADO", label: "Despachado" },
  { value: "EN_TRANSITO", label: "En tránsito" },
  { value: "EN_ADUANA", label: "En Aduanas" },
  { value: "RETENIDO", label: "Retenido" },
  { value: "LIBERADO", label: "Liberado" },
  { value: "EN_REPARTO", label: "En reparto" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CON_INCIDENCIA", label: "Con incidencia" },
  { value: "CANCELADO", label: "Cancelado" },
];

export const SHIPMENT_MODE_OPTIONS: Array<{
  value: ShipmentTransportMode;
  label: string;
}> = [
  { value: "COURIER", label: "Courier" },
  { value: "AEREO", label: "Aéreo" },
  { value: "MARITIMO", label: "Marítimo" },
  { value: "TERRESTRE", label: "Terrestre" },
  { value: "OTRO", label: "Otro" },
];

export const SHIPMENT_CUSTODIAN_OPTIONS: Array<{
  value: ShipmentCustodian;
  label: string;
}> = [
  { value: "PROVEEDOR", label: "Proveedor" },
  { value: "TRANSPORTISTA_ORIGEN", label: "Transportista de origen" },
  {
    value: "TRANSPORTISTA_INTERNACIONAL",
    label: "Transportista internacional",
  },
  { value: "ADUANA", label: "Aduanas" },
  { value: "AGENTE_ADUANA", label: "Agente de aduanas" },
  { value: "COURIER_CHILE", label: "Courier en Chile" },
  { value: "ULTIMA_MILLA", label: "Transportista de última milla" },
  { value: "EMPRESA", label: "EMPRESA" },
  { value: "OTRO", label: "Otro" },
];

export const SHIPMENT_EVENT_OPTIONS = [
  { value: "ACTUALIZACION", label: "Actualización" },
  { value: "DESPACHO", label: "Despacho" },
  { value: "LLEGADA_PAIS", label: "Llegada al país" },
  { value: "REVISION_ADUANERA", label: "Revisión aduanera" },
  { value: "DOCUMENTACION", label: "Solicitud de documentación" },
  { value: "RETENCION", label: "Retención" },
  { value: "LIBERACION", label: "Liberación" },
  { value: "ENTREGA", label: "Entrega" },
  { value: "INCIDENCIA", label: "Incidencia" },
  { value: "CAMBIO_ESTIMACION", label: "Cambio de estimación" },
];

export const SHIPMENT_CHARGE_OPTIONS = [
  { value: "FLETE_ADICIONAL", label: "Flete adicional" },
  { value: "DERECHO_ADUANERO", label: "Derecho aduanero" },
  { value: "IVA_IMPORTACION", label: "IVA de importación" },
  { value: "ALMACENAMIENTO", label: "Almacenamiento" },
  { value: "SEGURO", label: "Seguro" },
  { value: "REENTREGA", label: "Reentrega" },
  { value: "DEMORA", label: "Demora" },
  { value: "COMISION_COURIER", label: "Comisión del courier" },
  { value: "COMISION_BANCARIA", label: "Comisión bancaria" },
  { value: "OTRO", label: "Otro" },
];

export const SHIPMENT_CHARGE_STATUS_OPTIONS = [
  { value: "ESTIMADO", label: "Estimado" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "EN_DISPUTA", label: "En disputa" },
  { value: "REEMBOLSADO", label: "Reembolsado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

export type ShipmentForm = {
  order: string;
  carrierId: string;
  carrierName: string;
  transportMode: ShipmentTransportMode;
  trackingNumber: string;
  originCountry: string;
  originPlace: string;
  destinationPlace: string;
  shippedDate: string;
  initialEta: string;
  currentEta: string;
  state: ShipmentStatus;
  currentCustodian: ShipmentCustodian;
  customsReviewExpected: boolean;
  customsReviewReason: string;
  notes: string;
};

export type ShipmentEventForm = {
  eventType: string;
  title: string;
  description: string;
  occurredAt: string;
  newState: ShipmentStatus | "";
  newCustodian: ShipmentCustodian | "";
  updatedEta: string;
  evidenceReference: string;
};

export type ShipmentChargeForm = {
  chargeType: string;
  description: string;
  amountOriginal: string;
  currency: string;
  exchangeRate: string;
  exchangeRateDate: string;
  exchangeRateSource: string;
  chargedBy: string;
  reason: string;
  sourceReference: string;
  chargeStatus: string;
};

function localDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function createEmptyShipmentForm(): ShipmentForm {
  return {
    order: "",
    carrierId: "",
    carrierName: "",
    transportMode: "COURIER",
    trackingNumber: "",
    originCountry: "",
    originPlace: "",
    destinationPlace: "Chile",
    shippedDate: "",
    initialEta: "",
    currentEta: "",
    state: "PREPARANDO",
    currentCustodian: "PROVEEDOR",
    customsReviewExpected: false,
    customsReviewReason: "",
    notes: "",
  };
}

export function createEmptyShipmentEventForm(): ShipmentEventForm {
  return {
    eventType: "ACTUALIZACION",
    title: "",
    description: "",
    occurredAt: localDateTimeValue(),
    newState: "",
    newCustodian: "",
    updatedEta: "",
    evidenceReference: "",
  };
}

export function createEmptyShipmentChargeForm(): ShipmentChargeForm {
  return {
    chargeType: "FLETE_ADICIONAL",
    description: "",
    amountOriginal: "",
    currency: "CLP",
    exchangeRate: "1",
    exchangeRateDate: "",
    exchangeRateSource: "",
    chargedBy: "",
    reason: "",
    sourceReference: "",
    chargeStatus: "ESTIMADO",
  };
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateShipmentForm(form: ShipmentForm) {
  const errors: Record<string, string> = {};
  if (!form.order) errors.order = "Selecciona la orden de compra.";
  if (!form.carrierName.trim()) {
    errors.carrier = "Indica o selecciona la empresa transportista.";
  }
  if (!form.destinationPlace.trim()) {
    errors.destination_place = "Indica el destino del pedido.";
  }
  if (
    form.shippedDate &&
    form.initialEta &&
    form.initialEta < form.shippedDate
  ) {
    errors.initial_eta = "No puede ser anterior a la fecha de despacho.";
  }
  if (
    form.shippedDate &&
    form.currentEta &&
    form.currentEta < form.shippedDate
  ) {
    errors.current_eta = "No puede ser anterior a la fecha de despacho.";
  }
  if (form.customsReviewExpected && !form.customsReviewReason.trim()) {
    errors.customs_review_reason =
      "Explica por qué se espera una gestión aduanera especial.";
  }
  return errors;
}

export function validateShipmentEventForm(form: ShipmentEventForm) {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "Describe claramente qué ocurrió.";
  if (!form.occurredAt) errors.occurred_at = "Indica cuándo ocurrió.";
  return errors;
}

export function validateShipmentChargeForm(form: ShipmentChargeForm) {
  const errors: Record<string, string> = {};
  if (!form.description.trim()) {
    errors.description = "Describe el cobro adicional.";
  }
  if (!positiveNumber(form.amountOriginal)) {
    errors.amount_original = "El monto debe ser mayor que cero.";
  }
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) {
    errors.currency = "Usa un código de moneda de tres letras, por ejemplo CLP.";
  }
  if (!form.reason.trim()) {
    errors.reason = "El motivo es obligatorio para mantener la trazabilidad.";
  }
  if (form.currency.toUpperCase() !== "CLP") {
    if (!positiveNumber(form.exchangeRate)) {
      errors.exchange_rate = "El tipo de cambio debe ser mayor que cero.";
    }
    if (!form.exchangeRateDate) {
      errors.exchange_rate_date = "Indica la fecha del tipo de cambio.";
    }
    if (!form.exchangeRateSource.trim()) {
      errors.exchange_rate_source = "Indica la fuente del tipo de cambio.";
    }
  }
  return errors;
}

export function toShipmentPayload(
  form: ShipmentForm,
  carrierId: number,
): ShipmentPayload {
  return {
    order: Number(form.order),
    carrier: carrierId,
    transport_mode: form.transportMode,
    tracking_number: form.trackingNumber.trim(),
    origin_country: form.originCountry.trim(),
    origin_place: form.originPlace.trim(),
    destination_place: form.destinationPlace.trim(),
    shipped_date: form.shippedDate || null,
    initial_eta: form.initialEta || null,
    current_eta: form.currentEta || null,
    state: form.state,
    current_custodian: form.currentCustodian,
    customs_review_expected: form.customsReviewExpected,
    customs_review_reason: form.customsReviewReason.trim(),
    notes: form.notes.trim(),
  };
}

export function toShipmentEventPayload(
  form: ShipmentEventForm,
): ShipmentEventPayload {
  return {
    event_type: form.eventType,
    title: form.title.trim(),
    description: form.description.trim(),
    occurred_at: new Date(form.occurredAt).toISOString(),
    new_state: form.newState,
    new_custodian: form.newCustodian,
    updated_eta: form.updatedEta || null,
    evidence_reference: form.evidenceReference.trim(),
  };
}

export function toShipmentChargePayload(
  form: ShipmentChargeForm,
): ShipmentChargePayload {
  const currency = form.currency.trim().toUpperCase();
  return {
    charge_type: form.chargeType,
    description: form.description.trim(),
    amount_original: Number(form.amountOriginal),
    currency,
    exchange_rate: currency === "CLP" ? 1 : Number(form.exchangeRate),
    exchange_rate_date:
      currency === "CLP" ? null : form.exchangeRateDate || null,
    exchange_rate_source:
      currency === "CLP" ? "" : form.exchangeRateSource.trim(),
    charged_by: form.chargedBy.trim(),
    reason: form.reason.trim(),
    source_reference: form.sourceReference.trim(),
    charge_status: form.chargeStatus,
  };
}
