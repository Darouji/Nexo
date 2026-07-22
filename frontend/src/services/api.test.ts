import { describe, expect, it } from "vitest";

import { getApiErrorMessage, getApiRequestId } from "./api";


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
});
