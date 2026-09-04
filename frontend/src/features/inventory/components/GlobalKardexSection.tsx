/**
 * Sección de consulta del Kardex global de Inventario.
 *
 * Presenta filtros, paginación y exportaciones sobre el historial confirmado por
 * el backend. No crea ni modifica movimientos: el Kardex se trata aquí como una
 * fuente histórica de lectura y trazabilidad.
 */
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import {
  Alert,
  Button,
  Stack,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { useState } from "react";

import { NexoFilterToolbar } from "../../../components/filters/NexoFilterToolbar";
import { NexoMultiSelectFilter } from "../../../components/filters/NexoMultiSelectFilter";
import {
  NexoDataGrid,
  type NexoGridFilter,
  type NexoGridPaginationModel,
  type NexoGridSortModel,
} from "../../../components/NexoDataGrid";
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

  paginationModel: NexoGridPaginationModel;
  onPaginationModelChange: (
    nextPaginationModel: NexoGridPaginationModel,
  ) => void;
  rowCount: number;

  sortModel: NexoGridSortModel;
  onSortModelChange: (nextSortModel: NexoGridSortModel) => void;
  onColumnFiltersChange: (filters: NexoGridFilter[]) => void;
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
          {/* La exportación de vista respeta el conjunto filtrado y las columnas visibles. */}
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExportView} disabled={exporting || loading}>
            {exporting ? "Exportando..." : "Exportar resultados filtrados"}
          </Button>
          {/* La exportación oficial usa el contrato fijo definido por el backend y requiere permiso explícito. */}
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
      {/* El historial se carga bajo demanda porque puede crecer continuamente; diferir la consulta mejora el acceso inicial sin alterar los registros. */}
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
          <NexoFilterToolbar
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
            <NexoMultiSelectFilter
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

            <NexoMultiSelectFilter
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
          </NexoFilterToolbar>

          {/* La grilla delega paginación, orden y filtros al servidor para no reconstruir un historial parcial en el navegador. */}
          <NexoDataGrid
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
