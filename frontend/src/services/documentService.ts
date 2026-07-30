/**
 * Contratos y operaciones del repositorio documental de SERKAN.
 *
 * El documento lógico conserva su identidad y propietario; cada archivo cargado
 * crea una versión. Reemplazar no sobrescribe silenciosamente el historial, sino
 * que incorpora una nueva versión con motivo y responsable en el backend.
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
  owner_app?: string;
  owner_model?: string;
  owner_object_id?: string | number;
};

export type DocumentType =
  | "CONTRATO"
  | "ANEXO"
  | "CERTIFICADO"
  | "FACTURA"
  | "GUIA_DESPACHO"
  | "HES"
  | "FICHA_PRODUCTO"
  | "OTRO"
  | string;

/** Versión inmutable de archivo asociada a un documento lógico. */
export interface DocumentVersion {
  id: number;
  document: number;
  version_number: number;
  file: string;
  file_url: string;
  original_filename: string;
  file_sha256: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: number | null;
  uploaded_by_name: string;
  origin: string;
  origin_display: string;
  is_active: boolean;
  replaced_at: string | null;
  replaced_by: number | null;
  replaced_by_name: string;
  replace_reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Documento lógico vinculado mediante ContentType a una entidad de negocio. La
 * versión activa facilita la operación, mientras `versions` preserva historial.
 */
export interface DocumentFile {
  id: number;
  title: string;
  document_type: DocumentType;
  document_type_display: string;
  description: string;
  owner_content_type: number;
  owner_content_type_label: string;
  owner_app: string;
  owner_model: string;
  owner_object_id: string;
  owner_repr: string;
  active_version: DocumentVersion | null;
  versions: DocumentVersion[];
  status: string;
  created_at: string;
  updated_at: string;
}

function extractResults<T>(data: ListResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

/** Omite filtros vacíos para no restringir la consulta involuntariamente. */
function normalizeParams(params: ListParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || undefined,
    owner_app: params.owner_app || undefined,
    owner_model: params.owner_model || undefined,
    owner_object_id: params.owner_object_id || undefined,
  };
}

/** Adapta endpoints que pueden responder como lista directa o página DRF. */
async function getList<T>(url: string, params: ListParams = {}) {
  const response = await api.get<ListResponse<T>>(url, {
    params: normalizeParams(params),
  });

  return extractResults(response.data);
}

export async function fetchDocumentFiles(params: ListParams = {}) {
  return getList<DocumentFile>("/documents/files/", {
    ordering: "-created_at",
    ...params,
  });
}

export async function fetchDocumentVersions(params: ListParams = {}) {
  return getList<DocumentVersion>("/documents/versions/", {
    ordering: "document,-version_number",
    ...params,
  });
}

/** Tipo de entidad que puede ser propietaria de un documento. */
export type DocumentOwnerType = { id: number; app_label: string; model: string; label: string };

export type CreateDocumentPayload = {
  title: string;
  document_type: DocumentType;
  description?: string;
  owner_content_type: number;
  owner_object_id: string | number;
  file: File;
};

export async function fetchDocumentOwnerTypes() {
  const response = await api.get<DocumentOwnerType[]>("/documents/files/owner-types/");
  return response.data;
}

export type DocumentOwnerOption = { id: number; label: string };

/** Recupera sólo registros válidos para el tipo de propietario seleccionado. */
export async function fetchDocumentOwnerOptions(ownerContentType: number) {
  const response = await api.get<DocumentOwnerOption[]>("/documents/files/owner-options/", {
    params: { owner_content_type: ownerContentType },
  });
  return response.data;
}

/**
 * Envía metadatos y archivo en una única solicitud multipart para que el backend
 * pueda validar propiedad, tipo, tamaño, contenido y hash como una sola operación.
 */
export async function createDocumentFile(payload: CreateDocumentPayload) {
  const formData = new FormData();
  formData.append("title", payload.title.trim());
  formData.append("document_type", payload.document_type);
  formData.append("description", payload.description?.trim() || "");
  formData.append("owner_content_type", String(payload.owner_content_type));
  formData.append("owner_object_id", String(payload.owner_object_id));
  formData.append("file", payload.file);
  const response = await api.post<DocumentFile>("/documents/files/", formData);
  return response.data;
}

/**
 * Incorpora una nueva versión y exige un motivo de reemplazo; la versión previa
 * permanece disponible para trazabilidad.
 */
export async function replaceDocumentVersion(
  documentId: number,
  file: File,
  reason: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reason", reason);

  const response = await api.post<DocumentVersion>(
    `/documents/files/${documentId}/replace/`,
    formData,
  );

  return response.data;
}
