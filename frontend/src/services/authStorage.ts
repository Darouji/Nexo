/**
 * Persistencia local del estado de autenticación actualmente utilizado por la
 * interfaz: token, identidad, permisos efectivos y estado temporal de sesión.
 *
 * Los datos de acceso almacenados aquí sirven para reconstruir la experiencia
 * visual. Nunca sustituyen la autorización aplicada por el backend.
 */
import type { AccessPayload, AuthSessionStatus, AuthUser } from "../types/auth";

const TOKEN_KEY = "nexo_auth_token";
const USER_KEY = "nexo_auth_user";
const ACCESS_KEY = "nexo_auth_access";
const SESSION_KEY = "nexo_auth_session";

type PersistAuthDataInput = {
  token?: string | null;
  user?: AuthUser | null;
  access?: AccessPayload | null;
  session?: AuthSessionStatus | null;
};

/**
 * Recupera estructuras serializadas y elimina entradas dañadas para impedir que
 * un valor antiguo o incompleto rompa el arranque de toda la aplicación.
 */
function parseStoredJson<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Distingue entre "no actualizar" (undefined), "eliminar" (null) y
 * "persistir" para permitir renovaciones parciales de la sesión.
 */
function setJsonValue<T>(key: string, value: T | null | undefined) {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    localStorage.removeItem(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  return parseStoredJson<AuthUser>(USER_KEY);
}

export function getStoredAccess() {
  return parseStoredJson<AccessPayload>(ACCESS_KEY);
}

export function getStoredSession() {
  return parseStoredJson<AuthSessionStatus>(SESSION_KEY);
}

/**
 * Actualiza únicamente los fragmentos recibidos. Esto permite refrescar usuario,
 * capacidades o vencimiento sin reemplazar innecesariamente el resto del estado.
 */
export function persistAuthData({
  token,
  user,
  access,
  session,
}: PersistAuthDataInput) {
  if (token !== undefined) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  setJsonValue(USER_KEY, user);
  setJsonValue(ACCESS_KEY, access);
  setJsonValue(SESSION_KEY, session);
}

/** Elimina en conjunto cualquier dato que pudiera representar una sesión previa. */
export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(SESSION_KEY);
}
