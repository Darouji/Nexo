import { api } from "./api";
import {
  clearStoredAuth,
  getStoredAccess,
  getStoredSession,
  getStoredToken,
  getStoredUser,
  persistAuthData,
} from "./authStorage";
import type {
  AuthSessionResponse,
  AuthSessionStatus,
  LoginCredentials,
  LoginResponse,
} from "../types/auth";

function buildSessionFromLoginResponse(data: LoginResponse): AuthSessionStatus {
  return {
    authenticated: true,
    token_created_at: data.token_created_at ?? null,
    token_expires_at: data.token_expires_at ?? null,
    token_expires_in_seconds: data.token_expires_in_seconds ?? null,
    token_expire_hours: data.token_expire_hours ?? null,
  };
}

export async function login(credentials: LoginCredentials) {
  const response = await api.post<LoginResponse>("/auth/login/", credentials);
  const session = buildSessionFromLoginResponse(response.data);

  persistAuthData({
    token: response.data.token,
    user: response.data.user,
    access: response.data.access ?? null,
    session,
  });

  return response.data;
}

export async function fetchAuthSession() {
  const response = await api.get<AuthSessionResponse>("/auth/session/");

  persistAuthData({
    user: response.data.user,
    access: response.data.access,
    session: response.data.session,
  });

  return response.data;
}

export async function logout() {
  try {
    if (getStoredToken()) {
      await api.post("/auth/logout/");
    }
  } finally {
    clearStoredAuth();
  }
}

export function isAuthenticated() {
  return Boolean(getStoredToken());
}

export {
  clearStoredAuth,
  getStoredAccess,
  getStoredSession,
  getStoredToken,
  getStoredUser,
};
