import { api } from "./api";
import type { AuthUser } from "../types/auth";

export type CreateUserPayload = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: string;
  phone: string;
  position: string;
  area: string;
};

export type CreateUserResponse = {
  detail: string;
  user: AuthUser;
};

export async function createUser(payload: CreateUserPayload) {
  const response = await api.post<CreateUserResponse>(
    "/auth/users/create/",
    payload
  );

  return response.data;
}