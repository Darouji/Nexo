import { useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { login } from "../services/authService";
import { colors } from "../theme/colors";
import { getApiErrorMessage } from "../services/api";
import type { AuthUser } from "../types/auth";

type LoginPageProps = {
  onLoginSuccess: (user: AuthUser) => void;
};

type SignalColor = {
  main: string;
  soft: string;
  border: string;
};

type SignalCard = {
  label: string;
  helper: string;
  icon: ReactNode;
  color: SignalColor;
};

const signalCards: SignalCard[] = [
  {
    label: "Ventas",
    helper: "Ingresos, documentos y trazabilidad.",
    icon: <QueryStatsIcon />,
    color: colors.modules.sales,
  },
  {
    label: "Inventario",
    helper: "Stock, Kardex y alertas críticas.",
    icon: <Inventory2Icon />,
    color: colors.modules.inventory,
  },
  {
    label: "Compras",
    helper: "Abastecimiento, costos y recepción.",
    icon: <ShoppingCartIcon />,
    color: colors.modules.purchases,
  },
];

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: colors.radius.md,
    bgcolor: colors.surface.soft,
    color: colors.text.primary,
    "& fieldset": {
      borderColor: colors.border.light,
    },
    "&:hover fieldset": {
      borderColor: colors.primary.border,
    },
    "&.Mui-focused fieldset": {
      borderColor: colors.primary.main,
    },
  },
  "& .MuiInputLabel-root": {
    color: colors.text.secondary,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: colors.primary.main,
  },
  "& .MuiInputBase-input": {
    color: colors.text.primary,
  },
};

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      const response = await login({
        username,
        password,
      });

      onLoginSuccess(response.user);
    } catch (error: unknown) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "No se pudo iniciar sesión. Revisa tus credenciales.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        py: { xs: 3, md: 6 },
        px: { xs: 2, md: 3 },
        background: `${colors.gradients.heroAccent}, ${colors.gradients.page}`,
      }}
    >
      <Container maxWidth="lg">
        <Card
          sx={{
            overflow: "hidden",
            borderRadius: colors.radius.xl,
            border: `1px solid ${colors.border.light}`,
            bgcolor: colors.background.paper,
            boxShadow: colors.shadow.elevated,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" },
              minHeight: { md: 640 },
            }}
          >
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                p: { xs: 3, sm: 4, md: 5 },
                background: `${colors.gradients.heroAccent}, ${colors.gradients.hero}`,
                borderRight: {
                  xs: "none",
                  md: `1px solid ${colors.border.light}`,
                },
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: colors.gradients.subtlePattern,
                  backgroundSize: "44px 44px",
                  pointerEvents: "none",
                }}
              />

              <Stack
                spacing={4}
                sx={{
                  position: "relative",
                  zIndex: 1,
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Chip
                    label="SERKAN V2 // CONTROL OPERATIVO"
                    icon={<ShieldOutlinedIcon />}
                    variant="outlined"
                    sx={{
                      mb: 3,
                      color: colors.primary.main,
                      borderColor: colors.primary.border,
                      bgcolor: colors.primary.soft,
                      fontWeight: 900,
                    }}
                  />

                  <Typography
                    variant="h2"
                    sx={{
                      color: colors.text.primary,
                      fontWeight: 950,
                      letterSpacing: "-0.055em",
                      lineHeight: 0.95,
                      mb: 2,
                      fontSize: { xs: "2.45rem", sm: "3.15rem", md: "4rem" },
                    }}
                  >
                    Plataforma interna de gestión empresarial.
                  </Typography>

                  <Typography
                    variant="h6"
                    sx={{
                      color: colors.text.secondary,
                      maxWidth: 680,
                      lineHeight: 1.55,
                      fontWeight: 500,
                    }}
                  >
                    Accede al sistema centralizado de ventas, inventario,
                    documentos, compras, alertas y trazabilidad operacional de
                    SERKAN.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  {signalCards.map((card) => (
                    <Card
                      key={card.label}
                      sx={{
                        p: 2,
                        bgcolor: colors.surface.base,
                        border: `1px solid ${card.color.border}`,
                        boxShadow: colors.shadow.none,
                      }}
                    >
                      <Stack spacing={1.3}>
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            display: "grid",
                            placeItems: "center",
                            borderRadius: colors.radius.md,
                            color: card.color.main,
                            bgcolor: card.color.soft,
                            border: `1px solid ${card.color.border}`,
                            "& svg": {
                              fontSize: 25,
                            },
                          }}
                        >
                          {card.icon}
                        </Box>

                        <Box>
                          <Typography
                            sx={{
                              color: colors.text.primary,
                              fontWeight: 900,
                              lineHeight: 1.15,
                            }}
                          >
                            {card.label}
                          </Typography>

                          <Typography
                            variant="caption"
                            sx={{
                              color: colors.text.secondary,
                              lineHeight: 1.35,
                              display: "block",
                              mt: 0.5,
                            }}
                          >
                            {card.helper}
                          </Typography>
                        </Box>
                      </Stack>
                    </Card>
                  ))}
                </Box>
              </Stack>
            </Box>

            <CardContent
              sx={{
                p: { xs: 3, sm: 4, md: 5 },
                display: "flex",
                alignItems: "center",
                bgcolor: colors.background.paper,
              }}
            >
              <Box sx={{ width: "100%" }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="h4"
                    component="h1"
                    sx={{
                      color: colors.text.primary,
                      fontWeight: 950,
                      letterSpacing: "-0.035em",
                      mb: 1,
                    }}
                  >
                    Iniciar sesión
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{ color: colors.text.secondary, lineHeight: 1.55 }}
                  >
                    Ingresa con tu cuenta interna para continuar al centro de
                    control operativo.
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: colors.border.light, mb: 3 }} />

                {errorMessage ? (
                  <Alert
                    severity="error"
                    sx={{
                      mb: 2.5,
                      bgcolor: colors.status.errorSoft,
                      border: `1px solid ${colors.status.error}`,
                    }}
                  >
                    {errorMessage}
                  </Alert>
                ) : null}

                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={2.2}>
                    <TextField
                      label="Usuario"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      fullWidth
                      required
                      autoComplete="username"
                      sx={fieldSx}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <ShieldOutlinedIcon
                                sx={{ color: colors.text.muted }}
                              />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <TextField
                      label="Contraseña"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      fullWidth
                      required
                      autoComplete="current-password"
                      sx={fieldSx}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <LockOutlinedIcon
                                sx={{ color: colors.text.muted }}
                              />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading}
                      sx={{
                        minHeight: 52,
                        borderRadius: colors.radius.md,
                        bgcolor: colors.primary.main,
                        color: colors.primary.contrastText,
                        "&:hover": {
                          bgcolor: colors.primary.hover,
                        },
                      }}
                    >
                      {loading ? "Ingresando..." : "Ingresar a SERKAN V2"}
                    </Button>
                  </Stack>
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    mt: 3,
                    color: colors.text.muted,
                    lineHeight: 1.55,
                  }}
                >
                  Acceso restringido a usuarios internos autorizados. Las
                  operaciones críticas deben validarse en backend y quedar
                  trazadas por auditoría.
                </Typography>
              </Box>
            </CardContent>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
