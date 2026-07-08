import type { Category } from "../../../services/inventoryService";

export function getAvailableProductCategoryOptions(
  categories: Category[],
  currentCategoryId?: number | null,
) {
  return categories.filter(
    (category) =>
      category.is_available_for_products && category.id !== currentCategoryId,
  );
}
