// Design Tokens - NEXO ERP/CRM
// Paleta activa: clarityBalanced
//
// Regla irrompible:
// Ningún componente debe declarar colores HEX/RGB/RGBA sueltos.
// Todo color, gradiente, borde, sombra, radio y estado visual debe salir desde este archivo.

export type ThemePreset = "clarityBalanced";
export type ThemeMode = "dark" | "light";

export const ACTIVE_THEME_PRESET: ThemePreset = "clarityBalanced";

// Cambia solo esta línea para alternar entre modo oscuro y claro.
const THEME_MODE_STORAGE_KEY = "nexo_theme_mode";

function resolveActiveThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (storedMode === "dark" || storedMode === "light") {
    return storedMode;
  }

  return "light";
}

export const ACTIVE_THEME_MODE: ThemeMode = resolveActiveThemeMode();

const sharedRadius = {
  xs: "2px",
  sm: "2px",
  md: "2px",
  lg: "2px",
  xl: "2px",
};

const palettes = {
  clarityBalanced: {
    dark: {
      mode: "dark" as const,

      background: {
        main: "#0B0F16",
        paper: "#161B22",
        elevated: "#1A2029",
        header: "#0D1117",
        subtle: "#111821",
      },

      surface: {
        base: "#161B22",
        soft: "#1A2029",
        muted: "#222A35",
        hover: "#202833",
        selected: "#273140",
      },

      text: {
        primary: "#F4F7FA",
        secondary: "#B8C2CF",
        muted: "#7D8794",
        inverse: "#0B0F16",
      },

      brand: {
        nexoBlue: "#001034",
      },

      primary: {
        main: "#5B7CFA",
        hover: "#6F8DFF",
        activeTab: "rgba(91, 124, 250, 0.16)",
        soft: "rgba(91, 124, 250, 0.11)",
        border: "rgba(91, 124, 250, 0.42)",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: "#D6B94A",
        hover: "#E0C65B",
        soft: "rgba(214, 185, 74, 0.12)",
        border: "rgba(214, 185, 74, 0.38)",
        contrastText: "#0B0F16",
      },

      accent: {
        main: "#4A9AA4",
        hover: "#5CAAB3",
        soft: "rgba(74, 154, 164, 0.12)",
        border: "rgba(74, 154, 164, 0.36)",
        contrastText: "#FFFFFF",
      },

      status: {
        success: "#53B36D",
        successSoft: "rgba(83, 179, 109, 0.12)",
        error: "#D05A5A",
        errorSoft: "rgba(208, 90, 90, 0.12)",
        warning: "#D6B94A",
        warningSoft: "rgba(214, 185, 74, 0.12)",
        info: "#4A9AA4",
        infoSoft: "rgba(74, 154, 164, 0.12)",
      },

      modules: {
        sales: {
          main: "#D92B8A",
          soft: "rgba(217, 43, 138, 0.11)",
          border: "rgba(217, 43, 138, 0.38)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        inventory: {
          main: "#D68A32",
          soft: "rgba(214, 138, 50, 0.12)",
          border: "rgba(214, 138, 50, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        commercial: {
          main: "#5D7F9D",
          soft: "rgba(93, 127, 157, 0.13)",
          border: "rgba(93, 127, 157, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        documents: {
          main: "#D6B94A",
          soft: "rgba(214, 185, 74, 0.12)",
          border: "rgba(214, 185, 74, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        analytics: {
          main: "#8C7AE6",
          soft: "rgba(140, 122, 230, 0.13)",
          border: "rgba(140, 122, 230, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        excel: {
          main: "#53B36D",
          soft: "rgba(83, 179, 109, 0.12)",
          border: "rgba(83, 179, 109, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        collaborators: {
          main: "#5E8DD6",
          soft: "rgba(94, 141, 214, 0.12)",
          border: "rgba(94, 141, 214, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        assets: {
          main: "#4A9AA4",
          soft: "rgba(74, 154, 164, 0.12)",
          border: "rgba(74, 154, 164, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        purchases: {
          main: "#58A98F",
          soft: "rgba(88, 169, 143, 0.12)",
          border: "rgba(88, 169, 143, 0.36)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
        audit: {
          main: "#9AA3B2",
          soft: "rgba(154, 163, 178, 0.12)",
          border: "rgba(154, 163, 178, 0.34)",
          shadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
        },
      },

      border: {
        light: "#273140",
        medium: "#354254",
        strong: "#4C5B70",
        focus: "#D92B8A",
      },

      action: {
        hover: "#202833",
        selected: "#273140",
        muted: "#111821",
      },

      gradients: {
        page: "linear-gradient(135deg, #0B0F16 0%, #101722 44%, #0D1117 100%)",
        hero: "linear-gradient(135deg, #1A2029 0%, #151B24 52%, #18242E 100%)",
        heroAccent:
          "radial-gradient(circle at top left, rgba(91, 124, 250, 0.14), transparent 34%), radial-gradient(circle at top right, rgba(74, 154, 164, 0.13), transparent 34%)",
        subtlePattern:
          "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
      },

      shadow: {
        none: "none",
        card: "0 12px 30px rgba(0, 0, 0, 0.22)",
        elevated: "0 18px 48px rgba(0, 0, 0, 0.26)",
      },

      radius: sharedRadius,
    },

    light: {
      mode: "light" as const,

      background: {
        main: "#F5F5F5",
        paper: "#FFFFFF",
        elevated: "#FFFFFF",
        header: "rgba(255, 255, 255, 0.88)",
        subtle: "#ECEEF2",
      },

      surface: {
        base: "#FFFFFF",
        soft: "#F5F5F5",
        muted: "#ECEEF2",
        hover: "#EEF1F5",
        selected: "#E7EAF0",
      },

      text: {
        primary: "#111111",
        secondary: "rgba(0, 0, 0, 0.70)",
        muted: "rgba(0, 0, 0, 0.54)",
        inverse: "#FFFFFF",
      },

      brand: {
        nexoBlue: "#001034",
      },

      primary: {
        main: "#3157D5",
        hover: "#2648B8",
        activeTab: "rgba(49, 87, 213, 0.10)",
        soft: "rgba(49, 87, 213, 0.08)",
        border: "rgba(49, 87, 213, 0.35)",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: "#D6C900",
        hover: "#BFB400",
        soft: "rgba(243, 234, 95, 0.22)",
        border: "rgba(160, 145, 0, 0.35)",
        contrastText: "#111111",
      },

      accent: {
        main: "#008E96",
        hover: "#007A81",
        soft: "rgba(0, 246, 255, 0.12)",
        border: "rgba(0, 142, 150, 0.32)",
        contrastText: "#FFFFFF",
      },

      status: {
        success: "#12884E",
        successSoft: "rgba(0, 255, 127, 0.14)",
        error: "#C73535",
        errorSoft: "rgba(255, 82, 82, 0.12)",
        warning: "#B59D00",
        warningSoft: "rgba(243, 234, 95, 0.22)",
        info: "#007A81",
        infoSoft: "rgba(0, 246, 255, 0.12)",
      },

      modules: {
        sales: {
          main: "#F50087",
          soft: "rgba(245, 0, 135, 0.08)",
          border: "rgba(245, 0, 135, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        inventory: {
          main: "#D87900",
          soft: "rgba(255, 152, 0, 0.12)",
          border: "rgba(216, 121, 0, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        commercial: {
          main: "#4A6A8A",
          soft: "rgba(74, 106, 138, 0.10)",
          border: "rgba(74, 106, 138, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        documents: {
          main: "#B5A100",
          soft: "rgba(243, 234, 95, 0.22)",
          border: "rgba(181, 161, 0, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        analytics: {
          main: "#6A4C9C",
          soft: "rgba(106, 76, 156, 0.10)",
          border: "rgba(106, 76, 156, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        excel: {
          main: "#12884E",
          soft: "rgba(0, 255, 127, 0.12)",
          border: "rgba(18, 136, 78, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        collaborators: {
          main: "#2864C8",
          soft: "rgba(68, 138, 255, 0.10)",
          border: "rgba(40, 100, 200, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        assets: {
          main: "#008E96",
          soft: "rgba(0, 246, 255, 0.10)",
          border: "rgba(0, 142, 150, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        purchases: {
          main: "#198C45",
          soft: "rgba(77, 250, 123, 0.10)",
          border: "rgba(25, 140, 69, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
        audit: {
          main: "#6B7280",
          soft: "rgba(107, 114, 128, 0.10)",
          border: "rgba(107, 114, 128, 0.32)",
          shadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        },
      },

      border: {
        light: "#E5E7EB",
        medium: "#D1D5DB",
        strong: "#9CA3AF",
        focus: "#F50087",
      },

      action: {
        hover: "#EEF1F5",
        selected: "#E7EAF0",
        muted: "#F5F5F5",
      },

      gradients: {
        page: "linear-gradient(135deg, #F5F5F5 0%, #ECEEF2 48%, #FFFFFF 100%)",
        hero: "linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 52%, #ECEEF2 100%)",
        heroAccent:
          "radial-gradient(circle at top left, rgba(49, 87, 213, 0.10), transparent 34%), radial-gradient(circle at top right, rgba(0, 142, 150, 0.08), transparent 32%)",
        subtlePattern:
          "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
      },

      shadow: {
        none: "none",
        card: "0 10px 24px rgba(15, 23, 42, 0.08)",
        elevated: "0 18px 46px rgba(15, 23, 42, 0.10)",
      },

      radius: sharedRadius,
    },
  },
};

export const colors = palettes[ACTIVE_THEME_PRESET][ACTIVE_THEME_MODE];
