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
