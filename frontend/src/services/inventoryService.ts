import { api } from "./api";

export type ProductStockStatus =
  | "STOCK_CORRECTO"
  | "BAJO_MINIMO"
  | "SIN_STOCK"
  | "NO_CONTROLA_STOCK";

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
  por_recibir: number;
  controla_stock: boolean;
  descontinuado: boolean;
  stock_status: ProductStockStatus;
  estado_producto: string;
  estado_producto_display: string;
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
  producto_codigo_sap: string;
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
  reference_content_type: number | null;
  reference_object_id: string;
  reference_repr: string;
  reference: {
    content_type: number | null;
    object_id: string;
    repr: string;
  } | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PendingReceiptStatus =
  | "PENDIENTE"
  | "PARCIAL"
  | "RECIBIDA"
  | "CANCELADA"
  | "CERRADA_PARCIAL";

export type ProductLifecycleAction =
  | "INACTIVAR"
  | "ARCHIVAR"
  | "REACTIVAR"
  | "DESCONTINUAR"
  | "REANUDAR";

export type ProductLifecyclePayload = {
  accion: ProductLifecycleAction;
  motivo: string;
};

export type CategoryLifecycleAction = "INACTIVAR" | "ARCHIVAR" | "REACTIVAR";

export type CategoryLifecyclePayload = {
  accion: CategoryLifecycleAction;
  motivo: string;
};

export type PendingReceipt = {
  [key: string]: unknown;
  id: number;
  producto: number;
  producto_modelo: string;
  producto_categoria: string;
  producto_codigo_sap: string;
  cantidad_original: number;
  cantidad_recibida: number;
  cantidad_cancelada: number;
  cantidad_pendiente: number;
  estado: PendingReceiptStatus;
  estado_display: string;
  referencia: string;
  motivo: string;
  status: string;
  created_by: number | null;
  created_by_nombre: string;
  updated_by: number | null;
  updated_by_nombre: string;
  created_at: string;
  updated_at: string;
};

export type CreatePendingReceiptPayload = {
  producto: number;
  cantidad: number;
  referencia?: string;
  motivo?: string;
};

export type PendingReceiptOperationPayload = {
  cantidad: number;
  motivo: string;
};

export type ReceivePendingReceiptResponse = {
  pendiente: PendingReceipt;
  movimiento_kardex: KardexMovement;
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
type PendingReceiptListResponse =
  | PendingReceipt[]
  | PaginatedResponse<PendingReceipt>;

type CategoryListParams = {
  search?: string;
  ordering?: string;
};

type CsvParam<T extends string | number> = T | T[];

export type ProductListParams = {
  search?: string;
  ordering?: string;
  categoria?: CsvParam<number>;
  category?: CsvParam<number>;
  status?: CsvParam<string>;
  controla_stock?: boolean;
  stock_status?: CsvParam<ProductStockStatus>;
  stock_critico?: boolean;
};

type KardexListParams = {
  producto?: number;
  movement_type?: string;
  origin?: string;
  status?: string;
  search?: string;
  ordering?: string;
};

export type PendingReceiptListParams = {
  producto?: CsvParam<number>;
  estado?: CsvParam<PendingReceiptStatus>;
  search?: string;
  ordering?: string;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string;
};

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export type CreateProductPayload = {
  categoria: number;
  modelo: string;
  detalle?: string;
  codigo_sap?: string;
  stock_critico: number;
  controla_stock: boolean;
  stock_inicial?: number;
  motivo_stock_inicial?: string;
};

export type UpdateProductPayload = Partial<
  Omit<CreateProductPayload, "stock_inicial" | "motivo_stock_inicial">
>;

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

function toCsv<T extends string | number>(value?: CsvParam<T>) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const cleanValues = value.filter((item) => item !== "" && item !== null);
    return cleanValues.length > 0 ? cleanValues.join(",") : undefined;
  }

  return value;
}

function toBooleanParam(value?: boolean) {
  if (value === undefined) {
    return undefined;
  }

  return value ? "true" : "false";
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

export async function fetchCategories(params: CategoryListParams = {}) {
  const response = await api.get<CategoryListResponse>(
    "/inventory/categorias/",
    {
      params: {
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "name",
      },
    },
  );

  return extractResults(response.data);
}

export async function fetchCategory(categoryId: number) {
  const response = await api.get<Category>(
    `/inventory/categorias/${categoryId}/`,
  );

  return response.data;
}

export async function createCategory(payload: CreateCategoryPayload | string) {
  const normalizedPayload =
    typeof payload === "string"
      ? {
          name: payload.trim(),
          description: "",
        }
      : {
          name: payload.name.trim(),
          description: payload.description?.trim() || "",
        };

  const response = await api.post<Category>(
    "/inventory/categorias/",
    normalizedPayload,
  );

  return response.data;
}

export async function updateCategory(
  categoryId: number,
  payload: UpdateCategoryPayload,
) {
  const response = await api.patch<Category>(
    `/inventory/categorias/${categoryId}/`,
    {
      name: payload.name?.trim(),
      description: payload.description?.trim(),
    },
  );

  return response.data;
}

export async function changeCategoryLifecycle(
  categoryId: number,
  payload: CategoryLifecyclePayload,
) {
  const response = await api.post<Category>(
    `/inventory/categorias/${categoryId}/ciclo-vida/`,
    {
      accion: payload.accion,
      motivo: payload.motivo.trim(),
    },
  );

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
  const response = await api.get<ProductListResponse>("/inventory/productos/", {
    params: {
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "categoria__name,modelo",
      categoria: toCsv(params.categoria),
      category: toCsv(params.category),
      status: toCsv(params.status),
      controla_stock: toBooleanParam(params.controla_stock),
      stock_status: toCsv(params.stock_status),
      stock_critico: toBooleanParam(params.stock_critico),
    },
  });

  return extractResults(response.data);
}

export async function fetchProduct(productId: number) {
  const response = await api.get<Product>(`/inventory/productos/${productId}/`);
  return response.data;
}

export async function createProduct(payload: CreateProductPayload) {
  const response = await api.post<Product>("/inventory/productos/", payload);
  return response.data;
}

export async function updateProduct(
  productId: number,
  payload: UpdateProductPayload,
) {
  const response = await api.patch<Product>(
    `/inventory/productos/${productId}/`,
    payload,
  );

  return response.data;
}

export async function changeProductLifecycle(
  productId: number,
  payload: ProductLifecyclePayload,
) {
  const response = await api.post<Product>(
    `/inventory/productos/${productId}/ciclo-vida/`,
    {
      accion: payload.accion,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function registerManualStockEntry(
  productId: number,
  payload: StockMovementPayload,
) {
  const response = await api.post<KardexMovement>(
    `/inventory/productos/${productId}/entrada-manual/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function registerInventoryAdjustment(
  productId: number,
  payload: StockMovementPayload,
) {
  const response = await api.post<KardexMovement>(
    `/inventory/productos/${productId}/ajuste-inventario/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function fetchKardexMovements(params: KardexListParams = {}) {
  const response = await api.get<KardexListResponse>("/inventory/kardex/", {
    params: {
      producto: params.producto,
      movement_type: params.movement_type || undefined,
      origin: params.origin || undefined,
      status: params.status || undefined,
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "-created_at",
    },
  });

  return extractResults(response.data);
}

export async function fetchPendingReceipts(
  params: PendingReceiptListParams = {},
) {
  const response = await api.get<PendingReceiptListResponse>(
    "/inventory/pendientes-por-recibir/",
    {
      params: {
        producto: toCsv(params.producto),
        estado: toCsv(params.estado),
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "-created_at",
      },
    },
  );

  return extractResults(response.data);
}

export async function createPendingReceipt(
  payload: CreatePendingReceiptPayload,
) {
  const response = await api.post<PendingReceipt>(
    "/inventory/pendientes-por-recibir/",
    {
      producto: payload.producto,
      cantidad: payload.cantidad,
      referencia: payload.referencia?.trim() || "",
      motivo: payload.motivo?.trim() || "",
    },
  );

  return response.data;
}

export async function receivePendingReceipt(
  pendingReceiptId: number,
  payload: PendingReceiptOperationPayload,
) {
  const response = await api.post<ReceivePendingReceiptResponse>(
    `/inventory/pendientes-por-recibir/${pendingReceiptId}/recibir/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function cancelPendingReceipt(
  pendingReceiptId: number,
  payload: PendingReceiptOperationPayload,
) {
  const response = await api.post<PendingReceipt>(
    `/inventory/pendientes-por-recibir/${pendingReceiptId}/cancelar/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}
