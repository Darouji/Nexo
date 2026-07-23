import type {
  AuditLog,
  AuditTargetIdentifier,
  RecordChangeLog,
} from "../../services/auditService";

const moduleLabels: Record<string, string> = {
  accounts: "Usuarios",
  auth: "Acceso",
  collaborators: "Colaboradores",
  commercial: "Comercial",
  documents: "Documentos",
  imports: "Importaciones",
  inventory: "Inventario",
  sales: "Ventas",
};

const modelLabels: Record<string, string> = {
  categoria: "Categoría",
  column_display_name: "Nombre de columna",
  movimientokardex: "Movimiento de Kardex",
  pendienteporrecibir: "Pendiente por recibir",
  producto: "Producto",
  user: "Usuario",
};

const fieldLabels: Record<string, string> = {
  codigo_sap: "Código SAP",
  codigo_sap_normalized: "Código SAP normalizado",
  controla_stock: "Maneja inventario",
  detalle: "Detalle",
  descontinuado: "Producto descontinuado",
  modelo: "Modelo",
  origen: "Origen",
  origen_observacion: "Observación de origen",
  status: "Estado",
  stock_critico: "Stock mínimo",
  stock_actual: "Stock actual",
};

const apiResourceLabels: Record<string, string> = {
  categorias: "categoría",
  pendientes_por_recibir: "pendiente por recibir",
  productos: "producto",
  usuarios: "usuario",
  ventas: "venta",
};

export function getModuleLabel(module: string) {
  return moduleLabels[module] || module || "Sistema";
}

export function getModelLabel(model: string) {
  return modelLabels[model] || model || "registro";
}

export function getFieldLabel(field: string) {
  return fieldLabels[field] || field || "campo";
}

export function getAuditOriginLabel(log: AuditLog) {
  const labels: Record<string, string> = {
    API: "Desde la plataforma",
    MANUAL: "Acción manual",
    IMPORTACION_EXCEL: "Importación desde Excel",
    AUTOMATICO: "Proceso automático",
    SISTEMA: "Sistema",
  };

  return labels[log.origin] || log.origin_display || log.origin;
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getReadableChanges(metadata: Record<string, unknown>) {
  const rawChanges = metadata.changes;

  if (!Array.isArray(rawChanges)) {
    return [];
  }

  return rawChanges.flatMap((rawChange) => {
    if (!rawChange || typeof rawChange !== "object") {
      return [];
    }

    const change = rawChange as Record<string, unknown>;
    const fieldName =
      typeof change.field_name === "string" ? change.field_name : "";

    if (!fieldName) {
      return [];
    }

    return [
      {
        fieldLabel: getFieldLabel(fieldName),
        oldValue: String(change.old_value ?? "") || "sin valor",
        newValue: String(change.new_value ?? "") || "sin valor",
      },
    ];
  });
}

export function isRejectedAuditRequest(log: AuditLog) {
  const outcome = getMetadataString(log.metadata || {}, "outcome");
  const statusCode = getMetadataNumber(log.metadata || {}, "status_code");

  return outcome === "rejected" || (statusCode !== null && statusCode >= 400);
}

function getApiPathTarget(log: AuditLog) {
  const path = getMetadataString(log.metadata || {}, "path");
  const segments = path.split("/").filter(Boolean);
  const inventoryIndex = segments.indexOf("inventory");

  if (inventoryIndex === -1) {
    return "la solicitud";
  }

  const resource = segments[inventoryIndex + 1] || "registro";
  const resourceLabel = apiResourceLabels[resource] || resource;
  const possibleId = segments[inventoryIndex + 2];

  return possibleId && /^\d+$/.test(possibleId)
    ? `${resourceLabel} #${possibleId}`
    : resourceLabel;
}

function readableIdentifier(identifier: AuditTargetIdentifier) {
  if (identifier.value.trim()) {
    return identifier;
  }

  return {
    ...identifier,
    value:
      identifier.key === "codigo_sap"
        ? "Sin Código SAP"
        : "Sin información",
  };
}

export function getAuditTargetIdentifiers(log: AuditLog) {
  return (log.target?.identifiers || []).map(readableIdentifier);
}

export function getAuditTargetLabel(log: AuditLog) {
  const identifiers = getAuditTargetIdentifiers(log);

  if (identifiers.length > 0) {
    return identifiers
      .map((identifier) => `${identifier.label}: ${identifier.value}`)
      .join(" · ");
  }

  if (log.target?.display_name) {
    return log.target.display_name;
  }

  return isRejectedAuditRequest(log)
    ? getApiPathTarget(log)
    : log.object_repr || getModelLabel(log.model_name);
}

export function getAuditActionLabel(log: AuditLog) {
  return isRejectedAuditRequest(log)
    ? "Intento rechazado"
    : log.action_display || log.action;
}

export function getAuditNarrative(log: AuditLog) {
  const actor = log.actor_name || "El sistema";
  const subject = getAuditTargetLabel(log);
  const metadata = log.metadata || {};
  const statusCode = getMetadataNumber(metadata, "status_code");

  if (isRejectedAuditRequest(log)) {
    return `${actor} intentó realizar la acción “${log.action_display || log.action}” sobre ${subject}, pero el sistema rechazó la solicitud. No se realizó ningún cambio.${statusCode ? ` Referencia técnica: código ${statusCode}.` : ""}`;
  }

  const changes = getReadableChanges(metadata);

  if (changes.length > 0) {
    const changeSummary = changes
      .map(
        (change) =>
          `${change.fieldLabel}: “${change.oldValue}” → “${change.newValue}”`,
      )
      .join("; ");

    return `${actor} actualizó ${subject}. Cambios realizados: ${changeSummary}.`;
  }

  if (log.action === "LOGIN") {
    return `${actor} inició sesión en la plataforma.`;
  }

  if (log.action === "LOGOUT") {
    return `${actor} cerró sesión en la plataforma.`;
  }

  return `${actor} realizó la acción “${log.action_display || log.action}” sobre ${subject}.`;
}

export function getChangeNarrative(change: RecordChangeLog) {
  const actor = change.changed_by_name || "El sistema";
  const field = getFieldLabel(change.field_name);
  const previousValue = change.old_value || "sin valor";
  const newValue = change.new_value || "sin valor";

  return `${actor} cambió ${field} desde “${previousValue}” a “${newValue}”.`;
}
