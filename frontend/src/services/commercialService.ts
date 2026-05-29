import { api } from "./api";

export interface GrupoEmpresarial {
  id: number;
  name: string;
  description: string;
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

export interface ContactoCliente {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  company: number;
  company_name: string;
  area: number | null;
  area_name: string | null;
  email: string;
  phone: string;
  shift: string;
  contact_type: string;
  alliance_level: string;
  status: string;
  observations: string;
  created_at: string;
  updated_at: string;
}

export async function getGruposEmpresariales() {
  const response = await api.get<GrupoEmpresarial[]>("/commercial/business-groups/");
  return response.data;
}

export async function getMineras() {
  const response = await api.get<Minera[]>("/commercial/mining-companies/");
  return response.data;
}

export async function getEmpresasCliente() {
  const response = await api.get<EmpresaCliente[]>("/commercial/client-companies/");
  return response.data;
}

export async function getAreasCliente() {
  const response = await api.get<AreaCliente[]>("/commercial/client-areas/");
  return response.data;
}

export async function getContactosCliente() {
  const response = await api.get<ContactoCliente[]>("/commercial/client-contacts/");
  return response.data;
}