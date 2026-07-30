/**
 * Gestiona las tres escalas tipográficas de SERKAN para adaptar la densidad y
 * legibilidad de la interfaz sin duplicar estilos dentro de cada pantalla.
 */
export type AppFontScale = "compact" | "standard" | "large";

const FONT_SCALE_STORAGE_KEY = "serkan_font_scale";

const scaleValues: Record<AppFontScale, string> = {
  compact: "14px",
  standard: "16px",
  large: "18px",
};

export function getStoredFontScale(): AppFontScale {
  if (typeof window === "undefined") {
    return "standard";
  }

  const storedScale = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);

  // Rechaza valores antiguos o manipulados para mantener una escala soportada.
  if (
    storedScale === "compact" ||
    storedScale === "standard" ||
    storedScale === "large"
  ) {
    return storedScale;
  }

  return "standard";
}

/**
 * Aplica el tamaño en el elemento raíz para que los estilos expresados en rem
 * respondan de forma coherente en toda la plataforma.
 */
export function applyFontScale(scale: AppFontScale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  document.documentElement.style.fontSize = scaleValues[scale];
}
