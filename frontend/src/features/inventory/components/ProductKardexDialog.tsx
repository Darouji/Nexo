import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { SmartDataGrid } from "../../../components/SmartDataGrid";
import type {
  KardexMovement,
  Product,
} from "../../../services/inventoryService";

type ProductKardexDialogProps = {
  open: boolean;
  product: Product | null;
  movements: KardexMovement[];
  columns: GridColDef[];
  loading: boolean;
  rowCount: number;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (nextPaginationModel: GridPaginationModel) => void;
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
  onClose,
}: ProductKardexDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        Kardex del producto
        {product ? `: ${product.modelo}` : ""}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <Alert severity="info" variant="outlined">
            Historial real de movimientos de stock. Cada registro muestra
            cantidad, stock anterior, stock posterior, motivo, operador y fecha.
          </Alert>

          <SmartDataGrid
            rows={movements}
            columns={columns}
            loading={loading}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            rowCount={rowCount}
            rowNumberOffset={paginationModel.page * paginationModel.pageSize}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
