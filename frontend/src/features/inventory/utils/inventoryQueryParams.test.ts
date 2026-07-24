import { describe, expect, it } from "vitest";

import {
  buildKardexMovementPageParams,
  buildPendingReceiptPageParams,
  buildProductPageParams,
} from "./inventoryQueryParams";


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
        categoryFilter: ["4", "7"],
        statusFilter: ["ACTIVO", "INACTIVO"],
        stockControlFilter: "true",
        stockStatusFilter: ["BAJO_MINIMO", "SIN_STOCK"],
        ordering: "modelo",
        paginationModel: { page: 0, pageSize: 25 },
        columnFilters: [],
      },
    );

    expect(result.page).toBe(3);
    expect(result.categoria).toBe("4,7");
    expect(result.status).toBe("ACTIVO,INACTIVO");
    expect(result.stock_status).toBe("BAJO_MINIMO,SIN_STOCK");
    expect(result.controla_stock).toBe(true);
    expect(JSON.parse(result.grid_filters ?? "[]")).toEqual(filters);
  });
});

describe("buildPendingReceiptPageParams", () => {
  it("conserva fechas, estado y filtros remotos de la vista personal", () => {
    const columnFilters = [
      {
        field: "cantidad_pendiente_orden",
        operator: "greaterThan",
        value: 3,
      },
    ];

    const result = buildPendingReceiptPageParams(
      { page: 1, columnFilters },
      {
        searchTerm: "alternador",
        statusFilter: ["PARCIAL", "PENDIENTE"],
        dateFrom: "2026-07-01",
        dateTo: "2026-07-24",
        ordering: "-created_at",
        paginationModel: { page: 0, pageSize: 10 },
        columnFilters: [],
      },
    );

    expect(result.page).toBe(2);
    expect(result.estado).toBe("PARCIAL,PENDIENTE");
    expect(result.fecha_desde).toBe("2026-07-01");
    expect(result.fecha_hasta).toBe("2026-07-24");
    expect(JSON.parse(result.grid_filters ?? "[]")).toEqual(columnFilters);
  });
});

describe("buildKardexMovementPageParams", () => {
  it("serializa varios tipos de movimiento y orígenes como CSV", () => {
    const result = buildKardexMovementPageParams(
      {},
      {
        searchTerm: "",
        movementType: ["ENTRADA_RECEPCION", "SALIDA_VENTA"],
        origin: ["MANUAL", "AUTOMATICO"],
        ordering: "-created_at",
        paginationModel: { page: 0, pageSize: 25 },
        columnFilters: [],
      },
    );

    expect(result.movement_type).toBe("ENTRADA_RECEPCION,SALIDA_VENTA");
    expect(result.origin).toBe("MANUAL,AUTOMATICO");
  });
});
