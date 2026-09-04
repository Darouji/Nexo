import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PermissionGate } from "./PermissionGate";
import type { AccessPayload, AuthUser } from "../types/auth";


const user: AuthUser = {
  id: 1,
  username: "gestor",
  email: "gestor@example.invalid",
  first_name: "Gestor",
  last_name: "NEXO",
  full_name: "Gestor NEXO",
  role: "RRHH",
  role_display: "RRHH",
  status: "ACTIVO",
  is_active: true,
  is_staff: false,
  is_superuser: false,
  phone: "",
  position: "",
  department: "",
};


function storeAccess(canUpdate: boolean) {
  const access: AccessPayload = {
    role: "RRHH",
    is_management_role: canUpdate,
    is_read_role: true,
    is_audit_role: canUpdate,
    capabilities: {},
    menu: [],
    permissions: {
      grid_labels: {
        can_view: true,
        can_create: false,
        can_update: canUpdate,
        can_delete: false,
      },
    },
  };

  window.localStorage.setItem("nexo_auth_access", JSON.stringify(access));
}


describe("PermissionGate", () => {
  beforeEach(() => window.localStorage.clear());

  it("muestra el renombrado global sólo con capacidad administrativa", () => {
    storeAccess(true);

    const { rerender } = render(
      <PermissionGate
        user={user}
        moduleKey="grid_labels"
        required="can_update"
      >
        <button type="button">Renombrar globalmente</button>
      </PermissionGate>,
    );

    expect(
      screen.getByRole("button", { name: "Renombrar globalmente" }),
    ).toBeInTheDocument();

    storeAccess(false);
    rerender(
      <PermissionGate
        user={user}
        moduleKey="grid_labels"
        required="can_update"
      >
        <button type="button">Renombrar globalmente</button>
      </PermissionGate>,
    );

    expect(
      screen.queryByRole("button", { name: "Renombrar globalmente" }),
    ).not.toBeInTheDocument();
  });
});
