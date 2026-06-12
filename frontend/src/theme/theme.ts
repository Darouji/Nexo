import { createTheme } from "@mui/material/styles";
import { colors } from "./colors";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
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
      main: colors.status.warning,
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

  shape: {
    borderRadius: 14,
  },

  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: colors.gradients.page,
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: colors.radius.md,
          boxShadow: colors.shadow.none,
          fontWeight: 800,
          "&:hover": {
            boxShadow: colors.shadow.none,
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: colors.radius.lg,
          boxShadow: colors.shadow.card,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: colors.radius.sm,
          fontWeight: 700,
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: colors.radius.xs,
        },
      },
    },
  },
});
