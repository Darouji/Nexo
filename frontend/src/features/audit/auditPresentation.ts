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
  inventorylocation: "Ubicación de inventario",
  inventorytransfer: "Traslado de inventario",
  movimientokardex: "Movimiento de Kardex",
  pendienteporrecibir: "Pendiente por recibir",
  producto: "Producto",
  user: "Usuario",
};

const fieldLabels: Record<string, string> = {
  cantidad_cancelada: "Cantidad cancelada",
  cantidad_pendiente: "Cantidad pendiente",
  cantidad_recibida: "Cantidad recibida",
  categoria: "Categoría",
  codigo_sap: "Código SAP",
  codigo_sap_normalized: "Código SAP normalizado",
  controla_stock: "Maneja inventario",
  description: "Descripción",
  detalle: "Detalle",
  descontinuado: "Producto descontinuado",
  estado: "Estado de recepción",
  modelo: "Modelo",
  name: "Nombre",
  origen: "Origen",
  origen_observacion: "Observación de origen",
  status: "Estado",
  stock_critico: "Stock mínimo",
  stock_actual: "Stock actual",
  visible_name: "Nombre visible de la columna",
};

const apiResourceLabels: Record<string, string> = {
  categorias: "categoría",
  pendientes_por_recibir: "pendiente por recibir",
  productos: "producto",
  transferencias: "traslado de inventario",
  ubicaciones: "ubicación de inventario",
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

const valueLabels: Record<string, string> = {
  ACTIVO: "Activo",
  AJUSTE_INVENTARIO: "Ajuste de inventario",
  ARCHIVADO: "Archivado",
  AUTOMATICO: "Automático",
  CANCELADA: "Cancelada",
  CERRADA_PARCIAL: "Cerrada parcialmente",
  COMPRADO: "Comprado",
  DESCONTINUADO: "Descontinuado",
  ENTRADA_IMPORTACION: "Entrada por importación",
  ENTRADA_MANUAL: "Entrada manual",
  ENTRADA_RECEPCION: "Entrada por recepción",
  FABRICADO: "Fabricado",
  INACTIVO: "Inactivo",
  OTRO: "Otro",
  PARCIAL: "Parcialmente recibida",
  PENDIENTE: "Pendiente",
  RECIBIDA: "Recibida",
  SALIDA_VENTA: "Salida por venta",
  SERVICIO: "Servicio",
};

function getReadableValue(fieldName: string, value: unknown) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return "Sin valor";
  }

  if (
    ["controla_stock", "descontinuado", "has_historical_usage"].includes(
      fieldName,
    )
  ) {
    if (["true", "1", "sí", "si"].includes(rawValue.toLowerCase())) {
      return "Sí";
    }

    if (["false", "0", "no"].includes(rawValue.toLowerCase())) {
      return "No";
    }
  }

  return valueLabels[rawValue] || rawValue;
}

export type ReadableAuditChange = {
  fieldName: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
};

function getMetadataChanges(
  metadata: Record<string, unknown>,
): ReadableAuditChange[] {
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
        fieldName,
        fieldLabel: getFieldLabel(fieldName),
        oldValue: getReadableValue(fieldName, change.old_value),
        newValue: getReadableValue(fieldName, change.new_value),
      },
    ];
  });
}

function buildReadableChange(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
): ReadableAuditChange | null {
  if (oldValue === undefined || newValue === undefined) {
    return null;
  }

  return {
    fieldName,
    fieldLabel: getFieldLabel(fieldName),
    oldValue: getReadableValue(fieldName, oldValue),
    newValue: getReadableValue(fieldName, newValue),
  };
}

export function getAuditReadableChanges(log: AuditLog) {
  const metadata = log.metadata || {};
  const explicitChanges = getMetadataChanges(metadata);

  if (explicitChanges.length > 0) {
    return explicitChanges;
  }

  const operation = getMetadataString(metadata, "operation");
  const inferredChanges: Array<ReadableAuditChange | null> = [];

  if (operation === "category_rename") {
    inferredChanges.push(
      buildReadableChange(
        "name",
        metadata.previous_name,
        metadata.new_name,
      ),
    );
  } else if (operation === "product_category_change") {
    inferredChanges.push(
      buildReadableChange(
        "categoria",
        metadata.previous_category_name,
        metadata.new_category_name,
      ),
    );
  } else if (operation === "product_origin_change") {
    inferredChanges.push(
      buildReadableChange(
        "origen",
        metadata.previous_origin,
        metadata.new_origin,
      ),
    );
  } else if (operation === "product_lifecycle_change") {
    inferredChanges.push(
      buildReadableChange(
        "status",
        metadata.previous_status,
        metadata.new_status,
      ),
      buildReadableChange(
        "descontinuado",
        metadata.previous_discontinued,
        metadata.new_discontinued,
      ),
    );
  } else if (operation === "kardex_movement") {
    inferredChanges.push(
      buildReadableChange(
        "stock_actual",
        metadata.stock_before,
        metadata.stock_after,
      ),
    );
  } else if (operation === "pending_receipt_receive") {
    inferredChanges.push(
      buildReadableChange(
        "cantidad_recibida",
        metadata.received_before,
        metadata.received_after,
      ),
      buildReadableChange(
        "cantidad_pendiente",
        metadata.pending_before,
        metadata.pending_after,
      ),
      buildReadableChange(
        "estado",
        metadata.previous_status,
        metadata.new_status,
      ),
    );
  } else if (operation === "pending_receipt_cancel") {
    inferredChanges.push(
      buildReadableChange(
        "cantidad_cancelada",
        metadata.cancelled_before,
        metadata.cancelled_after,
      ),
      buildReadableChange(
        "cantidad_pendiente",
        metadata.pending_before,
        metadata.pending_after,
      ),
      buildReadableChange(
        "estado",
        metadata.previous_status,
        metadata.new_status,
      ),
    );
  } else if (
    "old_visible_name" in metadata &&
    "new_visible_name" in metadata
  ) {
    inferredChanges.push(
      buildReadableChange(
        "visible_name",
        metadata.old_visible_name,
        metadata.new_visible_name,
      ),
    );
  }

  return inferredChanges.filter(
    (change): change is ReadableAuditChange =>
      change !== null && change.oldValue !== change.newValue,
  );
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

  const operation = getMetadataString(metadata, "operation");

  if (operation === "kardex_movement") {
    const movementType = getReadableValue(
      "movement_type",
      metadata.movement_type,
    ).toLocaleLowerCase("es-CL");
    const quantity = metadata.quantity ?? "sin cantidad";
    const stockBefore = metadata.stock_before ?? "sin dato";
    const stockAfter = metadata.stock_after ?? "sin dato";
    const location = getMetadataString(metadata, "location_name");

    return `${actor} registró ${movementType} por ${quantity} unidad(es) para ${subject}${location ? ` en “${location}”` : ""}. El stock cambió de ${stockBefore} a ${stockAfter}.`;
  }

  if (operation === "inventory_transfer") {
    const quantity = metadata.quantity ?? "sin cantidad";
    const originLocation =
      metadata.origin_location_name ?? "ubicación no informada";
    const destinationLocation =
      metadata.destination_location_name ?? "ubicación no informada";
    const evidence = getMetadataString(metadata, "evidence_reference");

    return `${actor} trasladó ${quantity} unidad(es) de ${subject} desde “${originLocation}” hasta “${destinationLocation}”. El stock total permaneció en ${metadata.stock_total_unchanged ?? "el mismo valor"}.${evidence ? ` Evidencia: “${evidence}”.` : ""}`;
  }

  if (operation === "pending_receipt_create") {
    const quantity = metadata.original_quantity ?? "sin cantidad";
    const reference = getMetadataString(metadata, "reference");

    return `${actor} registró ${quantity} unidad(es) por recibir para ${subject}.${reference ? ` Referencia: “${reference}”.` : ""}`;
  }

  if (operation === "pending_receipt_receive") {
    const quantity = metadata.received_quantity ?? "sin cantidad";

    return `${actor} confirmó la recepción de ${quantity} unidad(es) para ${subject}. La cantidad pendiente cambió de ${metadata.pending_before ?? "sin dato"} a ${metadata.pending_after ?? "sin dato"}.`;
  }

  if (operation === "pending_receipt_cancel") {
    const quantity = metadata.cancelled_quantity ?? "sin cantidad";

    return `${actor} canceló ${quantity} unidad(es) pendientes para ${subject}. La cantidad pendiente cambió de ${metadata.pending_before ?? "sin dato"} a ${metadata.pending_after ?? "sin dato"}.`;
  }

  if (operation === "category_merge") {
    return `${actor} fusionó la categoría “${metadata.source_category_name ?? "sin nombre"}” con “${metadata.destination_category_name ?? "sin nombre"}”. Se trasladaron ${metadata.reassigned_product_count ?? 0} producto(s).`;
  }

  if (operation === "safe_category_delete") {
    return `${actor} eliminó la categoría “${metadata.category_name ?? subject}”.`;
  }

  if (operation === "product_create") {
    const initialStock = metadata.initial_stock ?? 0;

    return `${actor} creó ${subject}. Stock inicial: ${initialStock}.`;
  }

  if (operation === "category_create_from_product") {
    return `${actor} creó la categoría “${metadata.category_name ?? subject}” junto con un producto.`;
  }

  if (log.action === "EXPORTAR" && log.model_name === "producto") {
    const rowCount = metadata.row_count ?? 0;
    const format = String(metadata.format ?? "").toUpperCase() || "archivo";

    return `${actor} exportó ${rowCount} producto(s) del catálogo en formato ${format}.`;
  }

  const changes = getAuditReadableChanges(log);

  if (changes.length > 0) {
    const changeSummary = changes
      .map(
        (change) =>
          `cambió ${change.fieldLabel} de “${change.oldValue}” a “${change.newValue}”`,
      )
      .join("; ");

    return `${actor} modificó ${subject}: ${changeSummary}.`;
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
