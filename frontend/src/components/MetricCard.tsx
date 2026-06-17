import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { colors } from "../theme/colors";

type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  tone?: {
    main: string;
    soft: string;
    border: string;
  };
};

export function MetricCard({
  title,
  value,
  helper,
  icon,
  tone = colors.primary,
}: MetricCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        boxShadow: colors.shadow.card,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.6} sx={{ alignItems: "center" }}>
          {icon ? (
            <Box
              sx={{
                width: 46,
                height: 46,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: colors.radius.md,
                color: tone.main,
                bgcolor: tone.soft,
                border: `1px solid ${tone.border}`,
                "& svg": { fontSize: 27 },
              }}
            >
              {icon}
            </Box>
          ) : null}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              {title}
            </Typography>

            <Typography
              variant="h5"
              sx={{ color: colors.text.primary, fontWeight: 950 }}
            >
              {value}
            </Typography>

            {helper ? (
              <Typography variant="caption" sx={{ color: colors.text.muted }}>
                {helper}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
