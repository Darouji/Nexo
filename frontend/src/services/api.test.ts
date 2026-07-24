import { describe, expect, it } from "vitest";

import {
  getApiErrorMessage,
  getApiFieldErrors,
  getApiRequestId,
} from "./api";


describe("contrato de errores API", () => {
  it("lee el mensaje anidado y conserva el request id", () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          success: false,
          error: {
            code: "grid_preference_conflict",
            message: "La preferencia cambió en otra sesión.",
            details: {},
          },
          request_id: "request-grid-123",
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe(
      "La preferencia cambió en otra sesión.",
    );
    expect(getApiRequestId(error)).toBe("request-grid-123");
  });

  it("extrae las explicaciones de validación para cada campo", () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          success: false,
          error: {
            code: "invalid",
            message: "Hay errores de validación.",
            details: {
              ubicacion: [
                "El producto no tiene stock en la ubicación seleccionada.",
              ],
              cantidad: ["La cantidad supera el saldo disponible."],
            },
          },
        },
      },
    };

    expect(getApiFieldErrors(error)).toEqual({
      ubicacion: "El producto no tiene stock en la ubicación seleccionada.",
      cantidad: "La cantidad supera el saldo disponible.",
    });
  });
});
