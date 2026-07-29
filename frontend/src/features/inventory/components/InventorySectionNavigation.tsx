import { Tabs, Tab } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { colors } from "../../../theme/colors";

const inventorySections = [
  { label: "Catálogo", path: "/inventario/catalogo" },
  { label: "Ubicaciones de inventario", path: "/inventario/ubicaciones" },
] as const;

export type InventorySection =
  | "catalog"
  | "pending-receipts"
  | "locations"
  | "kardex";

export function InventorySectionNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedPath =
    inventorySections.find((section) => section.path === location.pathname)
      ?.path ?? inventorySections[0].path;

  return (
    <Tabs
      value={selectedPath}
      onChange={(_event, nextPath: string) => navigate(nextPath)}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Secciones de inventario"
      sx={{
        minHeight: 44,
        borderBottom: `1px solid ${colors.border.light}`,
        "& .MuiTab-root": {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 850,
        },
      }}
    >
      {inventorySections.map((section) => (
        <Tab
          key={section.path}
          value={section.path}
          label={section.label}
        />
      ))}
    </Tabs>
  );
}
