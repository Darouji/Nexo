import { api } from "./api";

export interface GrupoEmpresarial {
  id: number;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Ciudad {
  id: number;
  name: string;
  region: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Minera {
  id: number;
  name: string;
  business_group: number | null;
  business_group_name: string | null;
  rut: string | null;
  status: string;
  observations: string;
  created_at: string;
  updated_at: string;
}

export interface EmpresaCliente {
  id: number;
  name: string;
  rut: string | null;
  mining_company: number | null;
  mining_company_name: string | null;
  business_group_name: string | null;
  city: number | null;
  city_name: string | null;
  email: string;
  phone: string;
  address: string;
  status: string;
  observations: string;
  created_at: string;
  updated_at: string;
}

export interface AreaCliente {
  id: number;
  company: number;
  company_name: string;
  name: string;
  location: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SubAreaCliente {
  id: number;
  area: number;
  area_name: string;
  company: number;
  company_name: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContactoCliente {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  company: number;
  company_name: string;
  city: number | null;
  city_name: string | null;
  area: number | null;
  area_name: string | null;
  subarea: number | null;
  subarea_name: string | null;
  email: string;
  phone: string;
  shift: string;
  active_days: number | null;
  rest_days: number | null;
  active_cycle_start_date: string | null;
  shift_mode: string;
  shift_mode_display: string;
  status: string;
  observations: string;
  created_at: string;
  updated_at: string;
}

export async function getGruposEmpresariales() {
  const response = await api.get<GrupoEmpresarial[]>(
    "/commercial/business-groups/",
  );
  return response.data;
}

export async function getCiudades() {
  const response = await api.get<Ciudad[]>("/commercial/cities/");
  return response.data;
}

export async function getMineras() {
  const response = await api.get<Minera[]>("/commercial/mining-companies/");
  return response.data;
}

export async function getEmpresasCliente() {
  const response = await api.get<EmpresaCliente[]>(
    "/commercial/client-companies/",
  );
  return response.data;
}

export async function getAreasCliente() {
  const response = await api.get<AreaCliente[]>("/commercial/client-areas/");
  return response.data;
}

export async function getSubAreasCliente() {
  const response = await api.get<SubAreaCliente[]>(
    "/commercial/client-subareas/",
  );
  return response.data;
}

export async function getContactosCliente() {
  const response = await api.get<ContactoCliente[]>(
    "/commercial/client-contacts/",
  );
  return response.data;
}

export type CreateEmpresaClientePayload = {
  name: string;
  rut?: string | null;
  mining_company?: number | null;
  city?: number | null;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  observations?: string;
};

export type CreateContactoClientePayload = {
  first_name: string;
  last_name?: string;
  position?: string;
  company: number;
  city?: number | null;
  area?: number | null;
  subarea?: number | null;
  email?: string;
  phone?: string;
  shift?: string;
  active_days?: number | null;
  rest_days?: number | null;
  active_cycle_start_date?: string | null;
  shift_mode?: string;
  status?: string;
  observations?: string;
};

export async function createEmpresaCliente(
  payload: CreateEmpresaClientePayload,
) {
  const response = await api.post<EmpresaCliente>(
    "/commercial/client-companies/",
    payload,
  );

  return response.data;
}

export type CreateCiudadPayload = {
  name: string;
  region?: string;
  status?: string;
};

export async function createCiudad(payload: CreateCiudadPayload) {
  const response = await api.post<Ciudad>("/commercial/cities/", payload);
  return response.data;
}

export async function createContactoCliente(
  payload: CreateContactoClientePayload,
) {
  const response = await api.post<ContactoCliente>(
    "/commercial/client-contacts/",
    payload,
  );

  return response.data;
}

export type CreateAreaClientePayload = {
  company: number;
  name: string;
  location?: string;
  description?: string;
  status?: string;
};

export async function createAreaCliente(payload: CreateAreaClientePayload) {
  const response = await api.post<AreaCliente>(
    "/commercial/client-areas/",
    payload,
  );

  return response.data;
}

export type CreateSubAreaClientePayload = {
  area: number;
  name: string;
  description?: string;
  status?: string;
};

export async function createSubAreaCliente(
  payload: CreateSubAreaClientePayload,
) {
  const response = await api.post<SubAreaCliente>(
    "/commercial/client-subareas/",
    payload,
  );

  return response.data;
}
