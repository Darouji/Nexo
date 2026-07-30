import CategoryIcon from "@mui/icons-material/Category";
import AddIcon from "@mui/icons-material/Add";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DownloadIcon from "@mui/icons-material/Download";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";

import { colors } from "../../../theme/colors";
import { MetricCard } from "../../../components/MetricCard";
import { SectionCard } from "../../../components/SectionCard";
import { SerkanFilterToolbar } from "../../../components/filters/SerkanFilterToolbar";
import { SerkanMultiSelectFilter } from "../../../components/filters/SerkanMultiSelectFilter";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  SerkanDataGrid,
  type SerkanGridPaginationModel,
  type SerkanGridFilter,
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
import type { SavedGridViewConfig } from "../../../services/gridService";

type InventoryCatalogSectionProps = {
  inventorySummary: InventorySummary;
  products: Product[];
  categories: Category[];
  columns: ColDef<Product>[];
  loading: boolean;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onExecuteProductSearch: () => void;

  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeProductFiltersCount: number;

  categoryFilter: string[];
  onCategoryFilterChange: (value: string[]) => void;

  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;

  stockControlFilter: string;
  onStockControlFilterChange: (value: string) => void;

  stockStatusFilter: ProductStockStatus[];
  onStockStatusFilterChange: (value: ProductStockStatus[]) => void;

  onClearProductFilters: () => void;

  productPaginationModel: SerkanGridPaginationModel;
  onProductPaginationModelChange: (
    nextPaginationModel: SerkanGridPaginationModel,
  ) => void;
  productRowCount: number;
  onCreateProduct: () => void;

  productSortModel: SerkanGridSortModel;
  onProductSortModelChange: (nextSortModel: SerkanGridSortModel) => void;
  onProductColumnFiltersChange: (filters: SerkanGridFilter[]) => void;
  productFilterResetKey: number;
  onVisibleColumnsChange: (fieldKeys: string[]) => void;
  onProductNamedViewApply: (config: SavedGridViewConfig) => void;

  exporting: boolean;
  canExportOfficial: boolean;
  onExportView: () => void;
  onExportOfficial: () => void;

  onOpenCategoryManager: () => void;

  feedbackSlot?: ReactNode;
  navigationSlot?: ReactNode;
};

const chileanNumberFormatter = new Intl.NumberFormat("es-CL");

function formatNumber(value: number | null | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? chileanNumberFormatter.format(numericValue)
    : "—";
}

export function InventoryCatalogSection({
  inventorySummary,
  products,
  categories,
  columns,
  loading,
  searchTerm,
  onSearchTermChange,
  onExecuteProductSearch,
  filtersOpen,
  onToggleFilters,
  activeProductFiltersCount,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  onCreateProduct,
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
  onProductColumnFiltersChange,
  productFilterResetKey,
  onVisibleColumnsChange,
  onProductNamedViewApply,
  exporting,
  canExportOfficial,
  onExportView,
  onExportOfficial,
  feedbackSlot,
  navigationSlot,
}: InventoryCatalogSectionProps) {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
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
          title="Stock físico total"
          value={formatNumber(inventorySummary.stock_fisico_total)}
          helper="Unidades registradas en todas las ubicaciones"
          icon={<WarehouseOutlinedIcon />}
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

      {navigationSlot}
      {feedbackSlot}
      <SectionCard
        title="Catálogo de productos"
        subtitle="Stock actual, stock mínimo, unidades por recibir, Kardex y acciones operativas."
        tone={colors.modules.inventory}
        actions={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateProduct}
            >
              Nuevo producto
            </Button>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={onExportView}
              disabled={exporting}
            >
              Exportar resultados filtrados
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
          </Stack>
        }
      >
        <SerkanFilterToolbar
          searchLabel="Buscar productos"
          searchPlaceholder="Producto, categoría, detalle o código SAP..."
          searchValue={searchTerm}
          onSearchValueChange={onSearchTermChange}
          onApply={onExecuteProductSearch}
          onClear={onClearProductFilters}
          loading={loading}
          expanded={filtersOpen}
          onExpandedChange={() => onToggleFilters()}
          activeFiltersCount={activeProductFiltersCount}
          panelId="product-filter-panel"
        >
          <SerkanMultiSelectFilter
            label="Categorías"
            options={categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            }))}
            value={categoryFilter}
            onChange={onCategoryFilterChange}
          />

          <SerkanMultiSelectFilter
            label="Estados del producto"
            options={[
              { value: "ACTIVO", label: "Activo" },
              { value: "INACTIVO", label: "Inactivo" },
              { value: "DESCONTINUADO", label: "Descontinuado" },
              { value: "ARCHIVADO", label: "Archivado" },
            ]}
            value={statusFilter}
            onChange={onStatusFilterChange}
          />

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
            <MenuItem value="true">Sí</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>

          <SerkanMultiSelectFilter
            label="Estados de stock"
            options={[
              { value: "STOCK_CORRECTO", label: "Stock correcto" },
              { value: "BAJO_MINIMO", label: "Bajo mínimo" },
              { value: "SIN_STOCK", label: "Sin stock" },
              {
                value: "NO_CONTROLA_STOCK",
                label: "No maneja inventario",
              },
            ]}
            value={stockStatusFilter}
            onChange={(values) =>
              onStockStatusFilterChange(values as ProductStockStatus[])
            }
          />
        </SerkanFilterToolbar>

        <SerkanDataGrid
          gridKey="inventory.products"
          serverManaged
          ariaLabel="Catálogo de productos de inventario"
          rows={products}
          columns={columns}
          loading={loading}
          paginationModel={productPaginationModel}
          onPaginationModelChange={onProductPaginationModelChange}
          rowCount={productRowCount}
          sortModel={productSortModel}
          onSortModelChange={onProductSortModelChange}
          onFilterModelChange={onProductColumnFiltersChange}
          filterResetKey={productFilterResetKey}
          onVisibleColumnsChange={onVisibleColumnsChange}
          namedViewFilters={{
            search: searchTerm,
            category: categoryFilter.join(","),
            status: statusFilter.join(","),
            stock_control: stockControlFilter,
            stock_status: stockStatusFilter.join(","),
          }}
          onNamedViewApply={onProductNamedViewApply}
          footerSummary={
            <Stack spacing={0}>
              <Typography variant="caption" sx={{ color: colors.text.muted }}>
                Stock físico total general
              </Typography>
              <Typography sx={{ color: colors.text.primary, fontWeight: 900 }}>
                {formatNumber(inventorySummary.stock_fisico_total)} unidades
              </Typography>
              <Typography variant="caption" sx={{ color: colors.text.muted }}>
                No depende de los filtros
              </Typography>
            </Stack>
          }
        />
      </SectionCard>
    </>
  );
}
