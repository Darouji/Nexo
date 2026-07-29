import { describe, expect, it } from "vitest";
import {
  canRegisterShipmentForOrder,
  createEmptyPurchaseOrderForm,
  purchaseTaxRateForCountry,
  toPurchaseOrderPayload,
  validatePurchaseOrderForm,
} from "./purchaseModels";

describe("purchaseModels", () => {
  it("exige proveedor, producto y destino en líneas inventariables", () => {
    const errors = validatePurchaseOrderForm(createEmptyPurchaseOrderForm());
    expect(errors.supplier).toBeTruthy();
    expect(errors["lines.0.product"]).toBeTruthy();
    expect(errors["lines.0.destination_location"]).toBeTruthy();
  });

  it("congela el tipo de cambio en el payload USD", () => {
    const form = createEmptyPurchaseOrderForm();
    form.supplier = "4";
    form.currency = "USD";
    form.exchangeRate = "945.5";
    form.lines[0] = {
      description: "Alternador",
      product: "8",
      destinationLocation: "2",
      inventoryManaged: true,
      quantity: "3",
      unitPrice: "120",
    };
    expect(toPurchaseOrderPayload(form).exchange_rate).toBe(945.5);
  });

  it("incluye la tasa tributaria decidida por el flujo de proveedor", () => {
    const form = createEmptyPurchaseOrderForm();
    form.supplier = "4";

    expect(toPurchaseOrderPayload(form, 19).tax_rate).toBe(19);
    expect(toPurchaseOrderPayload(form, 0).tax_rate).toBe(0);
    expect(purchaseTaxRateForCountry("Chile")).toBe(19);
    expect(purchaseTaxRateForCountry("CHÍLE")).toBe(19);
    expect(purchaseTaxRateForCountry("Estados Unidos")).toBe(0);
  });
  it("habilita seguimiento sólo para órdenes operativamente autorizadas", () => {
    expect(canRegisterShipmentForOrder("APROBADA")).toBe(true);
    expect(canRegisterShipmentForOrder("EMITIDA")).toBe(true);
    expect(canRegisterShipmentForOrder("PARCIALMENTE_RECIBIDA")).toBe(true);
    expect(canRegisterShipmentForOrder("BORRADOR")).toBe(false);
    expect(canRegisterShipmentForOrder("EN_REVISION")).toBe(false);
    expect(canRegisterShipmentForOrder("CERRADA")).toBe(false);
  });
});
