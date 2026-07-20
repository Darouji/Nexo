import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";

import {
  SerkanDataGrid,
  type SerkanGridPaginationModel,
  type SerkanGridSortModel,
} from "../../../components/SerkanDataGrid";
import { SectionCard } from "../../../components/SectionCard";
import type {
  AuditOrigin,
  KardexMovement,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

type GlobalKardexSectionProps = {
  hasLoaded: boolean;
  movements: KardexMovement[];
  columns: ColDef<KardexMovement>[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;

  movementType: string;
  onMovementTypeChange: (value: string) => void;

  origin: AuditOrigin | "";
  onOriginChange: (value: AuditOrigin | "") => void;

  onSearch: () => void;
  onClearFilters: () => void;

  paginationModel: SerkanGridPaginationModel;
  onPaginationModelChange: (
    nextPaginationModel: SerkanGridPaginationModel,
  ) => void;
  rowCount: number;

  sortModel: SerkanGridSortModel;
  onSortModelChange: (nextSortModel: SerkanGridSortModel) => void;
};

function isAuditOriginFilter(value: string): value is AuditOrigin | "" {
  return (
    value === "" ||
    value === "MANUAL" ||
    value === "API" ||
    value === "IMPORTACION_EXCEL" ||
    value === "AUTOMATICO" ||
    value === "SISTEMA"
  );
}

export function GlobalKardexSection({
  hasLoaded,
  movements,
  columns,
  loading,
  searchTerm,
  onSearchTermChange,
  movementType,
  onMovementTypeChange,
  origin,
  onOriginChange,
  onSearch,
  onClearFilters,
  paginationModel,
  onPaginationModelChange,
  rowCount,
  sortModel,
  onSortModelChange,
}: GlobalKardexSectionProps) {
  return (
    <SectionCard
      title="Kardex de Inventario"
      subtitle="Historial cronológico y auditado de los movimientos de stock."
      actions={
        <Button
          variant={hasLoaded ? "outlined" : "contained"}
          startIcon={<HistoryIcon />}
          onClick={onSearch}
          disabled={loading}
          sx={
            hasLoaded
              ? {
                  color: colors.text.primary,
                  borderColor: colors.border.medium,
                }
              : undefined
          }
        >
          {loading
            ? "Cargando..."
            : hasLoaded
              ? "Actualizar Kardex"
              : "Cargar Kardex"}
        </Button>
      }
    >
      {!hasLoaded ? (
        <Stack
          spacing={2}
          sx={{
            py: 2,
            alignItems: "flex-start",
          }}
        >
          <Alert severity="info" variant="outlined" sx={{ width: "100%" }}>
            El historial global se carga solo cuando se necesita. Esto mantiene
            el acceso a Inventario más rápido sin alterar la trazabilidad ni los
            movimientos registrados.
          </Alert>

          <Button
            variant="contained"
            startIcon={<HistoryIcon />}
            onClick={onSearch}
            disabled={loading}
          >
            {loading ? "Cargando historial..." : "Cargar historial Kardex"}
          </Button>
        </Stack>
      ) : (
        <>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Buscar movimiento"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSearch();
                }
              }}
              fullWidth
              placeholder="Producto, código SAP, motivo, referencia u operador"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: colors.text.muted }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              select
              label="Movimiento"
              value={movementType}
              onChange={(event) => onMovementTypeChange(event.target.value)}
              sx={{ minWidth: { xs: "100%", lg: 230 } }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="ENTRADA_MANUAL">Entrada manual</MenuItem>
              <MenuItem value="ENTRADA_RECEPCION">
                Entrada por recepción
              </MenuItem>
              <MenuItem value="AJUSTE_INVENTARIO">
                Ajuste de inventario
              </MenuItem>
              <MenuItem value="SALIDA_VENTA">Salida por venta</MenuItem>
              <MenuItem value="REVERSA_ANULACION">
                Reversa por anulación
              </MenuItem>
              <MenuItem value="ENTRADA_IMPORTACION">
                Entrada por importación
              </MenuItem>
            </TextField>

            <TextField
              select
              label="Origen"
              value={origin}
              onChange={(event) => {
                const nextOrigin = event.target.value;

                if (isAuditOriginFilter(nextOrigin)) {
                  onOriginChange(nextOrigin);
                }
              }}
              sx={{ minWidth: { xs: "100%", lg: 190 } }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="MANUAL">Manual</MenuItem>
              <MenuItem value="AUTOMATICO">Automático</MenuItem>
              <MenuItem value="API">API</MenuItem>
              <MenuItem value="IMPORTACION_EXCEL">Importación Excel</MenuItem>
              <MenuItem value="SISTEMA">Sistema</MenuItem>
            </TextField>

            <Button
              variant="contained"
              onClick={onSearch}
              disabled={loading}
              sx={{ minWidth: { xs: "100%", lg: 140 } }}
            >
              Buscar
            </Button>

            <Button
              variant="outlined"
              onClick={onClearFilters}
              disabled={loading}
              sx={{
                minWidth: { xs: "100%", lg: 120 },
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
            >
              Limpiar
            </Button>
          </Stack>

          <SerkanDataGrid
            gridKey="inventory.global-kardex"
            ariaLabel="Kardex global de inventario"
            rows={movements}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            rowCount={rowCount}
            sortModel={sortModel}
            onSortModelChange={onSortModelChange}
          />
        </>
      )}
    </SectionCard>
  );
}
