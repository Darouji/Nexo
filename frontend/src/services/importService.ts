/**
 * Contratos y operaciones del centro de importación actualmente implementado.
 *
 * Cada archivo crea un lote con hash, filas originales, datos normalizados,
 * mensajes y procedencia. Prevalidar no escribe registros de destino; procesar
 * actúa sólo después de que el lote fue revisado según las reglas del backend.
 */
import { api } from "./api";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ListResponse<T> = T[] | PaginatedResponse<T>;

export type ListParams = {
  search?: string;
  ordering?: string;
};

// El contrato admite nuevos destinos, aunque la implementación actual expone
// importación de productos.
export type ImportTarget = "PRODUCTOS" | string;

export type ImportBatchStatus =
  | "CREADO"
  | "PREVALIDADO"
  | "PROCESADO"
  | "FALLIDO"
  | "CANCELADO"
  | string;

export type ImportRowStatus =
  | "VALIDO"
  | "ERROR"
  | "DUPLICADO"
  | "REQUIERE_REVISION"
  | "OMITIDO"
  | "IMPORTADO"
  | string;

/**
 * Conserva evidencia por fila: entrada original, interpretación normalizada,
 * mensajes y objeto creado cuando el procesamiento fue exitoso.
 */
export interface ImportRow {
  id: number;
  batch: number;
  row_number: number;
  row_status: ImportRowStatus;
  row_status_display: string;
  raw_data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  messages: unknown[];
  imported_content_type: number | null;
  imported_object_id: string;
  imported_repr: string;
  imported_object: {
    content_type: number | null;
    object_id: string;
    repr: string;
  } | null;
  created_at: string;
  updated_at: string;
}

/** Resumen del archivo, su integridad y el resultado agregado de todas sus filas. */
export interface ImportBatch {
  id: number;
  target: ImportTarget;
  target_display: string;
  file: string;
  original_filename: string;
  file_sha256: string;
  content_type: string;
  size_bytes: number;
  batch_status: ImportBatchStatus;
  batch_status_display: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  review_rows: number;
  imported_rows: number;
  omitted_rows: number;
  processed_by: number | null;
  processed_by_name: string;
  processed_at: string | null;
  notes: string;
  rows_preview: ImportRow[];
  status: string;
  created_at: string;
  updated_at: string;
}

export type CreateImportBatchPayload = {
  target: ImportTarget;
  file: File;
  notes?: string;
};

function extractResults<T>(data: ListResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

function normalizeParams(params: ListParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || undefined,
  };
}

/** Adapta listados directos y respuestas paginadas al contrato de las pantallas. */
async function getList<T>(url: string, params: ListParams = {}) {
  const response = await api.get<ListResponse<T>>(url, {
    params: normalizeParams(params),
  });

  return extractResults(response.data);
}

export async function fetchImportBatches(params: ListParams = {}) {
  return getList<ImportBatch>("/imports/batches/", {
    ordering: "-created_at",
    ...params,
  });
}

export async function fetchImportRows(params: ListParams = {}) {
  return getList<ImportRow>("/imports/rows/", {
    ordering: "batch,row_number",
    ...params,
  });
}

/** Carga el archivo sin asumir todavía que sus filas son válidas o importables. */
export async function createImportBatch(payload: CreateImportBatchPayload) {
  const formData = new FormData();
  formData.append("target", payload.target);
  formData.append("file", payload.file);

  if (payload.notes?.trim()) {
    formData.append("notes", payload.notes.trim());
  }

  const response = await api.post<ImportBatch>("/imports/batches/", formData);
  return response.data;
}

/** Analiza y clasifica las filas sin ejecutar la importación definitiva. */
export async function prevalidateImportBatch(batchId: number) {
  const response = await api.post<ImportBatch>(
    `/imports/batches/${batchId}/prevalidate/`,
    {},
  );

  return response.data;
}

/** Solicita al backend procesar el lote ya prevalidado y registrar procedencia. */
export async function processImportBatch(batchId: number) {
  const response = await api.post<ImportBatch>(
    `/imports/batches/${batchId}/process/`,
    {},
  );

  return response.data;
}
