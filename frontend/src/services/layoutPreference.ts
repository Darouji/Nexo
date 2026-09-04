/**
 * Conserva la preferencia visual de navegación elegida por la persona usuaria.
 * El modo modifica la composición de la interfaz, no los módulos ni permisos
 * disponibles para la sesión.
 */
export type AppLayoutMode = "horizontal" | "vertical";

const LAYOUT_MODE_STORAGE_KEY = "nexo_layout_mode";

export function getStoredLayoutMode(): AppLayoutMode | null {
  // El guard permite reutilizar el módulo en entornos donde no existe window.
  if (typeof window === "undefined") {
    return null;
  }

  const storedMode = window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);

  // Se aceptan sólo valores conocidos para no propagar preferencias obsoletas.
  if (storedMode === "horizontal" || storedMode === "vertical") {
    return storedMode;
  }

  return null;
}

export function setStoredLayoutMode(mode: AppLayoutMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
}
