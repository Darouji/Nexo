/**
 * Deriva la disponibilidad visual de acciones del catálogo a partir del estado
 * operativo del producto. Estas reglas evitan ofrecer flujos incompatibles —por
 * ejemplo, ingresar stock a un producto descontinuado—, pero no sustituyen las
 * validaciones ni los permisos aplicados por el backend.
 */
import type { Product } from "../../../services/inventoryService";

type ProductActionMenuPermissionsOptions = {
  inventoryProduct: Product | null;
  moreProduct: Product | null;
};

export type ProductActionMenuPermissions = {
  inventoryProduct: Product | null;
  inventoryCanRegisterManualEntry: boolean;
  inventoryCanAdjustStock: boolean;
  inventoryCanRegisterPendingReceipt: boolean;
  moreProduct: Product | null;
  moreIsOperationallyActive: boolean;
  moreCanInactivate: boolean;
};

/**
 * Mantiene separadas las reglas del menú de inventario y del menú de ciclo de
 * vida. Un producto descontinuado aún puede requerir ajustes de regularización,
 * mientras que una nueva entrada o recepción ampliaría existencias que ya no se
 * pretende seguir abasteciendo.
 */
export function getProductActionMenuPermissions({
  inventoryProduct,
  moreProduct,
}: ProductActionMenuPermissionsOptions): ProductActionMenuPermissions {
  const inventoryIsOperationallyActive = Boolean(
    inventoryProduct && inventoryProduct.status === "ACTIVO",
  );

  const inventoryCanRegisterManualEntry = Boolean(
    inventoryProduct &&
    inventoryIsOperationallyActive &&
    inventoryProduct.controla_stock &&
    !inventoryProduct.descontinuado,
  );

  const inventoryCanAdjustStock = Boolean(
    inventoryProduct &&
    inventoryIsOperationallyActive &&
    inventoryProduct.controla_stock,
  );

  const inventoryCanRegisterPendingReceipt = Boolean(
    inventoryProduct &&
    inventoryIsOperationallyActive &&
    inventoryProduct.controla_stock &&
    !inventoryProduct.descontinuado,
  );

  const moreIsOperationallyActive = Boolean(
    moreProduct && moreProduct.status === "ACTIVO",
  );

  // La inactivación se ofrece solo cuando no quedan existencias ni compromisos
  // de recepción que deban resolverse previamente.
  const moreCanInactivate = Boolean(
    moreProduct &&
    moreIsOperationallyActive &&
    Number(moreProduct.stock_actual || 0) === 0 &&
    Number(moreProduct.por_recibir || 0) === 0,
  );

  return {
    inventoryProduct,
    inventoryCanRegisterManualEntry,
    inventoryCanAdjustStock,
    inventoryCanRegisterPendingReceipt,
    moreProduct,
    moreIsOperationallyActive,
    moreCanInactivate,
  };
}
