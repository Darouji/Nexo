import type { ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { colors } from "../theme/colors";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: {
    main: string;
    soft: string;
    border: string;
  };
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  tone = colors.primary,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${colors.border.light}`,
        borderRadius: colors.radius.xl,
        p: { xs: 3, md: 4 },
        background: `${colors.gradients.heroAccent}, ${colors.gradients.hero}`,
        boxShadow: colors.shadow.elevated,
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
        direction={{ xs: "column", md: "row" }}
        spacing={3}
        sx={{
          position: "relative",
          zIndex: 1,
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          {icon ? (
            <Box
              sx={{
                width: 54,
                height: 54,
                display: "grid",
                placeItems: "center",
                borderRadius: colors.radius.lg,
                color: tone.main,
                bgcolor: tone.soft,
                border: `1px solid ${tone.border}`,
                flexShrink: 0,
                "& svg": { fontSize: 31 },
              }}
            >
              {icon}
            </Box>
          ) : null}

          <Box>
            {eyebrow ? (
              <Chip
                label={eyebrow}
                size="small"
                variant="outlined"
                sx={{
                  mb: 1.4,
                  color: tone.main,
                  bgcolor: tone.soft,
                  borderColor: tone.border,
                  fontWeight: 850,
                }}
              />
            ) : null}

            <Typography
              variant="h3"
              sx={{
                color: colors.text.primary,
                fontWeight: 950,
                letterSpacing: "-0.05em",
                mb: subtitle ? 1 : 0,
              }}
            >
              {title}
            </Typography>

            {subtitle ? (
              <Typography
                variant="h6"
                sx={{
                  color: colors.text.secondary,
                  maxWidth: 900,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {actions ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ alignItems: { xs: "stretch", sm: "center" } }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
