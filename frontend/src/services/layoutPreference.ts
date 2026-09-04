export type AppLayoutMode = "horizontal" | "vertical";

const LAYOUT_MODE_STORAGE_KEY = "nexo_layout_mode";

export function getStoredLayoutMode(): AppLayoutMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedMode = window.localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);

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
