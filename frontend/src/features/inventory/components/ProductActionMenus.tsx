import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import AddBoxIcon from "@mui/icons-material/AddBox";
import TuneIcon from "@mui/icons-material/Tune";
import HistoryIcon from "@mui/icons-material/History";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import EditIcon from "@mui/icons-material/Edit";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import BlockIcon from "@mui/icons-material/Block";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import CategoryIcon from "@mui/icons-material/Category";
import RefreshIcon from "@mui/icons-material/Refresh";
import type {
  Product,
  ProductLifecycleAction,
} from "../../../services/inventoryService";

type StockMovementMode = "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";

type ProductActionMenusProps = {
  inventoryAnchorEl: HTMLElement | null;
  inventoryProduct: Product | null;
  inventoryCanRegisterManualEntry: boolean;
  inventoryCanAdjustStock: boolean;
  inventoryCanRegisterPendingReceipt: boolean;

  moreAnchorEl: HTMLElement | null;
  moreProduct: Product | null;
  moreIsOperationallyActive: boolean;
  moreCanInactivate: boolean;

  onClose: () => void;
  onOpenMovementDialog: (product: Product, mode: StockMovementMode) => void;
  onOpenPendingReceiptCreateDialog: (product: Product) => void;
  onFocusPendingReceipts: () => void;
  onOpenKardexDialog: (product: Product) => void | Promise<void>;
  onOpenEditProduct: (product: Product) => void;
  onOpenProductOriginDialog: (product: Product) => void;
  onOpenProductCategoryDialog: (product: Product) => void;
  onOpenProductLifecycleDialog: (
    product: Product,
    action: ProductLifecycleAction,
  ) => void;
};

export function ProductActionMenus({
  inventoryAnchorEl,
  inventoryProduct,
  inventoryCanRegisterManualEntry,
  inventoryCanAdjustStock,
  inventoryCanRegisterPendingReceipt,
  moreAnchorEl,
  moreProduct,
  moreIsOperationallyActive,
  moreCanInactivate,
  onClose,
  onOpenMovementDialog,
  onOpenPendingReceiptCreateDialog,
  onFocusPendingReceipts,
  onOpenKardexDialog,
  onOpenEditProduct,
  onOpenProductOriginDialog,
  onOpenProductCategoryDialog,
  onOpenProductLifecycleDialog,
}: ProductActionMenusProps) {
  return (
    <>
      <Menu
        anchorEl={inventoryAnchorEl}
        open={Boolean(inventoryAnchorEl)}
        onClose={onClose}
      >
        {inventoryProduct ? (
          <>
            <MenuItem
              disabled={!inventoryCanRegisterManualEntry}
              onClick={() => {
                onClose();
                onOpenMovementDialog(inventoryProduct, "ENTRADA_MANUAL");
              }}
            >
              <ListItemIcon>
                <AddBoxIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Registrar entrada física</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!inventoryCanAdjustStock}
              onClick={() => {
                onClose();
                onOpenMovementDialog(inventoryProduct, "AJUSTE_INVENTARIO");
              }}
            >
              <ListItemIcon>
                <TuneIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ajustar stock</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!inventoryCanRegisterPendingReceipt}
              onClick={() => {
                onClose();
                onOpenPendingReceiptCreateDialog(inventoryProduct);
              }}
            >
              <ListItemIcon>
                <LocalShippingIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Registrar recepción esperada</ListItemText>
            </MenuItem>

            <MenuItem onClick={onFocusPendingReceipts}>
              <ListItemIcon>
                <LocalShippingIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ir a recepción física</ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>

      <Menu
        anchorEl={moreAnchorEl}
        open={Boolean(moreAnchorEl)}
        onClose={onClose}
      >
        {moreProduct ? (
          <>
            <MenuItem
              onClick={() => {
                onClose();
                void onOpenKardexDialog(moreProduct);
              }}
            >
              <ListItemIcon>
                <HistoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Ver Kardex</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!moreIsOperationallyActive}
              onClick={() => {
                onClose();
                onOpenEditProduct(moreProduct);
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Editar producto</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!moreIsOperationallyActive}
              onClick={() => {
                onClose();
                onOpenProductOriginDialog(moreProduct);
              }}
            >
              <ListItemIcon>
                <SwapHorizIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Cambiar origen</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={!moreIsOperationallyActive}
              onClick={() => {
                onClose();
                onOpenProductCategoryDialog(moreProduct);
              }}
            >
              <ListItemIcon>
                <CategoryIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Cambiar categoría</ListItemText>
            </MenuItem>

            {moreProduct.status === "ACTIVO" ? (
              <>
                <MenuItem
                  onClick={() => {
                    onClose();
                    onOpenProductLifecycleDialog(
                      moreProduct,
                      moreProduct.descontinuado ? "REANUDAR" : "DESCONTINUAR",
                    );
                  }}
                >
                  <ListItemIcon>
                    <WarningAmberIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>
                    {moreProduct.descontinuado
                      ? "Reanudar producto"
                      : "Descontinuar producto"}
                  </ListItemText>
                </MenuItem>

                <MenuItem
                  disabled={!moreCanInactivate}
                  onClick={() => {
                    onClose();
                    onOpenProductLifecycleDialog(moreProduct, "INACTIVAR");
                  }}
                >
                  <ListItemIcon>
                    <BlockIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Inactivar producto</ListItemText>
                </MenuItem>
              </>
            ) : null}

            {moreProduct.status === "INACTIVO" ? (
              <>
                <MenuItem
                  onClick={() => {
                    onClose();
                    onOpenProductLifecycleDialog(moreProduct, "REACTIVAR");
                  }}
                >
                  <ListItemIcon>
                    <RefreshIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Reactivar producto</ListItemText>
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    onClose();
                    onOpenProductLifecycleDialog(moreProduct, "ARCHIVAR");
                  }}
                >
                  <ListItemIcon>
                    <ArchiveOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Archivar producto</ListItemText>
                </MenuItem>
              </>
            ) : null}

            {moreProduct.status === "ARCHIVADO" ? (
              <MenuItem
                onClick={() => {
                  onClose();
                  onOpenProductLifecycleDialog(moreProduct, "REACTIVAR");
                }}
              >
                <ListItemIcon>
                  <RefreshIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Reactivar producto</ListItemText>
              </MenuItem>
            ) : null}
          </>
        ) : null}
      </Menu>
    </>
  );
}
