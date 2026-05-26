import { api } from "./api";
import type { LoginCredentials, LoginResponse } from "../types/auth";

const TOKEN_KEY = "serkan_auth_token";
const USER_KEY = "serkan_auth_user";

export async function login(credentials: LoginCredentials) {
  const response = await api.post<LoginResponse>("/auth/login/", credentials);

  localStorage.setItem(TOKEN_KEY, response.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));

  return response.data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const rawUser = localStorage.getItem(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getStoredToken());
}