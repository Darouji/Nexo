import type { Ref } from "react";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { SectionCard } from "../../../components/SectionCard";
import { SmartDataGrid } from "../../../components/SmartDataGrid";
import type {
  PendingReceipt,
  PendingReceiptStatus,
} from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

type PendingReceiptsSectionProps = {
  sectionRef: Ref<HTMLDivElement>;

  pendingReceipts: PendingReceipt[];
  columns: GridColDef[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;

  statusFilter: PendingReceiptStatus | "";
  onStatusFilterChange: (value: PendingReceiptStatus | "") => void;

  onSearch: () => void;
  onClearFilters: () => void;

  paginationModel: GridPaginationModel;
  onPaginationModelChange: (nextPaginationModel: GridPaginationModel) => void;
  rowCount: number;
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
  onSearch,
  onClearFilters,
  paginationModel,
  onPaginationModelChange,
  rowCount,
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
            placeholder="Producto, código SAP, categoría, referencia o motivo"
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

        <SmartDataGrid
          rows={pendingReceipts}
          columns={columns}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          rowCount={rowCount}
          rowNumberOffset={paginationModel.page * paginationModel.pageSize}
        />
      </SectionCard>
    </Box>
  );
}
