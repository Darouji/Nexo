/**
 * Estructura base de una pantalla funcional de SERKAN.
 *
 * Mantiene el encabezado y el contenido con separación uniforme para que cada
 * módulo se concentre en sus reglas y secciones, en lugar de reconstruir la
 * composición general de página.
 */
import type { ReactNode } from "react";
import { Box } from "@mui/material";

import { PageHeader, type PageHeaderProps } from "./PageHeader";

type PageShellProps = PageHeaderProps & {
  children: ReactNode;
};

export function PageShell({ children, ...headerProps }: PageShellProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PageHeader {...headerProps} />
      {children}
    </Box>
  );
}
