import type { ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { BrandLogo } from "./BrandLogo";
import { colors } from "../theme/colors";

export type WorkspaceNavigationItem = {
  label: string;
  group: "GENERAL" | "OPERACION" | "HERRAMIENTAS";
  helper: string;
  icon: ReactNode;
  accent: { main: string; soft: string; border: string };
};

const groups = [
  { key: "GENERAL", label: "Espacio de trabajo" },
  { key: "OPERACION", label: "Operación diaria" },
  { key: "HERRAMIENTAS", label: "Análisis y herramientas" },
] as const;

export function WorkspaceNavigation({
  activeSection,
  items,
  onSelect,
}: {
  activeSection: string;
  items: WorkspaceNavigationItem[];
  onSelect: (section: string) => void;
}) {
  return (
    <Stack
      sx={{
        height: "100%",
        bgcolor: colors.background.header,
        borderRight: `1px solid ${colors.border.light}`,
      }}
    >
      <Box sx={{ px: 2.3, py: 2.1, borderBottom: `1px solid ${colors.border.light}` }}>
        <BrandLogo height={42} maxWidth={172} subtitle="ERP · ESPACIO OPERATIVO" />
      </Box>

      <Box sx={{ px: 1.25, py: 1.6, flex: 1, overflowY: "auto" }}>
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group.key);
          if (!groupItems.length) return null;

          return (
            <Box key={group.key} sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  px: 1.25,
                  mb: 0.5,
                  color: colors.text.muted,
                  fontSize: "0.66rem",
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                }}
              >
                {group.label}
              </Typography>

              <Stack spacing={0.45}>
                {groupItems.map((item) => {
                  const selected = item.label === activeSection;

                  return (
                    <Button
                      key={item.label}
                      fullWidth
                      onClick={() => onSelect(item.label)}
                      sx={{
                        position: "relative",
                        minHeight: 50,
                        px: 1.1,
                        py: 0.8,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        color: selected ? item.accent.main : colors.text.primary,
                        bgcolor: selected ? item.accent.soft : "transparent",
                        border: `1px solid ${selected ? item.accent.border : "transparent"}`,
                        borderRadius: colors.radius.md,
                        "&::before": selected
                          ? {
                              content: '""',
                              position: "absolute",
                              left: -1,
                              top: 10,
                              bottom: 10,
                              width: 3,
                              borderRadius: "0 4px 4px 0",
                              bgcolor: item.accent.main,
                            }
                          : undefined,
                        "&:hover": {
                          bgcolor: selected ? item.accent.soft : colors.action.hover,
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.1} sx={{ alignItems: "center", width: "100%" }}>
                        <Box
                          sx={{
                            width: 33,
                            height: 33,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            borderRadius: colors.radius.sm,
                            color: selected ? item.accent.main : colors.text.muted,
                            bgcolor: selected ? colors.background.paper : colors.action.muted,
                            "& svg": { fontSize: 20 },
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 900 : 780 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ display: "block", color: colors.text.muted }}>
                            {item.helper}
                          </Typography>
                        </Box>
                      </Stack>
                    </Button>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ px: 2, py: 1.3, borderTop: `1px solid ${colors.border.light}` }}>
        <Typography variant="caption" sx={{ color: colors.text.muted, fontWeight: 750 }}>
          NEXO ERP · V2
        </Typography>
      </Box>
    </Stack>
  );
}
