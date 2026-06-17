import type { ReactNode } from "react";
import { Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { colors } from "../theme/colors";

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: SectionCardProps) {
  return (
    <Card
      sx={{
        bgcolor: colors.background.paper,
        border: `1px solid ${colors.border.light}`,
        boxShadow: colors.shadow.card,
      }}
    >
      <CardContent>
        {title || subtitle || actions ? (
          <>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Stack spacing={0.4}>
                {title ? (
                  <Typography
                    variant="h5"
                    sx={{ color: colors.text.primary, fontWeight: 900 }}
                  >
                    {title}
                  </Typography>
                ) : null}

                {subtitle ? (
                  <Typography variant="body2" sx={{ color: colors.text.muted }}>
                    {subtitle}
                  </Typography>
                ) : null}
              </Stack>

              {actions ? (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.2}
                  sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                >
                  {actions}
                </Stack>
              ) : null}
            </Stack>

            <Divider sx={{ borderColor: colors.border.light, mb: 2.4 }} />
          </>
        ) : null}

        {children}
      </CardContent>
    </Card>
  );
}
