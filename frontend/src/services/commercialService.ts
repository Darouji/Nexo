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

export interface BaseCommercialRecord {
  [key: string]: unknown;
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Ciudad extends BaseCommercialRecord {
  name: string;
  name_normalized: string;
  region: string;
}

export interface Holding extends BaseCommercialRecord {
  name: string;
  name_normalized: string;
  aliases: string[];
  description: string;
}

export interface Minera extends BaseCommercialRecord {
  name: string;
  name_normalized: string;
  rut: string | null;
  rut_normalized: string;
  holding: number | null;
  holding_name: string | null;
  city: number | null;
  city_name: string | null;
  aliases: string[];
  email: string;
  phone: string;
  address: string;
  observations: string;
}

export interface Area extends BaseCommercialRecord {
  minera: number;
  minera_name: string;
  holding: number | null;
  holding_name: string | null;
  name: string;
  name_normalized: string;
  location: string;
  description: string;
}

export interface Subarea extends BaseCommercialRecord {
  area: number;
  area_name: string;
  minera: number;
  minera_name: string;
  holding: number | null;
  holding_name: string | null;
  name: string;
  name_normalized: string;
  description: string;
}

export interface Contacto extends BaseCommercialRecord {
  first_name: string;
  last_name: string;
  full_name: string;
  full_name_normalized: string;
  position: string;
  holding: number | null;
  holding_name: string | null;
  minera: number;
  minera_name: string;
  area: number;
  area_name: string;
  subarea: number;
  subarea_name: string;
  city: number | null;
  city_name: string | null;
  email: string;
  email_normalized: string;
  phone: string;
  phone_normalized: string;
  shift: string;
  active_days: number | null;
  rest_days: number | null;
  active_cycle_start_date: string | null;
  shift_mode: "DIA" | "NOCHE" | "SIN_DEFINIR" | string;
  shift_mode_display: string;
  observations: string;
}

export type CreateHoldingPayload = {
  name: string;
  aliases?: string[];
  description?: string;
  status?: string;
};

export type CreateMineraPayload = {
  name: string;
  rut?: string | null;
  holding?: number | null;
  city?: number | null;
  aliases?: string[];
  email?: string;
  phone?: string;
  address?: string;
  observations?: string;
  status?: string;
};

export type CreateAreaPayload = {
  minera: number;
  name: string;
  location?: string;
  description?: string;
  status?: string;
};

export type CreateSubareaPayload = {
  area: number;
  name: string;
  description?: string;
  status?: string;
};

export type CreateContactoPayload = {
  first_name: string;
  last_name?: string;
  position?: string;
  subarea: number;
  city?: number | null;
  email?: string;
  phone?: string;
  shift?: string;
  active_days?: number | null;
  rest_days?: number | null;
  active_cycle_start_date?: string | null;
  shift_mode?: "DIA" | "NOCHE" | "SIN_DEFINIR" | string;
  observations?: string;
  status?: string;
};

export type CreateCiudadPayload = {
  name: string;
  region?: string;
  status?: string;
};


function normalizeParams(params: ListParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || undefined,
  };
}

async function getList<T>(url: string, params: ListParams = {}) {
  const firstResponse = await api.get<ListResponse<T>>(url, {
    params: { ...normalizeParams(params), page_size: 100 },
  });
  if (Array.isArray(firstResponse.data)) return firstResponse.data;

  const results = [...firstResponse.data.results];
  let nextUrl = firstResponse.data.next;
  while (nextUrl) {
    const response = await api.get<PaginatedResponse<T>>(nextUrl);
    results.push(...response.data.results);
    nextUrl = response.data.next;
  }
  return results;
}

export async function fetchCiudades(params: ListParams = {}) {
  return getList<Ciudad>("/commercial/cities/", {
    ordering: "name",
    ...params,
  });
}

export async function fetchHoldings(params: ListParams = {}) {
  return getList<Holding>("/commercial/holdings/", {
    ordering: "name",
    ...params,
  });
}

export async function fetchMineras(params: ListParams = {}) {
  return getList<Minera>("/commercial/mineras/", {
    ordering: "name",
    ...params,
  });
}

export async function fetchAreas(params: ListParams = {}) {
  return getList<Area>("/commercial/areas/", {
    ordering: "minera__name,name",
    ...params,
  });
}

export async function fetchSubareas(params: ListParams = {}) {
  return getList<Subarea>("/commercial/subareas/", {
    ordering: "area__minera__name,area__name,name",
    ...params,
  });
}

export async function fetchContactos(params: ListParams = {}) {
  return getList<Contacto>("/commercial/contactos/", {
    ordering: "last_name,first_name",
    ...params,
  });
}

export async function createCiudad(payload: CreateCiudadPayload) {
  const response = await api.post<Ciudad>("/commercial/cities/", payload);
  return response.data;
}

export async function createHolding(payload: CreateHoldingPayload) {
  const response = await api.post<Holding>("/commercial/holdings/", payload);
  return response.data;
}

export async function createMinera(payload: CreateMineraPayload) {
  const response = await api.post<Minera>("/commercial/mineras/", payload);
  return response.data;
}

export async function createArea(payload: CreateAreaPayload) {
  const response = await api.post<Area>("/commercial/areas/", payload);
  return response.data;
}

export async function createSubarea(payload: CreateSubareaPayload) {
  const response = await api.post<Subarea>("/commercial/subareas/", payload);
  return response.data;
}

export async function createContacto(payload: CreateContactoPayload) {
  const response = await api.post<Contacto>("/commercial/contactos/", payload);
  return response.data;
}

export async function updateHolding(id: number, payload: CreateHoldingPayload) {
  const response = await api.patch<Holding>(`/commercial/holdings/${id}/`, payload);
  return response.data;
}

export async function updateMinera(id: number, payload: CreateMineraPayload) {
  const response = await api.patch<Minera>(`/commercial/mineras/${id}/`, payload);
  return response.data;
}

export async function updateArea(id: number, payload: CreateAreaPayload) {
  const response = await api.patch<Area>(`/commercial/areas/${id}/`, payload);
  return response.data;
}

export async function updateSubarea(id: number, payload: CreateSubareaPayload) {
  const response = await api.patch<Subarea>(`/commercial/subareas/${id}/`, payload);
  return response.data;
}

export async function updateContacto(id: number, payload: CreateContactoPayload) {
  const response = await api.patch<Contacto>(`/commercial/contactos/${id}/`, payload);
  return response.data;
}

/**
 * Alias temporales para evitar romper imports antiguos si quedó algún archivo usando nombres previos.
 * La UI nueva debe preferir los nombres Holding, Minera, Area, Subarea y Contacto.
 */
export type GrupoEmpresarial = Holding;
export type AreaCliente = Area;
export type SubAreaCliente = Subarea;
export type ContactoCliente = Contacto;

export const getCiudades = fetchCiudades;
export const getGruposEmpresariales = fetchHoldings;
export const getMineras = fetchMineras;
export const getAreasCliente = fetchAreas;
export const getSubAreasCliente = fetchSubareas;
export const getContactosCliente = fetchContactos;

export const createGrupoEmpresarial = createHolding;
export const createAreaCliente = createArea;
export const createSubAreaCliente = createSubarea;
export const createContactoCliente = createContacto;
