import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { colors } from "../theme/colors";

type BrandLogoProps = {
  height?: number;
  maxWidth?: number | string;
  subtitle?: string;
  centered?: boolean;
  sx?: SxProps<Theme>;
};

export function BrandLogo({ height = 46, maxWidth = 180, subtitle, centered = false, sx }: BrandLogoProps) {
  return (
    <Stack spacing={0.6} sx={{ alignItems: centered ? "center" : "flex-start", minWidth: 0, ...sx }}>
      <Box role="img" aria-label="Nexo ERP/CRM" sx={{ display: "flex", alignItems: "center", gap: 1.2, height, maxWidth }}>
        <Box aria-hidden="true" sx={{ width: height * 0.75, height: height * 0.75, display: "grid", placeItems: "center", borderRadius: 1.5, bgcolor: colors.primary.main, color: colors.primary.contrastText, fontWeight: 900, fontSize: height * 0.45 }}>N</Box>
        <Typography component="span" sx={{ color: colors.text.primary, fontWeight: 850, letterSpacing: "-0.05em", fontSize: height * 0.65, lineHeight: 1 }}>nexo</Typography>
      </Box>
      {subtitle ? <Typography variant="caption" sx={{ color: colors.primary.main, fontWeight: 850, letterSpacing: "0.09em", lineHeight: 1 }}>{subtitle}</Typography> : null}
    </Stack>
  );
}
