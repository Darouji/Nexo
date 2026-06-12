// Design Tokens - SERKAN V2
// Regla irrompible:
// Ningún componente debe declarar colores HEX/RGB/RGBA sueltos.
// Todo color, gradiente, borde, sombra y radio debe salir desde este archivo.

export type ThemePreset = "clarity" | "clarityBalanced" | "serkanMatte";
export type ThemeMode = "dark" | "light";

// Cambia SOLO estas dos constantes para probar estilos.
export const ACTIVE_THEME_PRESET: ThemePreset = "clarityBalanced";
export const ACTIVE_THEME_MODE: ThemeMode = "dark";

const sharedRadius = {
  xs: "6px",
  sm: "10px",
  md: "14px",
  lg: "18px",
  xl: "24px",
};

const sharedShadow = {
  none: "none",
  card: "0 10px 28px rgba(0, 0, 0, 0.20)",
  elevated: "0 18px 48px rgba(0, 0, 0, 0.26)",
};

const clarityLight = {
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

  primary: {
    main: "#F50087",
    hover: "#D90078",
    activeTab: "rgba(245, 0, 135, 0.10)",
    soft: "rgba(245, 0, 135, 0.08)",
    border: "rgba(245, 0, 135, 0.35)",
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
      shadow: sharedShadow.card,
    },
    inventory: {
      main: "#D87900",
      soft: "rgba(255, 152, 0, 0.12)",
      border: "rgba(216, 121, 0, 0.32)",
      shadow: sharedShadow.card,
    },
    commercial: {
      main: "#4A6A8A",
      soft: "rgba(74, 106, 138, 0.10)",
      border: "rgba(74, 106, 138, 0.32)",
      shadow: sharedShadow.card,
    },
    documents: {
      main: "#B5A100",
      soft: "rgba(243, 234, 95, 0.22)",
      border: "rgba(181, 161, 0, 0.32)",
      shadow: sharedShadow.card,
    },
    analytics: {
      main: "#6A4C9C",
      soft: "rgba(106, 76, 156, 0.10)",
      border: "rgba(106, 76, 156, 0.32)",
      shadow: sharedShadow.card,
    },
    excel: {
      main: "#12884E",
      soft: "rgba(0, 255, 127, 0.12)",
      border: "rgba(18, 136, 78, 0.32)",
      shadow: sharedShadow.card,
    },
    collaborators: {
      main: "#2864C8",
      soft: "rgba(68, 138, 255, 0.10)",
      border: "rgba(40, 100, 200, 0.32)",
      shadow: sharedShadow.card,
    },
    assets: {
      main: "#008E96",
      soft: "rgba(0, 246, 255, 0.10)",
      border: "rgba(0, 142, 150, 0.32)",
      shadow: sharedShadow.card,
    },
    purchases: {
      main: "#198C45",
      soft: "rgba(77, 250, 123, 0.10)",
      border: "rgba(25, 140, 69, 0.32)",
      shadow: sharedShadow.card,
    },
    audit: {
      main: "#6B7280",
      soft: "rgba(107, 114, 128, 0.10)",
      border: "rgba(107, 114, 128, 0.32)",
      shadow: sharedShadow.card,
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
      "radial-gradient(circle at top left, rgba(245, 0, 135, 0.10), transparent 34%), radial-gradient(circle at top right, rgba(0, 142, 150, 0.08), transparent 32%)",
    subtlePattern:
      "linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)",
  },

  shadow: {
    none: "none",
    card: "0 10px 24px rgba(15, 23, 42, 0.08)",
    elevated: "0 18px 46px rgba(15, 23, 42, 0.10)",
  },

  radius: sharedRadius,
};

const palettes = {
  clarity: {
    dark: {
      mode: "dark" as const,

      background: {
        main: "#000000",
        paper: "#161B22",
        elevated: "#161B22",
        header: "#0D1117",
        subtle: "#161B22",
      },

      surface: {
        base: "#161B22",
        soft: "#0D1117",
        muted: "#2D333B",
        hover: "#1F2630",
        selected: "#2D333B",
      },

      text: {
        primary: "#FFFFFF",
        secondary: "rgba(255, 255, 255, 0.70)",
        muted: "rgba(255, 255, 255, 0.50)",
        inverse: "#000000",
      },

      primary: {
        main: "#F50087",
        hover: "#D90078",
        activeTab: "rgba(245, 0, 135, 0.14)",
        soft: "rgba(245, 0, 135, 0.12)",
        border: "rgba(245, 0, 135, 0.48)",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: "#F3EA5F",
        hover: "#D8D052",
        soft: "rgba(243, 234, 95, 0.12)",
        border: "rgba(243, 234, 95, 0.45)",
        contrastText: "#000000",
      },

      accent: {
        main: "#00F6FF",
        hover: "#00DCE5",
        soft: "rgba(0, 246, 255, 0.12)",
        border: "rgba(0, 246, 255, 0.42)",
        contrastText: "#000000",
      },

      status: {
        success: "#00FF7F",
        successSoft: "rgba(0, 255, 127, 0.12)",
        error: "#FF5252",
        errorSoft: "rgba(255, 82, 82, 0.12)",
        warning: "#F3EA5F",
        warningSoft: "rgba(243, 234, 95, 0.12)",
        info: "#00F6FF",
        infoSoft: "rgba(0, 246, 255, 0.12)",
      },

      modules: {
        sales: {
          main: "#F50087",
          soft: "rgba(245, 0, 135, 0.12)",
          border: "rgba(245, 0, 135, 0.42)",
          shadow: sharedShadow.card,
        },
        inventory: {
          main: "#FF9800",
          soft: "rgba(255, 152, 0, 0.12)",
          border: "rgba(255, 152, 0, 0.42)",
          shadow: sharedShadow.card,
        },
        commercial: {
          main: "#4A6A8A",
          soft: "rgba(74, 106, 138, 0.16)",
          border: "rgba(74, 106, 138, 0.48)",
          shadow: sharedShadow.card,
        },
        documents: {
          main: "#F3EA5F",
          soft: "rgba(243, 234, 95, 0.12)",
          border: "rgba(243, 234, 95, 0.42)",
          shadow: sharedShadow.card,
        },
        analytics: {
          main: "#9B88ED",
          soft: "rgba(155, 136, 237, 0.14)",
          border: "rgba(155, 136, 237, 0.42)",
          shadow: sharedShadow.card,
        },
        excel: {
          main: "#00FF7F",
          soft: "rgba(0, 255, 127, 0.12)",
          border: "rgba(0, 255, 127, 0.42)",
          shadow: sharedShadow.card,
        },
        collaborators: {
          main: "#448AFF",
          soft: "rgba(68, 138, 255, 0.13)",
          border: "rgba(68, 138, 255, 0.42)",
          shadow: sharedShadow.card,
        },
        assets: {
          main: "#00F6FF",
          soft: "rgba(0, 246, 255, 0.12)",
          border: "rgba(0, 246, 255, 0.42)",
          shadow: sharedShadow.card,
        },
        purchases: {
          main: "#4DFA7B",
          soft: "rgba(77, 250, 123, 0.12)",
          border: "rgba(77, 250, 123, 0.42)",
          shadow: sharedShadow.card,
        },
        audit: {
          main: "#9E9E9E",
          soft: "rgba(158, 158, 158, 0.14)",
          border: "rgba(158, 158, 158, 0.42)",
          shadow: sharedShadow.card,
        },
      },

      border: {
        light: "#2D333B",
        medium: "#3A424D",
        strong: "#4A5563",
        focus: "#F50087",
      },

      action: {
        hover: "#1F2630",
        selected: "#2D333B",
        muted: "#161B22",
      },

      gradients: {
        page: "linear-gradient(135deg, #000000 0%, #0D1117 48%, #000000 100%)",
        hero: "linear-gradient(135deg, #161B22 0%, #0D1117 52%, #161B22 100%)",
        heroAccent:
          "radial-gradient(circle at top left, rgba(245, 0, 135, 0.16), transparent 34%), radial-gradient(circle at top right, rgba(0, 246, 255, 0.12), transparent 32%)",
        subtlePattern:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },

      shadow: sharedShadow,
      radius: sharedRadius,
    },

    light: clarityLight,
  },

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

      primary: {
        main: "#D92B8A",
        hover: "#E04499",
        activeTab: "rgba(217, 43, 138, 0.16)",
        soft: "rgba(217, 43, 138, 0.11)",
        border: "rgba(217, 43, 138, 0.42)",
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
          "radial-gradient(circle at top left, rgba(217, 43, 138, 0.14), transparent 34%), radial-gradient(circle at top right, rgba(74, 154, 164, 0.13), transparent 34%)",
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

    light: clarityLight,
  },

  serkanMatte: {
    dark: {
      mode: "dark" as const,

      background: {
        main: "#101217",
        paper: "#171A21",
        elevated: "#1D212A",
        header: "#151922",
        subtle: "#202531",
      },

      surface: {
        base: "#171A21",
        soft: "#1D212A",
        muted: "#242A36",
        hover: "#252B38",
        selected: "#2A3040",
      },

      text: {
        primary: "#F1F3F5",
        secondary: "#C2C7D0",
        muted: "#7D8492",
        inverse: "#111318",
      },

      primary: {
        main: "#A83B72",
        hover: "#BA4A82",
        activeTab: "#261A24",
        soft: "#2A1B26",
        border: "#7D355C",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: "#C9A13A",
        hover: "#D4AF4D",
        soft: "#2D2618",
        border: "#8E7432",
        contrastText: "#111318",
      },

      accent: {
        main: "#4A6A8A",
        hover: "#557A9E",
        soft: "#1A232C",
        border: "#405C78",
        contrastText: "#FFFFFF",
      },

      status: {
        success: "#3A8B5B",
        successSoft: "#18281F",
        error: "#B84A4A",
        errorSoft: "#2B1B1D",
        warning: "#C9A13A",
        warningSoft: "#2D2618",
        info: "#4A6A8A",
        infoSoft: "#1A232C",
      },

      modules: {
        sales: {
          main: "#A83B72",
          soft: "#2A1B26",
          border: "#7D355C",
          shadow: sharedShadow.card,
        },
        inventory: {
          main: "#A96F38",
          soft: "#2B2118",
          border: "#7D5838",
          shadow: sharedShadow.card,
        },
        commercial: {
          main: "#4A6A8A",
          soft: "#1A232C",
          border: "#405C78",
          shadow: sharedShadow.card,
        },
        documents: {
          main: "#C9A13A",
          soft: "#2D2618",
          border: "#8E7432",
          shadow: sharedShadow.card,
        },
        analytics: {
          main: "#6A5A9A",
          soft: "#211F32",
          border: "#585080",
          shadow: sharedShadow.card,
        },
        excel: {
          main: "#3A8B5B",
          soft: "#18281F",
          border: "#356F4B",
          shadow: sharedShadow.card,
        },
        collaborators: {
          main: "#4E6FA8",
          soft: "#1B2230",
          border: "#435F8E",
          shadow: sharedShadow.card,
        },
        assets: {
          main: "#2F8C98",
          soft: "#17292D",
          border: "#2E6870",
          shadow: sharedShadow.card,
        },
        purchases: {
          main: "#4E8A7B",
          soft: "#192823",
          border: "#3D6D61",
          shadow: sharedShadow.card,
        },
        audit: {
          main: "#8A90A2",
          soft: "#242833",
          border: "#626978",
          shadow: sharedShadow.card,
        },
      },

      border: {
        light: "#2A3040",
        medium: "#384052",
        strong: "#4A5368",
        focus: "#A83B72",
      },

      action: {
        hover: "#252B38",
        selected: "#2A3040",
        muted: "#202531",
      },

      gradients: {
        page: "linear-gradient(135deg, #101217 0%, #141821 48%, #11151D 100%)",
        hero: "linear-gradient(135deg, #1D212A 0%, #171A21 52%, #202531 100%)",
        heroAccent:
          "radial-gradient(circle at top left, rgba(168, 59, 114, 0.14), transparent 34%), radial-gradient(circle at top right, rgba(74, 106, 138, 0.12), transparent 32%)",
        subtlePattern:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },

      shadow: sharedShadow,
      radius: sharedRadius,
    },

    light: {
      mode: "light" as const,

      background: {
        main: "#F4F1EC",
        paper: "#FFFCF7",
        elevated: "#FFFFFF",
        header: "rgba(255, 252, 247, 0.90)",
        subtle: "#ECE6DD",
      },

      surface: {
        base: "#FFFCF7",
        soft: "#F4F1EC",
        muted: "#ECE6DD",
        hover: "#EFE8DE",
        selected: "#E7DED2",
      },

      text: {
        primary: "#1E1B18",
        secondary: "#5E5A54",
        muted: "#8A8378",
        inverse: "#FFFFFF",
      },

      primary: {
        main: "#9A3D68",
        hover: "#84405F",
        activeTab: "#F1E1EA",
        soft: "#F5E8EF",
        border: "#C98AAE",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: "#B9852C",
        hover: "#9C732E",
        soft: "#F3E6CF",
        border: "#D3A85E",
        contrastText: "#1E1B18",
      },

      accent: {
        main: "#4A6A8A",
        hover: "#3E5D7B",
        soft: "#E3EAF1",
        border: "#9EB0C1",
        contrastText: "#FFFFFF",
      },

      status: {
        success: "#3A7F55",
        successSoft: "#DDEFE5",
        error: "#A94442",
        errorSoft: "#F2DEDE",
        warning: "#B9852C",
        warningSoft: "#F3E6CF",
        info: "#4A6A8A",
        infoSoft: "#E3EAF1",
      },

      modules: {
        sales: {
          main: "#9A3D68",
          soft: "#F5E8EF",
          border: "#C98AAE",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        inventory: {
          main: "#9C6A32",
          soft: "#F1E2D2",
          border: "#C49A68",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        commercial: {
          main: "#4A6A8A",
          soft: "#E3EAF1",
          border: "#9EB0C1",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        documents: {
          main: "#B9852C",
          soft: "#F3E6CF",
          border: "#D3A85E",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        analytics: {
          main: "#6A5A9A",
          soft: "#E8E4F2",
          border: "#A99FD0",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        excel: {
          main: "#3A7F55",
          soft: "#DDEFE5",
          border: "#88B99B",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        collaborators: {
          main: "#4E6FA8",
          soft: "#E3EAF5",
          border: "#9BAFD4",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        assets: {
          main: "#2F7E88",
          soft: "#DDEDEF",
          border: "#8ABAC0",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        purchases: {
          main: "#4E8A7B",
          soft: "#DDEDE9",
          border: "#92BBB1",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
        audit: {
          main: "#757B87",
          soft: "#E5E7EB",
          border: "#B3B8C2",
          shadow: "0 10px 24px rgba(52, 41, 34, 0.08)",
        },
      },

      border: {
        light: "#DED8CF",
        medium: "#C9C0B6",
        strong: "#A99F94",
        focus: "#9A3D68",
      },

      action: {
        hover: "#EFE8DE",
        selected: "#E7DED2",
        muted: "#F4F1EC",
      },

      gradients: {
        page: "linear-gradient(135deg, #F4F1EC 0%, #ECE6DD 48%, #FFFCF7 100%)",
        hero: "linear-gradient(135deg, #FFFCF7 0%, #F4F1EC 52%, #ECE6DD 100%)",
        heroAccent:
          "radial-gradient(circle at top left, rgba(154, 61, 104, 0.10), transparent 34%), radial-gradient(circle at top right, rgba(74, 106, 138, 0.10), transparent 32%)",
        subtlePattern:
          "linear-gradient(rgba(30,27,24,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(30,27,24,0.025) 1px, transparent 1px)",
      },

      shadow: {
        none: "none",
        card: "0 10px 24px rgba(52, 41, 34, 0.08)",
        elevated: "0 18px 46px rgba(52, 41, 34, 0.10)",
      },
      radius: sharedRadius,
    },
  },
};

export const colors = palettes[ACTIVE_THEME_PRESET][ACTIVE_THEME_MODE];
