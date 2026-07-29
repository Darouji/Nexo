from apps.core.grid_registry import (
    GridColumnDefinition,
    GridDefinition,
    register_grid_definition,
)


PRODUCT_GRID_KEY = "inventory.products"
PENDING_RECEIPT_GRID_KEY = "inventory.pending-receipts"
KARDEX_GRID_KEY = "inventory.global-kardex"

PRODUCT_GRID_DEFINITION = GridDefinition(
    key=PRODUCT_GRID_KEY,
    module="inventory",
    model_name="producto",
    version=1,
    default_page_size=25,
    saved_filter_keys=(
        "search",
        "category",
        "status",
        "stock_control",
        "stock_status",
    ),
    columns=(
        GridColumnDefinition(
            key="modelo",
            system_label="Producto / Modelo",
            query_field="modelo",
            filter_operators=("contains", "equals", "startsWith"),
            required=True,
        ),
        GridColumnDefinition(
            key="categoria__name",
            system_label="Categoría",
            query_field="categoria__name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="codigo_sap",
            system_label="Código SAP",
            query_field="codigo_sap",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="stock_actual",
            system_label="Stock actual",
            data_type="number",
            query_field="stock_actual",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="por_recibir_total",
            system_label="Por recibir",
            data_type="number",
            query_field="por_recibir_total",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="stock_critico",
            system_label="Stock mínimo",
            data_type="number",
            query_field="stock_critico",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="origen",
            system_label="Origen",
            data_type="choice",
            query_field="origen",
            filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="stock_status",
            system_label="Estado de stock",
            data_type="choice",
            sortable=False,
            filter_operators=(),
        ),
        GridColumnDefinition(
            key="estado_producto_display",
            system_label="Estado del producto",
            data_type="choice",
            sortable=False,
            filter_operators=(),
        ),
        GridColumnDefinition(
            key="detalle",
            system_label="Detalle / Descripción",
            query_field="detalle",
            sortable=False,
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="actions",
            system_label="Acciones",
            sortable=False,
            hideable=False,
            pinnable=False,
            required=True,
            exportable=False,
        ),
    ),
    official_export_columns=(
        "modelo",
        "categoria__name",
        "codigo_sap",
        "detalle",
        "origen",
        "stock_actual",
        "stock_critico",
        "por_recibir_total",
    ),
)

register_grid_definition(PRODUCT_GRID_DEFINITION)


PENDING_RECEIPT_GRID_DEFINITION = GridDefinition(
    key=PENDING_RECEIPT_GRID_KEY,
    module="inventory",
    model_name="pendienteporrecibir",
    version=1,
    default_page_size=25,
    saved_filter_keys=(
        "search",
        "status",
        "date_from",
        "date_to",
    ),
    columns=(
        GridColumnDefinition(
            key="producto__modelo_normalized",
            system_label="Producto / Modelo",
            query_field="producto__modelo",
            filter_operators=("contains", "equals", "startsWith"),
            required=True,
        ),
        GridColumnDefinition(
            key="producto__categoria__name_normalized",
            system_label="Categoría",
            query_field="producto__categoria__name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="producto__codigo_sap_normalized",
            system_label="Código SAP",
            query_field="producto__codigo_sap",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="destination_location__name_normalized",
            system_label="Ubicación de recepción",
            query_field="destination_location__name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="cantidad_original",
            system_label="Cantidad original",
            data_type="number",
            query_field="cantidad_original",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="cantidad_recibida",
            system_label="Cantidad recibida",
            data_type="number",
            query_field="cantidad_recibida",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="cantidad_cancelada",
            system_label="Cantidad cancelada",
            data_type="number",
            query_field="cantidad_cancelada",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="cantidad_pendiente_orden",
            system_label="Cantidad pendiente",
            data_type="number",
            query_field="cantidad_pendiente_orden",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="estado",
            system_label="Estado",
            data_type="choice",
            query_field="estado",
            filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="referencia",
            system_label="OC / Factura",
            query_field="referencia",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="motivo",
            system_label="Motivo",
            query_field="motivo",
            sortable=False,
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="created_by__username",
            system_label="Registrado por",
            query_field="created_by__username",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="created_at",
            system_label="Fecha de registro",
            data_type="date",
            query_field="created_at",
            filter_operators=(),
        ),
        GridColumnDefinition(
            key="actions",
            system_label="Acciones",
            sortable=False,
            hideable=False,
            pinnable=False,
            required=True,
            exportable=False,
        ),
    ),
    official_export_columns=(
        "producto__modelo_normalized",
        "producto__categoria__name_normalized",
        "producto__codigo_sap_normalized",
        "destination_location__name_normalized",
        "cantidad_original",
        "cantidad_recibida",
        "cantidad_cancelada",
        "cantidad_pendiente_orden",
        "estado",
        "referencia",
        "motivo",
        "created_by__username",
        "created_at",
    ),
)

register_grid_definition(PENDING_RECEIPT_GRID_DEFINITION)


KARDEX_GRID_DEFINITION = GridDefinition(
    key=KARDEX_GRID_KEY,
    module="inventory",
    model_name="movimientokardex",
    version=1,
    default_page_size=25,
    saved_filter_keys=(
        "search", "movement_type", "origin", "location", "date_from", "date_to",
    ),
    columns=(
        GridColumnDefinition(
            key="created_at", system_label="Fecha y hora", data_type="date",
            query_field="created_at", filter_operators=(), required=True,
        ),
        GridColumnDefinition(
            key="producto_modelo_orden", system_label="Producto / Modelo",
            query_field="producto_modelo_orden",
            filter_operators=("contains", "equals", "startsWith"), required=True,
        ),
        GridColumnDefinition(
            key="producto_codigo_sap_orden", system_label="Código SAP",
            query_field="producto_codigo_sap_orden",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="producto_categoria_orden", system_label="Categoría",
            query_field="producto_categoria_orden",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="movement_type", system_label="Tipo de movimiento",
            data_type="choice", query_field="movement_type", filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="cantidad", system_label="Cantidad", data_type="number",
            query_field="cantidad", filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="stock_antes", system_label="Stock anterior", data_type="number",
            query_field="stock_antes", filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="stock_despues", system_label="Stock posterior", data_type="number",
            query_field="stock_despues", filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="ubicacion_nombre", system_label="Ubicación", query_field="location_name_snapshot",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="motivo", system_label="Motivo", query_field="motivo",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="reference_repr", system_label="Referencia", query_field="reference_repr",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="operador_nombre", system_label="Responsable", query_field="operador__username",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="origin", system_label="Origen", data_type="choice",
            query_field="origin", filter_operators=("equals",),
        ),
    ),
    official_export_columns=(
        "created_at", "producto_modelo_orden", "producto_codigo_sap_orden",
        "producto_categoria_orden", "movement_type", "cantidad", "stock_antes",
        "stock_despues", "ubicacion_nombre", "motivo", "reference_repr",
        "operador_nombre", "origin",
    ),
)

register_grid_definition(KARDEX_GRID_DEFINITION)
CATEGORY_MANAGER_GRID_KEY = "inventory.categories"
CATEGORY_MANAGER_GRID_DEFINITION = GridDefinition(
    key=CATEGORY_MANAGER_GRID_KEY, module="inventory", model_name="categoria", version=1,
    default_page_size=25,
    columns=(
        GridColumnDefinition(key="name", system_label="Categoría", required=True),
        GridColumnDefinition(key="description", system_label="Descripción"),
        GridColumnDefinition(key="productos_count", system_label="Productos", data_type="number"),
        GridColumnDefinition(key="status", system_label="Estado", data_type="choice"),
        GridColumnDefinition(key="availability", system_label="Uso en productos", sortable=False),
        GridColumnDefinition(key="has_historical_usage", system_label="Historial", data_type="choice"),
        GridColumnDefinition(key="actions", system_label="Acciones", sortable=False, hideable=False, pinnable=False, required=True, exportable=False),
    ),
)
register_grid_definition(CATEGORY_MANAGER_GRID_DEFINITION)

CATEGORY_PRODUCTS_GRID_KEY = "inventory.category-products"
CATEGORY_PRODUCTS_GRID_DEFINITION = GridDefinition(
    key=CATEGORY_PRODUCTS_GRID_KEY, module="inventory", model_name="producto", version=1,
    default_page_size=25,
    columns=(
        GridColumnDefinition(key="modelo", system_label="Modelo", required=True),
        GridColumnDefinition(key="codigo_sap", system_label="Código SAP"),
        GridColumnDefinition(key="stock_actual", system_label="Stock", data_type="number"),
        GridColumnDefinition(key="por_recibir", system_label="Por recibir", data_type="number"),
        GridColumnDefinition(key="estado_producto_display", system_label="Estado", data_type="choice"),
        GridColumnDefinition(key="actions", system_label="Acciones", sortable=False, hideable=False, pinnable=False, required=True, exportable=False),
    ),
)
register_grid_definition(CATEGORY_PRODUCTS_GRID_DEFINITION)
