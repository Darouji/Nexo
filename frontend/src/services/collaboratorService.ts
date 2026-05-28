import { api } from "./api";
import type { Collaborator, CollaboratorPayload } from "../types/collaborator";

export async function getCollaborators(params?: {
  search?: string;
  status?: string;
  area?: string;
}) {
  const response = await api.get<Collaborator[]>("/collaborators/", {
    params,
  });

  return response.data;
}

export async function createCollaborator(payload: CollaboratorPayload) {
  const response = await api.post<Collaborator>("/collaborators/", payload);
  return response.data;
}

export async function updateCollaborator(
  id: number,
  payload: Partial<CollaboratorPayload>
) {
  const response = await api.patch<Collaborator>(`/collaborators/${id}/`, payload);
  return response.data;
}

export async function deleteCollaborator(id: number) {
  await api.delete(`/collaborators/${id}/`);
}