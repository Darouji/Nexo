import { describe, expect, it } from "vitest";

import type { AuditLog } from "../../services/auditService";
import {
  getAuditNarrative,
  getAuditTargetLabel,
} from "./auditPresentation";

const rejectedProductAudit: AuditLog = {
  id: 1,
  actor: 7,
  actor_name: "Fabián",
  action: "EDITAR",
  action_display: "Editar",
  origin: "API",
  origin_display: "API",
  module: "inventory",
  model_name: "producto",
  object_id: "18",
  object_repr: "Electricidad - Alternador 24V",
  ip_address: "127.0.0.1",
  user_agent: "Navegador de prueba",
  reason: "",
  metadata: {
    status_code: 400,
    outcome: "rejected",
  },
  target: {
    entity_label: "Producto",
    display_name: "Alternador 24V",
    internal_id: "18",
    identifiers: [
      { key: "modelo", label: "Modelo", value: "Alternador 24V" },
      { key: "codigo_sap", label: "Código SAP", value: "ALT-24V" },
      { key: "categoria", label: "Categoría", value: "Electricidad" },
    ],
  },
  created_at: "2026-07-23T12:00:00Z",
};

describe("presentación humana de auditoría", () => {
  it("identifica un producto por modelo, SAP y categoría", () => {
    expect(getAuditTargetLabel(rejectedProductAudit)).toBe(
      "Modelo: Alternador 24V · Código SAP: ALT-24V · Categoría: Electricidad",
    );
  });

  it("distingue un intento rechazado de un cambio realizado", () => {
    expect(getAuditNarrative(rejectedProductAudit)).toContain(
      "No se realizó ningún cambio.",
    );
    expect(getAuditNarrative(rejectedProductAudit)).toContain(
      "Alternador 24V",
    );
  });

  it("explica el valor anterior y nuevo de un cambio confirmado", () => {
    const completedAudit: AuditLog = {
      ...rejectedProductAudit,
      metadata: {
        outcome: "completed",
        status_code: 200,
        changes: [
          {
            field_name: "modelo",
            old_value: "Alternador 24V",
            new_value: "Alternador 25V",
          },
        ],
      },
      target: {
        ...rejectedProductAudit.target!,
        display_name: "Alternador 25V",
        identifiers: [
          {
            key: "modelo",
            label: "Modelo",
            value: "Alternador 25V",
          },
          ...rejectedProductAudit.target!.identifiers.slice(1),
        ],
      },
    };

    expect(getAuditNarrative(completedAudit)).toContain(
      "Modelo: “Alternador 24V” → “Alternador 25V”",
    );
  });
});
