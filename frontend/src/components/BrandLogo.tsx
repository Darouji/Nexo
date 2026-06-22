import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { colors } from "../theme/colors";
import serkanLogo from "../assets/brand/serkan-logo.png";

type BrandLogoProps = {
  height?: number;
  maxWidth?: number | string;
  subtitle?: string;
  centered?: boolean;
  sx?: SxProps<Theme>;
};

export function BrandLogo({
  height = 46,
  maxWidth = 180,
  subtitle,
  centered = false,
  sx,
}: BrandLogoProps) {
  return (
    <Stack
      spacing={0.6}
      sx={{
        alignItems: centered ? "center" : "flex-start",
        minWidth: 0,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          maxWidth: "100%",
          px: colors.mode === "light" ? 1.5 : 0,
          py: colors.mode === "light" ? 1 : 0,
          borderRadius: colors.mode === "light" ? colors.radius.sm : 0,
          bgcolor:
            colors.mode === "light" ? colors.brand.serkanBlue : "transparent",
          boxShadow:
            colors.mode === "light" ? colors.shadow.card : colors.shadow.none,
        }}
      >
        <Box
          component="img"
          src={serkanLogo}
          alt="SERKAN"
          sx={{
            height,
            maxWidth,
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      </Box>

      {subtitle ? (
        <Typography
          variant="caption"
          sx={{
            color: colors.primary.main,
            fontWeight: 850,
            letterSpacing: "0.09em",
            lineHeight: 1,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Stack>
  );
}
