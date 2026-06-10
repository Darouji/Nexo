import { createTheme } from "@mui/material/styles";
import { colors } from "./colors";

export const appTheme = createTheme({
  palette: {
    mode: "dark", // Fuerza el modo oscuro base
    background: {
      default: colors.background.main,
      paper: colors.background.paper,
    },
    primary: {
      main: colors.primary.main,
      contrastText: colors.primary.contrastText,
    },
    secondary: {
      main: colors.secondary.main,
      contrastText: colors.secondary.contrastText,
    },
    warning: {
      main: colors.accent.main,
      contrastText: colors.accent.contrastText,
    },
    success: {
      main: colors.status.success,
    },
    error: {
      main: colors.status.error,
    },
    info: {
      main: colors.status.info,
    },
    text: {
      primary: colors.text.primary,
      secondary: colors.text.secondary,
      disabled: colors.text.muted,
    },
    divider: colors.border.light,
  },
  typography: {
    // Fuente moderna y sobria
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: "none", // Evita que los botones estén en MAYÚSCULAS por defecto
      fontWeight: 600,
    },
  },
  components: {
    // Aquí quitamos el "Glow" y sombras redondeadas para dar el aspecto Cyberpunk plano
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Bordes cuadrados y duros
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: "none", // Quita el overlay blanco por defecto de MUI en modo oscuro
        },
      },
    },
  },
});
