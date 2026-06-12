// Design Tokens - SERKAN V2
// Estilo: corporativo industrial, mate, sobrio y escalable.
// Regla: ningún componente debe declarar colores sueltos fuera de este archivo.

export const colors = {
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
    main: "#8A3D6E",
    hover: "#9B4A7E",
    activeTab: "#241926",
    soft: "#2A1B2A",
    border: "#6E345A",
    contrastText: "#FFFFFF",
  },

  secondary: {
    main: "#B9852C",
    hover: "#C8933D",
    soft: "#2D2417",
    border: "#8E682C",
    contrastText: "#111318",
  },

  accent: {
    main: "#2F7E88",
    hover: "#3B909B",
    soft: "#17292D",
    border: "#2E6870",
    contrastText: "#FFFFFF",
  },

  status: {
    success: "#3D8B5B",
    successSoft: "#18281F",
    error: "#B84A4A",
    errorSoft: "#2B1B1D",
    warning: "#B9852C",
    warningSoft: "#2D2417",
    info: "#4E6FA8",
    infoSoft: "#1B2230",
  },

  modules: {
    sales: {
      main: "#8A3D6E",
      soft: "#2A1B2A",
      border: "#6E345A",
      shadow: "0 14px 38px rgba(20, 16, 22, 0.28)",
    },
    inventory: {
      main: "#A96F38",
      soft: "#2B2118",
      border: "#7D5838",
      shadow: "0 14px 38px rgba(20, 16, 12, 0.26)",
    },
    commercial: {
      main: "#4F6F82",
      soft: "#1B252D",
      border: "#415C6B",
      shadow: "0 14px 38px rgba(12, 18, 23, 0.26)",
    },
    documents: {
      main: "#B9852C",
      soft: "#2D2417",
      border: "#8E682C",
      shadow: "0 14px 38px rgba(22, 17, 10, 0.24)",
    },
    analytics: {
      main: "#6C5E9E",
      soft: "#211F32",
      border: "#585080",
      shadow: "0 14px 38px rgba(14, 13, 22, 0.25)",
    },
    excel: {
      main: "#3D8B5B",
      soft: "#18281F",
      border: "#356F4B",
      shadow: "0 14px 38px rgba(10, 18, 13, 0.24)",
    },
    collaborators: {
      main: "#4E6FA8",
      soft: "#1B2230",
      border: "#435F8E",
      shadow: "0 14px 38px rgba(12, 15, 24, 0.25)",
    },
    assets: {
      main: "#2F7E88",
      soft: "#17292D",
      border: "#2E6870",
      shadow: "0 14px 38px rgba(8, 18, 20, 0.24)",
    },
    purchases: {
      main: "#4E8A7B",
      soft: "#192823",
      border: "#3D6D61",
      shadow: "0 14px 38px rgba(8, 17, 14, 0.24)",
    },
    audit: {
      main: "#8A90A2",
      soft: "#242833",
      border: "#626978",
      shadow: "0 14px 38px rgba(12, 13, 16, 0.25)",
    },
  },

  border: {
    light: "#2A3040",
    medium: "#384052",
    strong: "#4A5368",
    focus: "#8A3D6E",
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
      "radial-gradient(circle at top left, rgba(138, 61, 110, 0.16), transparent 34%), radial-gradient(circle at top right, rgba(47, 126, 136, 0.12), transparent 32%)",
    subtlePattern:
      "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
  },

  shadow: {
    none: "none",
    card: "0 10px 28px rgba(0, 0, 0, 0.22)",
    elevated: "0 18px 48px rgba(0, 0, 0, 0.28)",
  },

  radius: {
    xs: "6px",
    sm: "10px",
    md: "14px",
    lg: "18px",
    xl: "24px",
  },
};
