import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { useState, type Ref } from "react";

import { NexoFilterToolbar } from "../../../components/filters/NexoFilterToolbar";
import { NexoMultiSelectFilter } from "../../../components/filters/NexoMultiSelectFilter";
import {
  NexoDataGrid,
  type NexoGridFilter,
  type NexoGridPaginationModel,
  type NexoGridSortModel,
} from "../../../components/NexoDataGrid";
import { SectionCard } from "../../../components/SectionCard";
import type { SavedGridViewConfig } from "../../../services/gridService";
import type {
  PendingReceipt,
  PendingReceiptStatus,
} from "../../../services/inventoryService";

type PendingReceiptsSectionProps = {
  sectionRef: Ref<HTMLDivElement>;

  pendingReceipts: PendingReceipt[];
  columns: ColDef<PendingReceipt>[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;

  statusFilter: PendingReceiptStatus[];
  onStatusFilterChange: (value: PendingReceiptStatus[]) => void;

  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;

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
  onNamedViewApply: (config: SavedGridViewConfig) => void;

  exporting: boolean;
  canExportOfficial: boolean;
  onExportView: () => void;
  onExportOfficial: () => void;
};

export function PendingReceiptsSection({
  sectionRef,
  pendingReceipts,
  columns,
  loading,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
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
  onNamedViewApply,
  exporting,
  canExportOfficial,
  onExportView,
  onExportOfficial,
}: PendingReceiptsSectionProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guidanceVisible, setGuidanceVisible] = useState(true);

  return (
    <Box ref={sectionRef} sx={{ scrollMarginTop: 24 }}>
      <SectionCard
        title="Pendientes por recibir"
        subtitle="Unidades esperadas que todavía no modifican el stock físico."
        actions={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={onExportView}
              disabled={exporting}
            >
              {exporting ? "Exportando..." : "Exportar resultados filtrados"}
            </Button>

            {canExportOfficial ? (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={onExportOfficial}
                disabled={exporting}
              >
                Exportación oficial
              </Button>
            ) : null}
          </Stack>
        }
      >
        {guidanceVisible ? (
          <Alert
            severity="info"
            variant="outlined"
            onClose={() => setGuidanceVisible(false)}
            sx={{ mb: 2 }}
          >
          Registrar una unidad por recibir no aumenta el stock. El stock solo
          cambia cuando se confirma la recepción física y se crea su movimiento
          Kardex.
          </Alert>
        ) : null}

        <NexoFilterToolbar
          searchLabel="Buscar pendiente"
          searchPlaceholder="Producto, código SAP, categoría, OC, factura o motivo"
          searchValue={searchTerm}
          onSearchValueChange={onSearchTermChange}
          onApply={onSearch}
          onClear={onClearFilters}
          loading={loading}
          expanded={filtersOpen}
          onExpandedChange={setFiltersOpen}
          activeFiltersCount={
            statusFilter.length + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))
          }
          panelId="pending-receipts-filter-panel"
        >
          <NexoMultiSelectFilter
            label="Estados"
            options={[
              { value: "PENDIENTE", label: "Pendiente" },
              { value: "PARCIAL", label: "Parcial" },
              { value: "RECIBIDA", label: "Recibida" },
              { value: "CANCELADA", label: "Cancelada" },
              { value: "CERRADA_PARCIAL", label: "Cerrada parcial" },
            ]}
            value={statusFilter}
            onChange={(values) =>
              onStatusFilterChange(values as PendingReceiptStatus[])
            }
          />

          <TextField
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />

          <TextField
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
        </NexoFilterToolbar>


        <NexoDataGrid
          gridKey="inventory.pending-receipts"
          serverManaged
          ariaLabel="Pendientes por recibir de inventario"
          rows={pendingReceipts}
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
          namedViewFilters={{
            search: searchTerm,
            status: statusFilter.join(","),
            date_from: dateFrom,
            date_to: dateTo,
          }}
          onNamedViewApply={onNamedViewApply}
        />
      </SectionCard>
    </Box>
  );
}
