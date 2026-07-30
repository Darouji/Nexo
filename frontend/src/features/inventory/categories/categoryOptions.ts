import type { Category } from "../../../services/inventoryService";

/**
 * Devuelve únicamente categorías vigentes que pueden recibir productos y excluye
 * la categoría actual para impedir una operación sin cambio real.
 *
 * Este filtrado orienta la selección en la interfaz; el servicio del backend debe
 * volver a validar disponibilidad, estado y conflictos antes de guardar.
 */
export function getAvailableProductCategoryOptions(
  categories: Category[],
  currentCategoryId?: number | null,
) {
  return categories.filter(
    (category) =>
      category.is_available_for_products && category.id !== currentCategoryId,
  );
}
