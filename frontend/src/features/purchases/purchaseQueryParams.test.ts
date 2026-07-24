import { describe, expect, it } from "vitest";
import { buildPurchaseQueryParams } from "./purchaseQueryParams";

describe("buildPurchaseQueryParams", () => {
  it("convierte paginación, multiselección, orden y filtros de columna", () => {
    const result = buildPurchaseQueryParams({
      search: "motor",
      statuses: ["EMITIDA", "RECIBIDA"],
      currencies: ["CLP", "USD"],
      pagination: { page: 2, pageSize: 25 },
      sort: { field: "issue_date", direction: "desc" },
      columnFilters: [{ field: "number", operator: "contains", value: "OC" }],
    });
    expect(result.page).toBe(3);
    expect(result.status).toBe("EMITIDA,RECIBIDA");
    expect(result.ordering).toBe("-issue_date");
    expect(result.grid_filters).toContain("number");
  });
});
