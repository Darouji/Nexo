/**
 * Servicio de autenticación de la interfaz.
 *
 * Traduce los contratos de login, restauración y cierre de sesión del backend a
 * un estado local coherente. La respuesta del servidor sigue siendo la fuente
 * de verdad para identidad, capacidades y vigencia de la sesión.
 */
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

/** Normaliza los metadatos de sesión incluidos en la respuesta de acceso. */
function buildSessionFromLoginResponse(data: LoginResponse): AuthSessionStatus {
  return {
    authenticated: true,
    token_created_at: data.token_created_at ?? null,
    token_expires_at: data.token_expires_at ?? null,
    token_expires_in_seconds: data.token_expires_in_seconds ?? null,
    token_expire_hours: data.token_expire_hours ?? null,
  };
}

/**
 * Inicia sesión y persiste en una sola operación el token, la identidad y los
 * permisos efectivos devueltos por el backend.
 */
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

/**
 * Revalida una sesión existente al arrancar la aplicación y reemplaza los datos
 * locales por la versión actual del servidor.
 */
export async function fetchAuthSession() {
  const response = await api.get<AuthSessionResponse>("/auth/session/");

  persistAuthData({
    user: response.data.user,
    access: response.data.access,
    session: response.data.session,
  });

  return response.data;
}

/**
 * Intenta invalidar la sesión en el backend y limpia siempre el estado local,
 * incluso cuando la solicitud de cierre no puede completarse.
 */
export async function logout() {
  try {
    if (getStoredToken()) {
      await api.post("/auth/logout/");
    }
  } finally {
    clearStoredAuth();
  }
}

/** Indica únicamente si existe credencial local; AppRoutes confirma su validez. */
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
