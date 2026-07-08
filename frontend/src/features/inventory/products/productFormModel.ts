import {
  normalizeCategoryNameForComparison,
  type Category,
  type ProductOrigin,
} from "../../../services/inventoryService";

export type ProductFormState = {
  categoria_name: string;
  modelo: string;
  detalle: string;
  codigo_sap: string;
  origen: ProductOrigin;
  origen_observacion: string;
  stock_critico: string;
  controla_stock: boolean;
  initial_stock: string;
  initial_stock_motivo: string;
};

export const emptyProductForm: ProductFormState = {
  categoria_name: "",
  modelo: "",
  detalle: "",
  codigo_sap: "",
  origen: "COMPRADO",
  origen_observacion: "",
  stock_critico: "0",
  controla_stock: true,
  initial_stock: "0",
  initial_stock_motivo: "Stock inicial registrado desde frontend.",
};

export const productOriginLabels: Record<ProductOrigin, string> = {
  COMPRADO: "Comprado",
  FABRICADO: "Fabricado",
  SERVICIO: "Servicio",
  OTRO: "Otro",
};

export function getProductOriginLabel(origin: ProductOrigin) {
  return productOriginLabels[origin];
}

export function findCategoryByInputName(categories: Category[], name: string) {
  const normalizedName = normalizeCategoryNameForComparison(name);

  if (!normalizedName) {
    return undefined;
  }

  return categories.find((category) => {
    const backendNormalizedName =
      typeof category.name_normalized === "string"
        ? category.name_normalized
        : "";

    return (
      normalizeCategoryNameForComparison(category.name) === normalizedName ||
      backendNormalizedName === normalizedName
    );
  });
}
