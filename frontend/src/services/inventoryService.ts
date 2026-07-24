import { api } from "./api";
import { createIdempotencyKey } from "./idempotency";

export type ProductStockStatus =
  | "STOCK_CORRECTO"
  | "BAJO_MINIMO"
  | "SIN_STOCK"
  | "NO_CONTROLA_STOCK";

export type ProductOrigin = "COMPRADO" | "FABRICADO" | "SERVICIO" | "OTRO";

export type AuditOrigin =
  | "MANUAL"
  | "API"
  | "IMPORTACION_EXCEL"
  | "AUTOMATICO"
  | "SISTEMA";

export type Category = {
  [key: string]: unknown;
  id: number;
  name: string;
  name_normalized: string;
  description: string;
  status: string;
  has_historical_usage: boolean;
  merged_into: number | null;
  merged_into_name: string;
  merged_at: string | null;
  merged_by: number | null;
  merge_reason: string;
  is_merged: boolean;
  is_available_for_products: boolean;
  productos_count: number;
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
  origen: ProductOrigin;
  origen_observacion: string;
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

export type InventorySummary = {
  productos_activos: number;
  stock_fisico_total: number;
  bajo_minimo: number;
  por_recibir: number;
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
  location: number | null;
  ubicacion_nombre: string;
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
  destination_location: number;
  ubicacion_destino_nombre: string;
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
  ubicacion_destino?: number | null;
  cantidad: number;
  referencia?: string;
  motivo?: string;
};

export type PendingReceiptOperationPayload = {
  cantidad: number;
  motivo: string;
};

export type PendingReceiptOperation = {
  id: number;
  pending_receipt: number;
  operation_type: "RECEIVE" | "CANCEL";
  operation_type_display: string;
  quantity: number;
  reason: string;
  product_model_snapshot: string;
  product_sap_code_snapshot: string;
  product_category_snapshot: string;
  destination_location_snapshot: string;
  responsible: number;
  responsible_name: string;
  kardex_movement: number | null;
  received_before: number;
  received_after: number;
  cancelled_before: number;
  cancelled_after: number;
  pending_before: number;
  pending_after: number;
  previous_state: PendingReceiptStatus;
  previous_state_display: string;
  new_state: PendingReceiptStatus;
  new_state_display: string;
  occurred_at: string;
};

export type ReceivePendingReceiptResponse = {
  pendiente: PendingReceipt;
  movimiento_kardex: KardexMovement;
};

export type PaginatedResponse<T> = {
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

export type InventoryLocationType =
  | "BODEGA"
  | "DOMICILIO_CUSTODIA"
  | "TRANSITO"
  | "CLIENTE_FAENA"
  | "OTRO";

export type InventoryLocation = {
  [key: string]: unknown;
  id: number;
  name: string;
  location_type: InventoryLocationType;
  location_type_display: string;
  custodian: number | null;
  custodian_name: string;
  city: string;
  description: string;
  is_regularization: boolean;
  total_units: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProductLocationBalance = {
  [key: string]: unknown;
  id: number;
  product: number;
  product_model: string;
  product_sap_code: string;
  product_category: string;
  location: number;
  location_name: string;
  location_type: InventoryLocationType;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type InventoryTransfer = {
  [key: string]: unknown;
  id: number;
  product: number;
  product_model: string;
  product_sap_code: string;
  product_category: string;
  origin_location: number;
  origin_location_name: string;
  destination_location: number;
  destination_location_name: string;
  quantity: number;
  responsible: number;
  responsible_name: string;
  reason: string;
  evidence_reference: string;
  transferred_at: string;
  status: string;
  created_at: string;
};

type InventoryLocationListResponse =
  | InventoryLocation[]
  | PaginatedResponse<InventoryLocation>;
type ProductLocationBalanceListResponse =
  | ProductLocationBalance[]
  | PaginatedResponse<ProductLocationBalance>;
type InventoryTransferListResponse =
  | InventoryTransfer[]
  | PaginatedResponse<InventoryTransfer>;

export type SaveInventoryLocationPayload = {
  name: string;
  location_type: InventoryLocationType;
  custodian?: number | null;
  city?: string;
  description?: string;
};

export type CreateInventoryTransferPayload = {
  product: number;
  origin_location: number;
  destination_location: number;
  quantity: number;
  reason: string;
  evidence_reference?: string;
};

export type CategoryListParams = {
  search?: string;
  ordering?: string;
  available?: boolean;
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
  grid_filters?: string;
};

export type ProductPageParams = ProductListParams & {
  page?: number;
  page_size?: number;
};

export type KardexListParams = {
  producto?: CsvParam<number>;
  movement_type?: CsvParam<string>;
  origin?: CsvParam<AuditOrigin>;
  status?: CsvParam<string>;
  search?: string;
  ordering?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
};

export type KardexPageParams = KardexListParams & {
  page?: number;
  page_size?: number;
};

export type PendingReceiptListParams = {
  producto?: CsvParam<number>;
  estado?: CsvParam<PendingReceiptStatus>;
  search?: string;
  ordering?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  grid_filters?: string;
};

export type PendingReceiptPageParams = PendingReceiptListParams & {
  page?: number;
  page_size?: number;
};

export type CreateCategoryPayload = {
  name: string;
  description?: string;
};

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export type RenameCategoryPayload = {
  name: string;
  description?: string;
  motivo: string;
};

export type MergeCategoryPayload = {
  categoria_destino: number;
  motivo: string;
};

export type DeleteCategoryPayload = {
  motivo: string;
};

export type CategoryMergeResponse = {
  categoria_origen: Category;
  categoria_destino: Category;
  productos_reasignados: number;
  idempotente: boolean;
};

export type ChangeProductOriginPayload = {
  origen: ProductOrigin;
  origen_observacion?: string;
  motivo: string;
};

export type ChangeProductCategoryPayload = {
  categoria_destino: number;
  motivo: string;
};

type ProductCategorySelection =
  | {
      categoria: number;
      categoria_nombre?: never;
    }
  | {
      categoria?: never;
      categoria_nombre: string;
    };

type ProductEditableFields = {
  modelo: string;
  detalle?: string;
  codigo_sap?: string;
  stock_critico: number;
  controla_stock: boolean;
};

export type CreateProductPayload = ProductCategorySelection &
  ProductEditableFields & {
    origen: ProductOrigin;
    origen_observacion?: string;
    stock_inicial?: number;
    motivo_stock_inicial?: string;
    ubicacion_stock_inicial?: number | null;
  };

export type UpdateProductPayload = Partial<ProductEditableFields> & {
  categoria?: number;
  categoria_nombre?: string;
  motivo_codigo_sap?: string;
};

export type StockMovementPayload = {
  cantidad: number;
  motivo: string;
  ubicacion?: number | null;
};

function extractResults<T>(data: T[] | PaginatedResponse<T>) {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

function toPaginatedResponse<T>(
  data: T[] | PaginatedResponse<T>,
): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      results: data,
    };
  }

  return data;
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

export function normalizeCategoryNameForComparison(value: string) {
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
  const normalizedName = normalizeCategoryNameForComparison(name);

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

export async function fetchCategories(params: CategoryListParams = {}) {
  const response = await api.get<CategoryListResponse>(
    "/inventory/categorias/",
    {
      params: {
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "name",
        available: toBooleanParam(params.available),
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

export async function renameCategory(
  categoryId: number,
  payload: RenameCategoryPayload,
) {
  const response = await api.post<Category>(
    `/inventory/categorias/${categoryId}/renombrar/`,
    {
      name: payload.name.trim(),
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function mergeCategories(
  sourceCategoryId: number,
  payload: MergeCategoryPayload,
) {
  const response = await api.post<CategoryMergeResponse>(
    `/inventory/categorias/${sourceCategoryId}/fusionar/`,
    {
      categoria_destino: payload.categoria_destino,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function deleteCategorySafely(
  categoryId: number,
  payload: DeleteCategoryPayload,
) {
  await api.delete(`/inventory/categorias/${categoryId}/`, {
    data: {
      motivo: payload.motivo.trim(),
    },
  });
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
      grid_filters: params.grid_filters,
    },
  });

  return extractResults(response.data);
}

export async function fetchProductsPage(
  params: ProductPageParams = {},
  signal?: AbortSignal,
) {
  const response = await api.get<ProductListResponse>("/inventory/productos/", {
    signal,
    params: {
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "categoria__name,modelo",
      categoria: toCsv(params.categoria),
      category: toCsv(params.category),
      status: toCsv(params.status),
      controla_stock: toBooleanParam(params.controla_stock),
      stock_status: toCsv(params.stock_status),
      stock_critico: toBooleanParam(params.stock_critico),
      grid_filters: params.grid_filters,
      page: params.page,
      page_size: params.page_size,
    },
  });

  return toPaginatedResponse(response.data);
}

export async function exportProducts(
  params: ProductPageParams & {
    mode: "view" | "official";
    file_format: "xlsx" | "csv";
    columns?: string[];
  },
) {
  const response = await api.get<Blob>("/inventory/productos/export/", {
    responseType: "blob",
    params: {
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "categoria__name,modelo",
      categoria: toCsv(params.categoria),
      category: toCsv(params.category),
      status: toCsv(params.status),
      controla_stock: toBooleanParam(params.controla_stock),
      stock_status: toCsv(params.stock_status),
      stock_critico: toBooleanParam(params.stock_critico),
      grid_filters: params.grid_filters,
      mode: params.mode,
      file_format: params.file_format,
      columns: params.columns?.join(",") || undefined,
    },
  });

  const contentDisposition = response.headers["content-disposition"];
  const filenameMatch =
    typeof contentDisposition === "string"
      ? contentDisposition.match(/filename="?([^";]+)"?/i)
      : null;

  return {
    blob: response.data,
    filename:
      filenameMatch?.[1] ||
      `serkan_catalogo_productos_${params.mode}.${params.file_format}`,
  };
}

export async function fetchInventorySummary() {
  const response = await api.get<InventorySummary>(
    "/inventory/productos/resumen/",
  );

  return response.data;
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

export async function changeProductCategory(
  productId: number,
  payload: ChangeProductCategoryPayload,
) {
  const response = await api.post<Product>(
    `/inventory/productos/${productId}/cambiar-categoria/`,
    {
      categoria_destino: payload.categoria_destino,
      motivo: payload.motivo.trim(),
    },
  );

  return response.data;
}

export async function changeProductOrigin(
  productId: number,
  payload: ChangeProductOriginPayload,
) {
  const response = await api.post<Product>(
    `/inventory/productos/${productId}/cambiar-origen/`,
    {
      origen: payload.origen,
      origen_observacion: payload.origen_observacion?.trim() || "",
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
      ubicacion: payload.ubicacion || undefined,
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
      ubicacion: payload.ubicacion || undefined,
    },
  );

  return response.data;
}

export async function fetchKardexMovements(params: KardexListParams = {}) {
  const response = await api.get<KardexListResponse>("/inventory/kardex/", {
    params: {
      producto: toCsv(params.producto),
      movement_type: toCsv(params.movement_type),
      origin: toCsv(params.origin),
      status: toCsv(params.status),
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "-created_at",
      fecha_desde: params.fecha_desde || undefined,
      fecha_hasta: params.fecha_hasta || undefined,
    },
  });

  return extractResults(response.data);
}

export async function fetchKardexMovementsPage(params: KardexPageParams = {}) {
  const response = await api.get<KardexListResponse>("/inventory/kardex/", {
    params: {
      producto: toCsv(params.producto),
      movement_type: toCsv(params.movement_type),
      origin: toCsv(params.origin),
      status: toCsv(params.status),
      search: params.search?.trim() || undefined,
      ordering: params.ordering || "-created_at",
      fecha_desde: params.fecha_desde || undefined,
      fecha_hasta: params.fecha_hasta || undefined,
      page: params.page,
      page_size: params.page_size,
    },
  });

  return toPaginatedResponse(response.data);
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
        fecha_desde: params.fecha_desde || undefined,
        fecha_hasta: params.fecha_hasta || undefined,
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "-created_at",
        grid_filters: params.grid_filters,
      },
    },
  );

  return extractResults(response.data);
}

export async function fetchPendingReceiptsPage(
  params: PendingReceiptPageParams = {},
  signal?: AbortSignal,
) {
  const response = await api.get<PendingReceiptListResponse>(
    "/inventory/pendientes-por-recibir/",
    {
      signal,
      params: {
        producto: toCsv(params.producto),
        estado: toCsv(params.estado),
        fecha_desde: params.fecha_desde || undefined,
        fecha_hasta: params.fecha_hasta || undefined,
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "-created_at",
        grid_filters: params.grid_filters,
        page: params.page,
        page_size: params.page_size,
      },
    },
  );

  return toPaginatedResponse(response.data);
}

export async function exportPendingReceipts(
  params: PendingReceiptListParams & {
    mode: "view" | "official";
    file_format: "xlsx" | "csv";
    columns?: string[];
  },
) {
  const response = await api.get<Blob>(
    "/inventory/pendientes-por-recibir/export/",
    {
      params: {
        producto: toCsv(params.producto),
        estado: toCsv(params.estado),
        fecha_desde: params.fecha_desde || undefined,
        fecha_hasta: params.fecha_hasta || undefined,
        search: params.search?.trim() || undefined,
        ordering: params.ordering || "-created_at",
        grid_filters: params.grid_filters,
        mode: params.mode,
        file_format: params.file_format,
        columns: params.columns?.join(",") || undefined,
      },
      responseType: "blob",
    },
  );

  const contentDisposition = response.headers["content-disposition"] || "";
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

  return {
    blob: response.data,
    filename:
      filenameMatch?.[1] ||
      `serkan_pendientes_por_recibir_${params.mode}.${params.file_format}`,
  };
}

export async function fetchPendingReceiptHistory(pendingReceiptId: number) {
  const response = await api.get<PendingReceiptOperation[]>(
    `/inventory/pendientes-por-recibir/${pendingReceiptId}/historial/`,
  );
  return response.data;
}

export async function createPendingReceipt(
  payload: CreatePendingReceiptPayload,
  idempotencyKey = createIdempotencyKey("pending-receipt-create"),
) {
  const response = await api.post<PendingReceipt>(
    "/inventory/pendientes-por-recibir/",
    {
      producto: payload.producto,
      ubicacion_destino: payload.ubicacion_destino || undefined,
      cantidad: payload.cantidad,
      referencia: payload.referencia?.trim() || "",
      motivo: payload.motivo?.trim() || "",
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );

  return response.data;
}

export async function fetchInventoryLocations(params: {
  status?: string;
  search?: string;
} = {}) {
  const response = await api.get<InventoryLocationListResponse>(
    "/inventory/ubicaciones/",
    {
      params: {
        status: params.status || undefined,
        search: params.search?.trim() || undefined,
        ordering: "name",
        page_size: 200,
      },
    },
  );
  return extractResults(response.data);
}

export async function createInventoryLocation(
  payload: SaveInventoryLocationPayload,
) {
  const response = await api.post<InventoryLocation>(
    "/inventory/ubicaciones/",
    {
      name: payload.name.trim(),
      location_type: payload.location_type,
      custodian: payload.custodian || null,
      city: payload.city?.trim() || "",
      description: payload.description?.trim() || "",
    },
  );
  return response.data;
}

export async function updateInventoryLocation(
  locationId: number,
  payload: SaveInventoryLocationPayload,
) {
  const response = await api.patch<InventoryLocation>(
    `/inventory/ubicaciones/${locationId}/`,
    {
      name: payload.name.trim(),
      location_type: payload.location_type,
      custodian: payload.custodian || null,
      city: payload.city?.trim() || "",
      description: payload.description?.trim() || "",
    },
  );
  return response.data;
}

export async function archiveInventoryLocation(
  locationId: number,
  reason: string,
) {
  const response = await api.post<InventoryLocation>(
    `/inventory/ubicaciones/${locationId}/archivar/`,
    { reason: reason.trim() },
  );
  return response.data;
}

export async function fetchProductLocationBalances(params: {
  product?: number;
  location?: number;
  positiveOnly?: boolean;
} = {}) {
  const response = await api.get<ProductLocationBalanceListResponse>(
    "/inventory/saldos-por-ubicacion/",
    {
      params: {
        product: params.product || undefined,
        location: params.location || undefined,
        positive_only: params.positiveOnly ? "true" : undefined,
        ordering: "product__modelo_normalized,location__name_normalized",
        page_size: 500,
      },
    },
  );
  return extractResults(response.data);
}

export async function fetchProductLocationBalancesPage(params: {
  product?: number;
  location?: number;
  positiveOnly?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  const response = await api.get<ProductLocationBalanceListResponse>(
    "/inventory/saldos-por-ubicacion/",
    {
      params: {
        product: params.product || undefined,
        location: params.location || undefined,
        positive_only: params.positiveOnly ? "true" : undefined,
        search: params.search?.trim() || undefined,
        ordering: "product__modelo_normalized,location__name_normalized",
        page: params.page,
        page_size: params.pageSize,
      },
    },
  );
  return toPaginatedResponse(response.data);
}

export async function fetchInventoryTransfers() {
  const response = await api.get<InventoryTransferListResponse>(
    "/inventory/transferencias/",
    {
      params: {
        ordering: "-transferred_at",
        page_size: 25,
      },
    },
  );
  return extractResults(response.data);
}

export async function createInventoryTransfer(
  payload: CreateInventoryTransferPayload,
  idempotencyKey: string,
) {
  const response = await api.post<InventoryTransfer>(
    "/inventory/transferencias/",
    {
      ...payload,
      reason: payload.reason.trim(),
      evidence_reference: payload.evidence_reference?.trim() || "",
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
  return response.data;
}

export async function receivePendingReceipt(
  pendingReceiptId: number,
  payload: PendingReceiptOperationPayload,
  idempotencyKey = createIdempotencyKey("pending-receipt-receive"),
) {
  const response = await api.post<ReceivePendingReceiptResponse>(
    `/inventory/pendientes-por-recibir/${pendingReceiptId}/recibir/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );

  return response.data;
}

export async function cancelPendingReceipt(
  pendingReceiptId: number,
  payload: PendingReceiptOperationPayload,
  idempotencyKey = createIdempotencyKey("pending-receipt-cancel"),
) {
  const response = await api.post<PendingReceipt>(
    `/inventory/pendientes-por-recibir/${pendingReceiptId}/cancelar/`,
    {
      cantidad: payload.cantidad,
      motivo: payload.motivo.trim(),
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );

  return response.data;
}
