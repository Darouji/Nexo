/**
 * Administra la preferencia visual de tema utilizada durante el arranque de la
 * aplicación. Los componentes consumen los tokens centrales; este módulo sólo
 * decide qué variante de esos tokens debe cargarse.
 */
export type AppThemeMode = "light" | "dark";

const THEME_MODE_STORAGE_KEY = "nexo_theme_mode";

export function getStoredThemeMode(defaultMode: AppThemeMode = "light") {
  if (typeof window === "undefined") {
    return defaultMode;
  }

  const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  // Ignora valores desconocidos para conservar un tema inicial válido.
  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return defaultMode;
}

export function setStoredThemeMode(mode: AppThemeMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
}

/**
 * Recarga la aplicación porque el tema de Material UI se construye desde la
 * preferencia persistida durante el montaje raíz.
 */
export function applyThemeMode(mode: AppThemeMode) {
  setStoredThemeMode(mode);
  window.location.reload();
}
