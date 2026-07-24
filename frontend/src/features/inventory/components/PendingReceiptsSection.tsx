import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import type { Ref } from "react";

import {
  SerkanDataGrid,
  type SerkanGridFilter,
  type SerkanGridPaginationModel,
  type SerkanGridSortModel,
} from "../../../components/SerkanDataGrid";
import { SectionCard } from "../../../components/SectionCard";
import type { SavedGridViewConfig } from "../../../services/gridService";
import type {
  PendingReceipt,
  PendingReceiptStatus,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

type PendingReceiptsSectionProps = {
  sectionRef: Ref<HTMLDivElement>;

  pendingReceipts: PendingReceipt[];
  columns: ColDef<PendingReceipt>[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;

  statusFilter: PendingReceiptStatus | "";
  onStatusFilterChange: (value: PendingReceiptStatus | "") => void;

  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;

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
  return (
    <Box ref={sectionRef} sx={{ scrollMarginTop: 24 }}>
      <SectionCard
        title="Pendientes por recibir"
        subtitle="Unidades esperadas que todavía no modifican el stock físico."
      >
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Registrar una unidad por recibir no aumenta el stock. El stock solo
          cambia cuando se confirma la recepción física y se crea su movimiento
          Kardex.
        </Alert>

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Buscar pendiente"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            fullWidth
            placeholder="Producto, código SAP, categoría, OC, factura o motivo"
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
            label="Estado"
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as PendingReceiptStatus | "",
              )
            }
            sx={{ minWidth: { xs: "100%", lg: 220 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="PENDIENTE">Pendiente</MenuItem>
            <MenuItem value="PARCIAL">Parcial</MenuItem>
            <MenuItem value="RECIBIDA">Recibida</MenuItem>
            <MenuItem value="CANCELADA">Cancelada</MenuItem>
            <MenuItem value="CERRADA_PARCIAL">Cerrada parcial</MenuItem>
          </TextField>

          <TextField
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: { xs: "100%", lg: 165 } }}
          />

          <TextField
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: { xs: "100%", lg: 165 } }}
          />

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

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={onExportView}
            disabled={exporting}
          >
            {exporting ? "Exportando..." : "Exportar vista"}
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

        <SerkanDataGrid
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
            status: statusFilter,
            date_from: dateFrom,
            date_to: dateTo,
          }}
          onNamedViewApply={onNamedViewApply}
        />
      </SectionCard>
    </Box>
  );
}
