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
  codigo_sap_motivo: string;
  origen: ProductOrigin;
  origen_observacion: string;
  stock_critico: string;
  controla_stock: boolean;
  initial_stock: string;
  initial_stock_motivo: string;
  initial_location: string;
};

export const emptyProductForm: ProductFormState = {
  categoria_name: "",
  modelo: "",
  detalle: "",
  codigo_sap: "",
  codigo_sap_motivo: "",
  origen: "COMPRADO",
  origen_observacion: "",
  stock_critico: "0",
  controla_stock: true,
  initial_stock: "0",
  initial_stock_motivo: "Stock inicial registrado desde frontend.",
  initial_location: "",
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

export function normalizeProductComparisonValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSapComparisonValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const forbiddenSapCodeValues = new Set([
  "n",
  "na",
  "sinsap",
  "pendiente",
  "0000",
]);

export function isForbiddenSapCode(value: string) {
  return forbiddenSapCodeValues.has(normalizeSapComparisonValue(value));
}
