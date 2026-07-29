import { api } from "./api";
import type { AuthUser } from "../types/auth";

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ListResponse<T> = T[] | PaginatedResponse<T>;

export type ListUsersParams = {
  search?: string;
  role?: string;
  status?: string;
};

export type CreateUserPayload = {
  username: string;
  email?: string | null;
  first_name?: string;
  last_name?: string;
  password: string;
  password_confirm: string;
  role: string;
  phone?: string;
  position?: string;
  department?: string;
  observations?: string;
};

export type UpdateUserPayload = {
  email?: string | null;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  is_active?: boolean;
  phone?: string;
  position?: string;
  department?: string;
  observations?: string;
};

export type CreateUserResponse = {
  detail: string;
  user: AuthUser;
};


function normalizeParams(params: ListUsersParams = {}) {
  return {
    search: params.search?.trim() || undefined,
    role: params.role || undefined,
    status: params.status || undefined,
  };
}

export async function fetchUsers(params: ListUsersParams = {}) {
  const firstResponse = await api.get<ListResponse<AuthUser>>("/auth/users/", {
    params: { ...normalizeParams(params), page_size: 100 },
  });
  if (Array.isArray(firstResponse.data)) return firstResponse.data;

  const users = [...firstResponse.data.results];
  let nextUrl = firstResponse.data.next;
  while (nextUrl) {
    const response = await api.get<PaginatedResponse<AuthUser>>(nextUrl);
    users.push(...response.data.results);
    nextUrl = response.data.next;
  }
  return users;
}

export async function createUser(payload: CreateUserPayload) {
  const response = await api.post<CreateUserResponse>(
    "/auth/users/create/",
    payload,
  );

  return response.data;
}

export async function updateUser(userId: number, payload: UpdateUserPayload) {
  const response = await api.patch<AuthUser>(`/auth/users/${userId}/`, payload);
  return response.data;
}

export async function deactivateUser(userId: number) {
  const response = await api.delete<{ detail: string; user: AuthUser }>(
    `/auth/users/${userId}/`,
  );

  return response.data;
}
