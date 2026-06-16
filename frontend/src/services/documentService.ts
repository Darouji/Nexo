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

export type DocumentType =
  | "FACTURA"
  | "GUIA_DESPACHO"
  | "HES"
  | "FICHA_PRODUCTO"
  | "OTRO"
  | string;

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

function normalizeParams(params: ListParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || undefined,
  };
}

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
