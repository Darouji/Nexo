/**
 * Contratos de estado compartidos por la página orquestadora de Inventario.
 *
 * Centralizar estas formas evita que cada diálogo o sección interprete de manera
 * diferente la misma operación. Este archivo sólo describe estado de interfaz;
 * las reglas de negocio y la autorización permanecen en el backend.
 */
import type {
  SerkanGridPaginationModel,
  SerkanGridFilter,
  SerkanGridSortModel,
} from "../../../components/SerkanDataGrid";
import type {
  AuditOrigin,
  Category,
  InventorySummary,
  KardexMovement,
  PendingReceiptStatus,
  PendingReceipt,
  Product,
  ProductLifecycleAction,
  ProductOrigin,
  ProductStockStatus,
} from "../../../services/inventoryService";

// Los estados de diálogo conservan en una sola unidad la operación, su registro
// objetivo y los datos ingresados, facilitando un reinicio completo al cerrar.
export type MovementDialogState = {
  open: boolean;
  mode: "ENTRADA_MANUAL" | "AJUSTE_INVENTARIO";
  product: Product | null;
  cantidad: string;
  motivo: string;
  ubicacion: string;
};

export type KardexDialogState = {
  open: boolean;
  product: Product | null;
  movements: KardexMovement[];
  rowCount: number;
  paginationModel: SerkanGridPaginationModel;
  sortModel: SerkanGridSortModel;
  ordering: string;
  loading: boolean;
};

export type PendingReceiptCreateDialogState = {
  open: boolean;
  product: Product | null;
  cantidad: string;
  referencia: string;
  motivo: string;
  ubicacionDestino: string;
  idempotencyKey: string;
};

export type PendingReceiptOperationMode = "RECIBIR" | "CANCELAR";

export type PendingReceiptOperationDialogState = {
  open: boolean;
  mode: PendingReceiptOperationMode;
  pendingReceipt: PendingReceipt | null;
  cantidad: string;
  motivo: string;
  idempotencyKey: string;
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

// Los overrides permiten reutilizar una carga con cambios parciales sin mutar
// antes el estado visible. Esto es útil al aplicar vistas, limpiar filtros o
// volver a la primera página dentro de una misma solicitud.
export type ProductFilterOverrides = {
  search?: string;
  category?: string[];
  page?: number;
  pageSize?: number;
  status?: string[];
  stockControl?: string;
  stockStatus?: ProductStockStatus[];
  ordering?: string;
  columnFilters?: SerkanGridFilter[];
};

export type PendingReceiptFilterOverrides = {
  search?: string;
  status?: PendingReceiptStatus[];
  dateFrom?: string;
  dateTo?: string;
  ordering?: string;
  columnFilters?: SerkanGridFilter[];
  page?: number;
  pageSize?: number;
};

export type KardexFilterOverrides = {
  search?: string;
  movementType?: string[];
  origin?: AuditOrigin[];
  ordering?: string;
  product?: number;
  columnFilters?: SerkanGridFilter[];
  page?: number;
  pageSize?: number;
};

// AG Grid utiliza índices de página basados en cero; la conversión al contrato
// paginado de Django se realiza al construir los parámetros de consulta.
export const defaultProductPaginationModel: SerkanGridPaginationModel = {
  page: 0,
  pageSize: 25,
};

export const defaultKardexSortModel: SerkanGridSortModel = {
  field: "created_at",
  direction: "desc",
};

export const defaultKardexPaginationModel: SerkanGridPaginationModel = {
  page: 0,
  pageSize: 10,
};

export const defaultPendingReceiptPaginationModel: SerkanGridPaginationModel = {
  page: 0,
  pageSize: 10,
};

// Estos valores representan estados de carga iniciales, no datos de negocio
// confirmados. Son sustituidos por la respuesta real del backend.
export const emptyInventorySummary: InventorySummary = {
  productos_activos: 0,
  stock_fisico_total: 0,
  bajo_minimo: 0,
  por_recibir: 0,
};

export const emptyMovementDialog: MovementDialogState = {
  open: false,
  mode: "ENTRADA_MANUAL",
  product: null,
  cantidad: "",
  motivo: "",
  ubicacion: "",
};

export const emptyKardexDialog: KardexDialogState = {
  open: false,
  product: null,
  movements: [],
  rowCount: 0,
  paginationModel: defaultKardexPaginationModel,
  sortModel: defaultKardexSortModel,
  ordering: "-created_at",
  loading: false,
};

export const emptyPendingReceiptCreateDialog: PendingReceiptCreateDialogState =
  {
    open: false,
    product: null,
    cantidad: "",
    referencia: "",
    motivo: "",
    ubicacionDestino: "",
    idempotencyKey: "",
  };

export const emptyPendingReceiptOperationDialog: PendingReceiptOperationDialogState =
  {
    open: false,
    mode: "RECIBIR",
    pendingReceipt: null,
    cantidad: "",
    motivo: "",
    idempotencyKey: "",
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
