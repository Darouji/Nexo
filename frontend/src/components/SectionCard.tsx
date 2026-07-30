/**
 * Contenedor visual reutilizable para agrupar una responsabilidad concreta dentro
 * de una página: grilla, formulario, resumen o panel operativo.
 *
 * El tono sólo comunica contexto visual mediante tokens; no representa estados
 * de negocio ni sustituye mensajes accesibles de éxito, advertencia o error.
 */
import type { ReactNode } from "react";
import { Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { colors } from "../theme/colors";

type SectionTone = {
  main: string;
  soft: string;
  border: string;
  shadow?: string;
};

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: SectionTone;
};

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  tone,
}: SectionCardProps) {
  return (
    <Card
      sx={{
        bgcolor: colors.background.paper,
        border: `2px solid ${tone?.border ?? colors.border.light}`,
        boxShadow: tone?.shadow ?? colors.shadow.card,
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

            <Divider
              sx={{
                borderColor: tone?.border ?? colors.border.light,
                mb: 2.4,
              }}
            />
          </>
        ) : null}

        {children}
      </CardContent>
    </Card>
  );
}
