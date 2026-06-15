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
