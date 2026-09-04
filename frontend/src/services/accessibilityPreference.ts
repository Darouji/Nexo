export type AppFontScale = "compact" | "standard" | "large";

const FONT_SCALE_STORAGE_KEY = "nexo_font_scale";

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

  if (
    storedScale === "compact" ||
    storedScale === "standard" ||
    storedScale === "large"
  ) {
    return storedScale;
  }

  return "standard";
}

export function applyFontScale(scale: AppFontScale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  document.documentElement.style.fontSize = scaleValues[scale];
}
