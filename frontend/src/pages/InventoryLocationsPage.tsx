import Inventory2Icon from "@mui/icons-material/Inventory2";
import { Alert, Box, Stack } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { PageShell } from "../components/PageShell";
import { SectionCard } from "../components/SectionCard";
import { InventorySectionNavigation } from "../features/inventory/components/InventorySectionNavigation";
import { InventorySummaryCards } from "../features/inventory/components/InventorySummaryCards";
import { InventoryLocationsSection } from "../features/inventory/locations/InventoryLocationsSection";
import { emptyInventorySummary } from "../features/inventory/state/inventoryPageState";
import { getApiErrorMessage } from "../services/api";
import {
  fetchInventorySummary,
  type InventorySummary,
} from "../services/inventoryService";
import { colors } from "../theme/colors";

export function InventoryLocationsPage() {
  const [summary, setSummary] = useState<InventorySummary>(emptyInventorySummary);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchInventorySummary());
    } catch (error: unknown) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "No se pudo actualizar el resumen de inventario.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <PageShell
      title="Ubicaciones de inventario"
      subtitle="Bodegas, domicilios bajo responsabilidad, existencias por ubicación y traslados."
      eyebrow="Inventario"
      icon={<Inventory2Icon />}
      tone={colors.modules.inventory}
    >
      <InventorySummaryCards summary={summary} />

      {successMessage ? (
        <Alert
          severity="success"
          variant="outlined"
          onClose={() => setSuccessMessage("")}
        >
          {successMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert
          severity="error"
          variant="outlined"
          onClose={() => setErrorMessage("")}
        >
          {errorMessage}
        </Alert>
      ) : null}

      <SectionCard
        title="Ubicaciones y custodia"
        subtitle="Distribución física del stock, responsables de custodia y traslados inmutables entre ubicaciones."
        tone={colors.modules.inventory}
      >
        <Stack spacing={2}>
          <InventorySectionNavigation embedded />

          <Box
            sx={{
              "& > .MuiCard-root": {
                border: 0,
                boxShadow: "none",
                bgcolor: "transparent",
              },
              "& > .MuiCard-root > .MuiCardContent-root": {
                p: 0,
                "&:last-child": { pb: 0 },
              },
              "& > .MuiCard-root > .MuiCardContent-root > .MuiStack-root:first-of-type > .MuiStack-root:first-of-type": {
                display: "none",
              },
              "& > .MuiCard-root > .MuiCardContent-root > .MuiDivider-root": {
                mt: 0,
              },
            }}
          >
            <InventoryLocationsSection
              onError={setErrorMessage}
              onSuccess={setSuccessMessage}
              onLocationsChanged={loadSummary}
              onInventoryChanged={loadSummary}
            />
          </Box>
        </Stack>
      </SectionCard>
    </PageShell>
  );
}
