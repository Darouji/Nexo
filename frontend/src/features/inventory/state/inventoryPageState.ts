import type { GridPaginationModel } from "@mui/x-data-grid";
import type {
  Category,
  InventorySummary,
  KardexMovement,
  PendingReceipt,
  Product,
  ProductLifecycleAction,
  ProductOrigin,
} from "../../../services/inventoryService";

export type MovementDialogState = {
  open: boolean;
  mode: "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";
  product: Product | null;
  cantidad: string;
  motivo: string;
};

export type KardexDialogState = {
  open: boolean;
  product: Product | null;
  movements: KardexMovement[];
  rowCount: number;
  paginationModel: GridPaginationModel;
  loading: boolean;
};

export type PendingReceiptCreateDialogState = {
  open: boolean;
  product: Product | null;
  cantidad: string;
  referencia: string;
  motivo: string;
};

export type PendingReceiptOperationMode = "RECIBIR" | "CANCELAR";

export type PendingReceiptOperationDialogState = {
  open: boolean;
  mode: PendingReceiptOperationMode;
  pendingReceipt: PendingReceipt | null;
  cantidad: string;
  motivo: string;
};

export type ProductLifecycleDialogState = {
  open: boolean;
  product: Product | null;
  action: ProductLifecycleAction | null;
  motivo: string;
};

export type ProductOriginDialogState = {
  open: boolean;
  product: Product | null;
  origen: ProductOrigin;
  origen_observacion: string;
  motivo: string;
};

export type ProductCategoryDialogState = {
  open: boolean;
  product: Product | null;
  destinationCategory: Category | null;
  motivo: string;
};

export type ProductActionMenuState = {
  anchorEl: HTMLElement | null;
  product: Product | null;
};

export const defaultProductPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 25,
};

export const defaultKardexPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 10,
};

export const defaultPendingReceiptPaginationModel: GridPaginationModel = {
  page: 0,
  pageSize: 10,
};

export const emptyInventorySummary: InventorySummary = {
  productos_activos: 0,
  bajo_minimo: 0,
  por_recibir: 0,
};

export const emptyMovementDialog: MovementDialogState = {
  open: false,
  mode: "ENTRADA_MANUAL",
  product: null,
  cantidad: "",
  motivo: "",
};

export const emptyKardexDialog: KardexDialogState = {
  open: false,
  product: null,
  movements: [],
  rowCount: 0,
  paginationModel: defaultKardexPaginationModel,
  loading: false,
};

export const emptyPendingReceiptCreateDialog: PendingReceiptCreateDialogState =
  {
    open: false,
    product: null,
    cantidad: "",
    referencia: "",
    motivo: "",
  };

export const emptyPendingReceiptOperationDialog: PendingReceiptOperationDialogState =
  {
    open: false,
    mode: "RECIBIR",
    pendingReceipt: null,
    cantidad: "",
    motivo: "",
  };

export const emptyProductLifecycleDialog: ProductLifecycleDialogState = {
  open: false,
  product: null,
  action: null,
  motivo: "",
};

export const emptyProductOriginDialog: ProductOriginDialogState = {
  open: false,
  product: null,
  origen: "COMPRADO",
  origen_observacion: "",
  motivo: "",
};

export const emptyProductCategoryDialog: ProductCategoryDialogState = {
  open: false,
  product: null,
  destinationCategory: null,
  motivo: "",
};

export const emptyProductActionMenu: ProductActionMenuState = {
  anchorEl: null,
  product: null,
};
