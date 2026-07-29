import { describe, expect, it } from "vitest";

import {
  createEmptyShipmentChargeForm,
  createEmptyShipmentForm,
  toShipmentChargePayload,
  validateShipmentChargeForm,
  validateShipmentForm,
} from "./purchaseLogisticsModels";

describe("modelos del seguimiento logístico", () => {
  it("exige orden, transportista y destino dentro del formulario", () => {
    const form = createEmptyShipmentForm();
    form.destinationPlace = "";

    expect(validateShipmentForm(form)).toEqual({
      order: "Selecciona la orden de compra.",
      carrier: "Indica o selecciona la empresa transportista.",
      destination_place: "Indica el destino del pedido.",
    });
  });

  it("valida fechas y explicación aduanera en sus campos", () => {
    const form = createEmptyShipmentForm();
    form.order = "10";
    form.carrierName = "DHL";
    form.shippedDate = "2026-08-10";
    form.initialEta = "2026-08-09";
    form.customsReviewExpected = true;

    const errors = validateShipmentForm(form);

    expect(errors.initial_eta).toContain("anterior");
    expect(errors.customs_review_reason).toContain("gestión aduanera");
  });

  it("muestra requisitos de conversión sólo para moneda extranjera", () => {
    const form = createEmptyShipmentChargeForm();
    form.description = "Flete adicional";
    form.amountOriginal = "100";
    form.reason = "Cambio de ruta confirmado.";

    expect(validateShipmentChargeForm(form)).toEqual({});

    form.currency = "USD";
    form.exchangeRate = "";
    const errors = validateShipmentChargeForm(form);

    expect(errors.exchange_rate).toBeTruthy();
    expect(errors.exchange_rate_date).toBeTruthy();
    expect(errors.exchange_rate_source).toBeTruthy();
  });

  it("normaliza un cobro CLP sin datos cambiarios ocultos", () => {
    const form = createEmptyShipmentChargeForm();
    form.description = "Almacenamiento";
    form.amountOriginal = "25000";
    form.reason = "Demora documentada.";
    form.exchangeRateDate = "2026-07-27";
    form.exchangeRateSource = "No debe enviarse";

    expect(toShipmentChargePayload(form)).toMatchObject({
      amount_original: 25000,
      currency: "CLP",
      exchange_rate: 1,
      exchange_rate_date: null,
      exchange_rate_source: "",
    });
  });
});
