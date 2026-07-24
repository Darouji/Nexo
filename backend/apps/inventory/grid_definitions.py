from apps.core.grid_registry import (
    GridColumnDefinition,
    GridDefinition,
    register_grid_definition,
)


PRODUCT_GRID_KEY = "inventory.products"
PENDING_RECEIPT_GRID_KEY = "inventory.pending-receipts"

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
