export type CollaboratorStatus = "ACTIVO" | "INACTIVO" | "SUSPENDIDO";

export type Collaborator = {
  id: number;
  rut: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  area: string;
  email: string;
  phone: string;
  shift: string;
  status: CollaboratorStatus;
  observations: string;
  created_at: string;
  updated_at: string;
};

export type CollaboratorPayload = {
  rut?: string | null;
  first_name: string;
  last_name: string;
  position?: string;
  area?: string;
  email?: string;
  phone?: string;
  shift?: string;
  status: CollaboratorStatus;
  observations?: string;
};