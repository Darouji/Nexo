import axios, { AxiosHeaders, type AxiosError } from "axios";
import { clearStoredAuth, getStoredToken } from "./authStorage";

export const AUTH_UNAUTHORIZED_EVENT = "serkan:auth-unauthorized";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

const API_BASE_URL =
  // En desarrollo Vite redirige /api al backend local. Así se evita una
  // petición cross-origin y el acceso funciona igual desde localhost y 127.0.0.1.
  rawBaseUrl?.replace(/\/$/, "") || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Token ${token}`);
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearStoredAuth();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

function getFirstStringFromObject(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    if (typeof item === "string" && item.trim()) {
      return item;
    }

    if (Array.isArray(item)) {
      const firstText = item.find(
        (entry) => typeof entry === "string" && entry.trim(),
      );

      if (typeof firstText === "string") {
        return firstText;
      }
    }
  }

  return null;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as Record<string, unknown> | undefined;

  if (!data) {
    if (error.code === "ECONNABORTED") {
      return "La solicitud tardó demasiado. Revisa la conexión o el backend.";
    }

    return fallback;
  }

  const errorPayload =
    data.error && typeof data.error === "object"
      ? (data.error as Record<string, unknown>)
      : null;

  const directMessage =
    errorPayload?.message || data.message || data.detail || data.error;

  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  return (
    getFirstStringFromObject(errorPayload) ||
    getFirstStringFromObject(data) ||
    fallback
  );
}

export function getApiRequestId(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const data = error.response?.data as Record<string, unknown> | undefined;
  return typeof data?.request_id === "string" && data.request_id.trim()
    ? data.request_id
    : null;
}
