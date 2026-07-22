import { describe, expect, it } from "vitest";

import { buildProductPageParams } from "./inventoryQueryParams";


describe("buildProductPageParams", () => {
  it("serializa filtros tipados y convierte la página al contrato Django", () => {
    const filters = [
      {
        field: "stock_critico",
        operator: "greaterThan",
        value: 5,
      },
    ];

    const result = buildProductPageParams(
      { columnFilters: filters, page: 2 },
      {
        searchTerm: "sensor",
        categoryFilter: "4",
        statusFilter: "ACTIVO",
        stockControlFilter: "true",
        stockStatusFilter: "BAJO_MINIMO",
        ordering: "modelo",
        paginationModel: { page: 0, pageSize: 25 },
        columnFilters: [],
      },
    );

    expect(result.page).toBe(3);
    expect(result.categoria).toBe(4);
    expect(result.controla_stock).toBe(true);
    expect(JSON.parse(result.grid_filters ?? "[]")).toEqual(filters);
  });
});
