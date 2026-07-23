import { describe, expect, it } from "vitest";

import { isForbiddenSapCode } from "./productFormModel";


describe("isForbiddenSapCode", () => {
  it("reconoce marcadores SAP que no representan un código real", () => {
    for (const sapCode of ["N/A", "SIN SAP", "pendiente", "0000"]) {
      expect(isForbiddenSapCode(sapCode)).toBe(true);
    }
  });

  it("permite un código SAP real o un valor vacío", () => {
    expect(isForbiddenSapCode("")).toBe(false);
    expect(isForbiddenSapCode("SAP-001-A")).toBe(false);
  });
});
