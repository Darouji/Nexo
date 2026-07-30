import { Box, Fade, Stack, Typography } from "@mui/material";
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

export function WelcomeScreen({ user }: { user: AuthUser }) {
  return (
    <Box
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
      <Fade in timeout={240}>
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
          <BrandLogo height={54} maxWidth={220} subtitle="ERP OPERATIVO" />
          <Box>
            <Typography variant="h4" sx={{ color: colors.text.primary, fontWeight: 950 }}>
              Bienvenido, {getDisplayName(user)}
            </Typography>
            <Typography sx={{ color: colors.text.secondary, mt: 0.7 }}>
              Preparando tu espacio de trabajo.
            </Typography>
          </Box>
        </Stack>
      </Fade>
    </Box>
  );
}
