import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import {
  Alert,
  Button,
  Stack,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { useState } from "react";

import { SerkanFilterToolbar } from "../../../components/filters/SerkanFilterToolbar";
import { SerkanMultiSelectFilter } from "../../../components/filters/SerkanMultiSelectFilter";
import {
  SerkanDataGrid,
  type SerkanGridFilter,
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

  movementType: string[];
  onMovementTypeChange: (value: string[]) => void;

  origin: AuditOrigin[];
  onOriginChange: (value: AuditOrigin[]) => void;

  onSearch: () => void;
  onClearFilters: () => void;

  paginationModel: SerkanGridPaginationModel;
  onPaginationModelChange: (
    nextPaginationModel: SerkanGridPaginationModel,
  ) => void;
  rowCount: number;

  sortModel: SerkanGridSortModel;
  onSortModelChange: (nextSortModel: SerkanGridSortModel) => void;
  onColumnFiltersChange: (filters: SerkanGridFilter[]) => void;
  filterResetKey: number;
  onVisibleColumnsChange: (fieldKeys: string[]) => void;
  exporting: boolean;
  canExportOfficial: boolean;
  onExportView: () => void;
  onExportOfficial: () => void;
};

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
  onColumnFiltersChange,
  filterResetKey,
  onVisibleColumnsChange,
  exporting,
  canExportOfficial,
  onExportView,
  onExportOfficial,
}: GlobalKardexSectionProps) {
  const [filtersOpen, setFiltersOpen] = useState(true);

  return (
    <SectionCard
      title="Movimientos de Kardex"
      subtitle="Un único historial para recepciones, ventas, ajustes, importaciones y reversas."
      tone={colors.modules.inventory}
      actions={
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExportView} disabled={exporting || loading}>
            {exporting ? "Exportando..." : "Exportar resultados filtrados"}
          </Button>
          {canExportOfficial ? (
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExportOfficial} disabled={exporting || loading}>
              Exportación oficial
            </Button>
          ) : null}
          <Button variant={hasLoaded ? "outlined" : "contained"} startIcon={<HistoryIcon />} onClick={onSearch} disabled={loading || exporting} sx={hasLoaded ? { color: colors.text.primary, borderColor: colors.border.medium } : undefined}>
            {loading ? "Cargando..." : hasLoaded ? "Actualizar Kardex" : "Cargar Kardex"}
          </Button>
        </Stack>
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
          <SerkanFilterToolbar
            searchLabel="Buscar movimiento"
            searchPlaceholder="Producto, código SAP, motivo, referencia u operador"
            searchValue={searchTerm}
            onSearchValueChange={onSearchTermChange}
            onApply={onSearch}
            onClear={onClearFilters}
            loading={loading}
            expanded={filtersOpen}
            onExpandedChange={setFiltersOpen}
            activeFiltersCount={movementType.length + origin.length}
            panelId="global-kardex-filter-panel"
          >
            <SerkanMultiSelectFilter
              label="Tipos de movimiento"
              options={[
                { value: "ENTRADA_MANUAL", label: "Entrada manual" },
                { value: "ENTRADA_RECEPCION", label: "Entrada por recepción" },
                { value: "AJUSTE_INVENTARIO", label: "Ajuste de inventario" },
                { value: "SALIDA_VENTA", label: "Salida por venta" },
                { value: "REVERSA_ANULACION", label: "Reversa por anulación" },
                {
                  value: "ENTRADA_IMPORTACION",
                  label: "Entrada por importación",
                },
              ]}
              value={movementType}
              onChange={onMovementTypeChange}
            />

            <SerkanMultiSelectFilter
              label="Orígenes"
              options={[
                { value: "MANUAL", label: "Manual" },
                { value: "AUTOMATICO", label: "Automático" },
                { value: "API", label: "API" },
                {
                  value: "IMPORTACION_EXCEL",
                  label: "Importación Excel",
                },
                { value: "SISTEMA", label: "Sistema" },
              ]}
              value={origin}
              onChange={(values) => onOriginChange(values as AuditOrigin[])}
            />
          </SerkanFilterToolbar>

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
            onFilterModelChange={onColumnFiltersChange}
            filterResetKey={filterResetKey}
            onVisibleColumnsChange={onVisibleColumnsChange}
          />
        </>
      )}
    </SectionCard>
  );
}
