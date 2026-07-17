import CategoryIcon from "@mui/icons-material/Category";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { colors } from "../../../theme/colors";
import { MetricCard } from "../../../components/MetricCard";
import { SectionCard } from "../../../components/SectionCard";
import {
  Box,
  Button,
  Collapse,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import {
  SerkanDataGrid,
  type SerkanGridPaginationModel,
  type SerkanGridSortModel,
} from "../../../components/SerkanDataGrid";

import type { ColDef } from "ag-grid-community";
import type { ReactNode } from "react";
import type {
  Category,
  InventorySummary,
  Product,
  ProductStockStatus,
} from "../../../services/inventoryService";

type InventoryCatalogSectionProps = {
  inventorySummary: InventorySummary;
  products: Product[];
  categories: Category[];
  columns: ColDef<Product>[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSubmitProductSearch: () => void;
  onExecuteProductSearch: () => void;

  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeProductFiltersCount: number;

  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;

  statusFilter: string;
  onStatusFilterChange: (value: string) => void;

  stockControlFilter: string;
  onStockControlFilterChange: (value: string) => void;

  stockStatusFilter: ProductStockStatus | "";
  onStockStatusFilterChange: (value: ProductStockStatus | "") => void;

  onClearProductFilters: () => void;

  productPaginationModel: SerkanGridPaginationModel;
  onProductPaginationModelChange: (
    nextPaginationModel: SerkanGridPaginationModel,
  ) => void;
  productRowCount: number;

  productSortModel: SerkanGridSortModel;
  onProductSortModelChange: (nextSortModel: SerkanGridSortModel) => void;

  onOpenCategoryManager: () => void;

  feedbackSlot?: ReactNode;
};

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

function formatNumber(value: number) {
  return chileanNumberFormatter.format(value);
}

function isValidStockStatusFilter(
  value: string,
): value is ProductStockStatus | "" {
  return (
    value === "" ||
    value === "STOCK_CORRECTO" ||
    value === "BAJO_MINIMO" ||
    value === "SIN_STOCK" ||
    value === "NO_CONTROLA_STOCK"
  );
}

export function InventoryCatalogSection({
  inventorySummary,
  products,
  categories,
  columns,
  loading,
  searchTerm,
  onSearchTermChange,
  onSubmitProductSearch,
  onExecuteProductSearch,
  filtersOpen,
  onToggleFilters,
  activeProductFiltersCount,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  stockControlFilter,
  onStockControlFilterChange,
  stockStatusFilter,
  onStockStatusFilterChange,
  onClearProductFilters,
  productPaginationModel,
  onProductPaginationModelChange,
  productRowCount,
  onOpenCategoryManager,
  productSortModel,
  onProductSortModelChange,
  feedbackSlot,
}: InventoryCatalogSectionProps) {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <MetricCard
          title="Productos activos"
          value={formatNumber(inventorySummary.productos_activos)}
          helper="Disponibles en el catálogo operativo"
          icon={<Inventory2Icon />}
          tone={colors.modules.inventory}
        />

        <MetricCard
          title="Bajo mínimo"
          value={formatNumber(inventorySummary.bajo_minimo)}
          helper="Productos que requieren reposición"
          icon={<WarningAmberIcon />}
          tone={{
            main: colors.status.warning,
            soft: colors.status.warningSoft,
            border: colors.status.warning,
          }}
        />

        <MetricCard
          title="Por recibir"
          value={formatNumber(inventorySummary.por_recibir)}
          helper="Unidades pendientes de recepción física"
          icon={<LocalShippingIcon />}
          tone={{
            main: colors.status.warning,
            soft: colors.status.warningSoft,
            border: colors.secondary.border,
          }}
        />
      </Box>

      <SectionCard
        title="Buscar y filtrar productos"
        subtitle="Busca por modelo, categoría, detalle o código SAP."
      >
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Buscar productos"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmitProductSearch();
                }
              }}
              fullWidth
              placeholder="Producto, categoría, detalle o código SAP..."
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

            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={onExecuteProductSearch}
              disabled={loading}
              sx={{
                minWidth: { xs: "100%", md: 130 },
              }}
            >
              Buscar
            </Button>

            <Button
              variant={
                filtersOpen || activeProductFiltersCount > 0
                  ? "contained"
                  : "outlined"
              }
              startIcon={<TuneIcon />}
              onClick={onToggleFilters}
              aria-expanded={filtersOpen}
              aria-controls="product-filter-panel"
              sx={{
                minWidth: { xs: "100%", md: 155 },
                ...(filtersOpen || activeProductFiltersCount > 0
                  ? {}
                  : {
                      color: colors.text.primary,
                      borderColor: colors.border.medium,
                    }),
              }}
            >
              {activeProductFiltersCount > 0
                ? `Filtros (${activeProductFiltersCount})`
                : "Filtros"}
            </Button>

            <Button
              variant="outlined"
              onClick={onClearProductFilters}
              disabled={loading}
              sx={{
                minWidth: { xs: "100%", md: 120 },
                color: colors.text.primary,
                borderColor: colors.border.medium,
              }}
            >
              Limpiar
            </Button>
          </Stack>

          <Collapse in={filtersOpen} timeout="auto" unmountOnExit>
            <Box
              id="product-filter-panel"
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
                gap: 1.5,
                p: 1.5,
                border: `1px solid ${colors.border.light}`,
                borderRadius: colors.radius.md,
                bgcolor: colors.surface.soft,
              }}
            >
              <TextField
                select
                label="Categoría"
                value={categoryFilter}
                onChange={(event) => onCategoryFilterChange(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Estado del producto"
                value={statusFilter}
                onChange={(event) => onStatusFilterChange(event.target.value)}
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="ACTIVO">Activo</MenuItem>
                <MenuItem value="INACTIVO">Inactivo</MenuItem>
                <MenuItem value="DESCONTINUADO">Descontinuado</MenuItem>
                <MenuItem value="ARCHIVADO">Archivado</MenuItem>
              </TextField>

              <TextField
                select
                label="Maneja inventario"
                value={stockControlFilter}
                onChange={(event) =>
                  onStockControlFilterChange(event.target.value)
                }
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="true">Maneja inventario</MenuItem>
                <MenuItem value="false">No maneja inventario</MenuItem>
              </TextField>

              <TextField
                select
                label="Estado de stock"
                value={stockStatusFilter}
                onChange={(event) => {
                  const nextStockStatus = event.target.value;

                  if (isValidStockStatusFilter(nextStockStatus)) {
                    onStockStatusFilterChange(nextStockStatus);
                  }
                }}
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="STOCK_CORRECTO">Stock correcto</MenuItem>
                <MenuItem value="BAJO_MINIMO">Bajo mínimo</MenuItem>
                <MenuItem value="SIN_STOCK">Sin stock</MenuItem>
                <MenuItem value="NO_CONTROLA_STOCK">
                  No maneja inventario
                </MenuItem>
              </TextField>
            </Box>
          </Collapse>
        </Stack>
      </SectionCard>

      {feedbackSlot}

      <SectionCard
        title="Catálogo de productos"
        subtitle="Stock actual, stock mínimo, unidades por recibir, Kardex y acciones operativas."
        actions={
          <Button
            variant="outlined"
            startIcon={<CategoryIcon />}
            onClick={onOpenCategoryManager}
            sx={{
              color: colors.text.primary,
              borderColor: colors.border.medium,
            }}
          >
            Gestionar categorías
          </Button>
        }
      >
        <SerkanDataGrid
          gridKey="inventory.products"
          ariaLabel="Catálogo de productos de inventario"
          rows={products}
          columns={columns}
          loading={loading}
          paginationModel={productPaginationModel}
          onPaginationModelChange={onProductPaginationModelChange}
          rowCount={productRowCount}
          sortModel={productSortModel}
          onSortModelChange={onProductSortModelChange}
        />
      </SectionCard>
    </>
  );
}
