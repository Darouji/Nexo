import { api } from "./api";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ListResponse<T> = T[] | PaginatedResponse<T>;

export type CollaboratorStatus = "ACTIVO" | "INACTIVO" | "ARCHIVADO" | string;

export type ListCollaboratorParams = {
  search?: string;
  status?: string;
  department?: string;
  position?: string;
  linked_user?: "true" | "false";
};

export interface CollaboratorUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  status: string;
  is_active: boolean;
}

export interface Collaborator {
  id: number;
  user: number | null;
  user_detail: CollaboratorUser | null;
  user_username: string;
  user_email: string;
  rut: string | null;
  rut_normalized: string;
  first_name: string;
  last_name: string;
  full_name: string;
  full_name_normalized: string;
  email: string;
  email_normalized: string;
  phone: string;
  position: string;
  department: string;
  shift: string;
  start_date: string | null;
  end_date: string | null;
  status: CollaboratorStatus;
  status_display: string;
  observations: string;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_username: string;
  updated_by: number | null;
  updated_by_username: string;
}

export type CreateCollaboratorPayload = {
  user?: number | null;
  rut?: string | null;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  shift?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: CollaboratorStatus;
  observations?: string;
};

function extractResults<T>(data: ListResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

function normalizeParams(params: ListCollaboratorParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    status: params.status || undefined,
    department: params.department?.trim() || undefined,
    position: params.position?.trim() || undefined,
    linked_user: params.linked_user || undefined,
  };
}

export async function fetchCollaborators(params: ListCollaboratorParams = {}) {
  const response = await api.get<ListResponse<Collaborator>>(
    "/collaborators/",
    {
      params: normalizeParams(params),
    },
  );

  return extractResults(response.data);
}

export async function createCollaborator(payload: CreateCollaboratorPayload) {
  const response = await api.post<Collaborator>("/collaborators/", payload);
  return response.data;
}

export async function updateCollaborator(
  collaboratorId: number,
  payload: Partial<CreateCollaboratorPayload>,
) {
  const response = await api.patch<Collaborator>(
    `/collaborators/${collaboratorId}/`,
    payload,
  );

  return response.data;
}

export async function inactivateCollaborator(collaboratorId: number) {
  const response = await api.delete<{ detail: string }>(
    `/collaborators/${collaboratorId}/`,
  );

  return response.data;
}
