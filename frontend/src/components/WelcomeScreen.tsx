import { Box, Button, Fade, Stack, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { BrandLogo } from "./BrandLogo";
import type { AuthUser } from "../types/auth";
import { colors } from "../theme/colors";

function getDisplayName(user: AuthUser) {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user.full_name || user.username;
}

export function WelcomeScreen({
  user,
  onContinue,
}: {
  user: AuthUser;
  onContinue: () => void;
}) {
  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="nexo-welcome-title"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "grid",
        placeItems: "center",
        px: 2,
        bgcolor: colors.background.main,
        background: `${colors.gradients.heroAccent}, ${colors.gradients.page}`,
      }}
    >
      <Fade in timeout={360}>
        <Stack
          spacing={3}
          sx={{
            width: "100%",
            maxWidth: 620,
            alignItems: "center",
            textAlign: "center",
            px: { xs: 3, sm: 5 },
            py: { xs: 4, sm: 5 },
            bgcolor: colors.background.paper,
            border: `2px solid ${colors.primary.border}`,
            boxShadow: colors.shadow.elevated,
          }}
        >
          <BrandLogo height={76} maxWidth={310} subtitle="ERP OPERATIVO" />

          <Box>
            <Typography
              id="nexo-welcome-title"
              variant="h3"
              sx={{
                color: colors.text.primary,
                fontWeight: 950,
                letterSpacing: "-0.04em",
              }}
            >
              Bienvenido, {getDisplayName(user)}
            </Typography>
            <Typography
              variant="h6"
              sx={{ color: colors.text.secondary, mt: 1.2, fontWeight: 500 }}
            >
              Tu espacio de trabajo en NEXO está preparado.
            </Typography>
          </Box>

          <Button
            autoFocus
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={onContinue}
            sx={{ minWidth: { xs: "100%", sm: 260 }, minHeight: 48 }}
          >
            Entrar a NEXO
          </Button>
        </Stack>
      </Fade>
    </Box>
  );
}
