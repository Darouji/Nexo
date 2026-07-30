import { createTheme } from "@mui/material/styles";
import { colors } from "./colors";

const moduleBlockStyle = (border: string, shadow?: string) => ({
  border: `2px solid ${border}`,
  boxShadow: shadow ?? colors.shadow.card,
});

export const appTheme = createTheme({
  palette: {
    mode: colors.mode,

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
    borderRadius: 2,
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
        "[data-serkan-section='inventario'] .MuiCard-root:has([data-grid-key^='inventory.'])":
          moduleBlockStyle(
            colors.modules.inventory.border,
            colors.modules.inventory.shadow,
          ),
        "[data-serkan-section='ventas'] .MuiCard-root:has([data-grid-key^='sales.'])":
          moduleBlockStyle(
            colors.modules.sales.border,
            colors.modules.sales.shadow,
          ),
        "[data-serkan-section='compras'] .MuiCard-root:has([data-grid-key^='purchases.']), [data-serkan-section='compras'] .MuiCard-root:has([data-grid-key^='inventory.pending-receipts'])":
          moduleBlockStyle(
            colors.modules.purchases.border,
            colors.modules.purchases.shadow,
          ),
        "[data-serkan-section='documentos'] .MuiCard-root:has(.MuiDataGrid-root)":
          moduleBlockStyle(
            colors.modules.documents.border,
            colors.modules.documents.shadow,
          ),
        "[data-serkan-section='importaciones'] .MuiCard-root:has(.MuiDataGrid-root)":
          moduleBlockStyle(
            colors.modules.excel.border,
            colors.modules.excel.shadow,
          ),
        "[data-serkan-section='estadisticas'] .MuiCard-root":
          moduleBlockStyle(
            colors.modules.analytics.border,
            colors.modules.analytics.shadow,
          ),
        "[data-serkan-section='comercial'] > .MuiBox-root": {
          ...moduleBlockStyle(
            colors.modules.commercial.border,
            colors.modules.commercial.shadow,
          ),
          padding: "16px",
          backgroundColor: colors.background.paper,
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

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: colors.radius.md,
        },
      },
    },
  },
});
