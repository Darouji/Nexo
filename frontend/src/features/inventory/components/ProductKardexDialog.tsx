import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";

import {
  NexoDataGrid,
  type NexoGridPaginationModel,
  type NexoGridSortModel,
} from "../../../components/NexoDataGrid";
import type {
  KardexMovement,
  Product,
} from "../../../services/inventoryService";

type ProductKardexDialogProps = {
  open: boolean;
  product: Product | null;
  movements: KardexMovement[];
  columns: ColDef<KardexMovement>[];
  loading: boolean;
  rowCount: number;

  paginationModel: NexoGridPaginationModel;
  onPaginationModelChange: (
    nextPaginationModel: NexoGridPaginationModel,
  ) => void;

  sortModel: NexoGridSortModel;
  onSortModelChange: (nextSortModel: NexoGridSortModel) => void;

  onClose: () => void;
};

export function ProductKardexDialog({
  open,
  product,
  movements,
  columns,
  loading,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  onClose,
}: ProductKardexDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        Kardex del producto
        {product ? `: ${product.modelo}` : ""}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert severity="info" variant="outlined">
            Historial cronológico y auditado del producto. Los datos de modelo,
            categoría y código SAP corresponden a la información histórica
            registrada en cada movimiento.
          </Alert>

          <NexoDataGrid
            gridKey="inventory.product-kardex"
            ariaLabel={
              product
                ? `Kardex del producto ${product.modelo}`
                : "Kardex individual del producto"
            }
            rows={movements}
            columns={columns}
            loading={loading}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            rowCount={rowCount}
            sortModel={sortModel}
            onSortModelChange={onSortModelChange}
            height={520}
            minHeight={360}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
