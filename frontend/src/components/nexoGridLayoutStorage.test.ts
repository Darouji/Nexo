import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridApi } from "ag-grid-community";

import { restoreNexoGridLayout } from "./nexoGridLayoutStorage";


describe("migración local tolerante de grillas", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("conserva columnas conocidas y descarta las retiradas", () => {
    window.localStorage.setItem(
      "nexo:grid-layout:inventory.products:v3",
      JSON.stringify({
        schemaVersion: 3,
        columnDefinitionIds: ["modelo", "columna_retirada"],
        columns: [
          {
            colId: "modelo",
            width: 320,
            hide: false,
            pinned: "left",
          },
          {
            colId: "columna_retirada",
            width: 180,
            hide: true,
            pinned: null,
          },
        ],
      }),
    );

    const applyColumnState = vi.fn(() => true);
    const api = { applyColumnState } as unknown as GridApi;

    expect(
      restoreNexoGridLayout(api, "inventory.products", [
        "modelo",
        "columna_nueva",
      ]),
    ).toBe(true);
    expect(applyColumnState).toHaveBeenCalledWith({
      state: [
        {
          colId: "modelo",
          width: 320,
          hide: false,
          pinned: "left",
        },
      ],
      applyOrder: true,
    });
  });
});
