import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { AccessPayload } from "../types/auth";
import { CapabilityGate } from "./CapabilityGate";

function storeAccess(canExportOfficial: boolean) {
  const access: AccessPayload = {
    role: "OPERATIVO",
    is_management_role: false,
    is_read_role: true,
    is_audit_role: false,
    capabilities: {
      "purchases.receive_order": true,
      "purchases.export_official": canExportOfficial,
    },
    menu: [],
    permissions: {},
  };

  window.localStorage.setItem("nexo_auth_access", JSON.stringify(access));
}

describe("CapabilityGate", () => {
  beforeEach(() => window.localStorage.clear());

  it("separa una capacidad específica de los permisos generales del módulo", () => {
    storeAccess(false);

    const { rerender } = render(
      <CapabilityGate capability="purchases.export_official">
        <button type="button">Exportación oficial</button>
      </CapabilityGate>,
    );

    expect(
      screen.queryByRole("button", { name: "Exportación oficial" }),
    ).not.toBeInTheDocument();

    storeAccess(true);
    rerender(
      <CapabilityGate capability="purchases.export_official">
        <button type="button">Exportación oficial</button>
      </CapabilityGate>,
    );

    expect(
      screen.getByRole("button", { name: "Exportación oficial" }),
    ).toBeInTheDocument();
  });
});
