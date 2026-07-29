import type {
  PurchaseCurrency,
  PurchaseOrderLine,
  PurchaseOrderPayload,
  PurchaseOrderStatus,
} from "../../services/purchasesService";

export const PURCHASE_STATUSES: Array<{
  value: PurchaseOrderStatus;
  label: string;
}> = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "EMITIDA", label: "Emitida" },
  { value: "PARCIALMENTE_RECIBIDA", label: "Parcialmente recibida" },
  { value: "RECIBIDA", label: "Recibida" },
  { value: "CERRADA", label: "Cerrada" },
  { value: "CANCELADA", label: "Cancelada" },
];

export type PurchaseOrderForm = {
  number: string;
  supplier: string;
  currency: PurchaseCurrency;
  exchangeRate: string;
  issueDate: string;
  expectedDate: string;
  notes: string;
  lines: Array<{
    description: string;
    product: string;
    destinationLocation: string;
    inventoryManaged: boolean;
    quantity: string;
    unitPrice: string;
  }>;
};

export const EMPTY_PURCHASE_LINE: PurchaseOrderForm["lines"][number] = {
  description: "",
  product: "",
  destinationLocation: "",
  inventoryManaged: true,
  quantity: "1",
  unitPrice: "0",
};

export function createEmptyPurchaseOrderForm(): PurchaseOrderForm {
  return {
    number: "",
    supplier: "",
    currency: "CLP",
    exchangeRate: "",
    issueDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    notes: "",
    lines: [{ ...EMPTY_PURCHASE_LINE }],
  };
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validatePurchaseOrderForm(form: PurchaseOrderForm) {
  const errors: Record<string, string> = {};

  if (!form.supplier) errors.supplier = "Selecciona un proveedor.";
  if (!form.issueDate) errors.issue_date = "Indica la fecha de emisión.";
  if (form.currency === "USD" && numberValue(form.exchangeRate) <= 0) {
    errors.exchange_rate =
      "El tipo de cambio debe ser mayor que cero y quedará congelado.";
  }
  if (!form.lines.length) errors.lines = "Agrega al menos una línea.";

  form.lines.forEach((line, index) => {
    if (!line.description.trim()) {
      errors[`lines.${index}.description`] = "Describe el bien o servicio.";
    }
    if (numberValue(line.quantity) <= 0) {
      errors[`lines.${index}.quantity`] = "Debe ser mayor que cero.";
    }
    if (numberValue(line.unitPrice) < 0) {
      errors[`lines.${index}.unit_price`] = "No puede ser negativo.";
    }
    if (line.inventoryManaged && !line.product) {
      errors[`lines.${index}.product`] = "Selecciona el producto inventariable.";
    }
    if (line.inventoryManaged && !line.destinationLocation) {
      errors[`lines.${index}.destination_location`] =
        "Selecciona la ubicación de destino.";
    }
  });

  return errors;
}

export function toPurchaseOrderPayload(
  form: PurchaseOrderForm,
): PurchaseOrderPayload {
  const lines: PurchaseOrderLine[] = form.lines.map((line) => ({
    description: line.description.trim(),
    product: line.product ? Number(line.product) : null,
    destination_location: line.destinationLocation
      ? Number(line.destinationLocation)
      : null,
    inventory_managed: line.inventoryManaged,
    quantity: numberValue(line.quantity),
    unit_price: numberValue(line.unitPrice),
  }));

  return {
    number: form.number.trim(),
    supplier: Number(form.supplier),
    currency: form.currency,
    exchange_rate:
      form.currency === "USD" ? numberValue(form.exchangeRate) : null,
    issue_date: form.issueDate,
    expected_date: form.expectedDate || null,
    notes: form.notes.trim(),
    lines,
  };
}

const SHIPMENT_ELIGIBLE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "APROBADA",
  "EMITIDA",
  "PARCIALMENTE_RECIBIDA",
];

export function canRegisterShipmentForOrder(status: PurchaseOrderStatus) {
  return SHIPMENT_ELIGIBLE_ORDER_STATUSES.includes(status);
}

export function formatPurchaseStatus(status: PurchaseOrderStatus) {
  return PURCHASE_STATUSES.find((option) => option.value === status)?.label ?? status;
}
