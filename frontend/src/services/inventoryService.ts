import { api } from "./api";

export type ProductStockStatus =
  | "OK"
  | "STOCK_CRITICO"
  | "NO_CONTROLA_STOCK"
  | string;

export type Category = {
  [key: string]: unknown;
  id: number;
  name: string;
  name_normalized: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  [key: string]: unknown;
  id: number;
  categoria: number | null;
  categoria_name: string;
  modelo: string;
  modelo_normalized?: string;
  detalle: string;
  codigo_sap: string;
  codigo_sap_normalized?: string;
  stock: number;
  stock_actual: number;
  stock_critico: number;
  en_camino: number;
  controla_stock: boolean;
  stock_status: ProductStockStatus;
  status: string;
  created_at: string;
  updated_at: string;
};

export type KardexMovement = {
  [key: string]: unknown;
  id: number;
  producto: number;
  producto_modelo: string;
  producto_categoria: string;
  movement_type: string;
  movement_type_display: string;
  origin: string;
  origin_display: string;
  operador: number | null;
  operador_nombre: string;
  cantidad: number;
  stock_antes: number;
  stock_despues: number;
  motivo: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ProductListResponse = Product[] | PaginatedResponse<Product>;
type CategoryListResponse = Category[] | PaginatedResponse<Category>;
type KardexListResponse = KardexMovement[] | PaginatedResponse<KardexMovement>;

type KardexListParams = {
  producto?: number;
  search?: string;
  ordering?: string;
};

type ProductListParams = {
  search?: string;
  ordering?: string;
};

export type CreateProductPayload = {
  categoria: number;
  modelo: string;
  detalle?: string;
  codigo_sap?: string;
  stock_critico: number;
  en_camino: number;
  controla_stock: boolean;
};

export type StockMovementPayload = {
  cantidad: number;
  motivo: string;
};

function extractResults<T>(data: T[] | PaginatedResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

export async function fetchCategories() {
  const response = await api.get<CategoryListResponse>(
    "/inventory/categorias/",
    {
      params: {
        ordering: "name",
      },
    },
  );

  return extractResults(response.data);
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCategoryByName(categories: Category[], name: string) {
  const normalizedName = normalizeComparableText(name);

  return categories.find((category) => {
    const backendNormalizedName =
      typeof category.name_normalized === "string"
        ? category.name_normalized
        : "";

    return (
      normalizeComparableText(category.name) === normalizedName ||
      backendNormalizedName === normalizedName
    );
  });
}

export async function createCategory(name: string) {
  const response = await api.post<Category>("/inventory/categorias/", {
    name: name.trim(),
    description: "",
  });

  return response.data;
}

export async function ensureCategoryByName(
  name: string,
  currentCategories: Category[] = [],
) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("La categoría es obligatoria.");
  }

  const existingCategory = findCategoryByName(currentCategories, trimmedName);

  if (existingCategory) {
    return existingCategory;
  }

  try {
    return await createCategory(trimmedName);
  } catch (error: unknown) {
    const updatedCategories = await fetchCategories();
    const categoryCreatedByAnotherRequest = findCategoryByName(
      updatedCategories,
      trimmedName,
    );

    if (categoryCreatedByAnotherRequest) {
      return categoryCreatedByAnotherRequest;
    }

    throw error;
  }
}

export async function fetchProducts(params: ProductListParams = {}) {
  const normalizedParams = {
    search: params.search?.trim() || undefined,
    ordering: params.ordering || undefined,
  };

  const response = await api.get<ProductListResponse>("/inventory/productos/", {
    params: normalizedParams,
  });

  return extractResults(response.data);
}

export async function createProduct(payload: CreateProductPayload) {
  const response = await api.post<Product>("/inventory/productos/", payload);
  return response.data;
}

export async function registerManualStockEntry(
  productId: number,
  payload: StockMovementPayload,
) {
  const response = await api.post<KardexMovement>(
    `/inventory/productos/${productId}/entrada-manual/`,
    payload,
  );

  return response.data;
}

export async function registerInventoryAdjustment(
  productId: number,
  payload: StockMovementPayload,
) {
  const response = await api.post<KardexMovement>(
    `/inventory/productos/${productId}/ajuste-inventario/`,
    payload,
  );

  return response.data;
}

export async function fetchKardexMovements(params: KardexListParams = {}) {
  const response = await api.get<KardexListResponse>("/inventory/kardex/", {
    params: {
      producto: params.producto,
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "-created_at",
    },
  });

  return extractResults(response.data);
}
