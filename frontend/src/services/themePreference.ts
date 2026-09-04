export type AppThemeMode = "light" | "dark";

const THEME_MODE_STORAGE_KEY = "nexo_theme_mode";

export function getStoredThemeMode(defaultMode: AppThemeMode = "light") {
  if (typeof window === "undefined") {
    return defaultMode;
  }

  const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

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

export function applyThemeMode(mode: AppThemeMode) {
  setStoredThemeMode(mode);
  window.location.reload();
}
