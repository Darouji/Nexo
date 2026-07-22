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
