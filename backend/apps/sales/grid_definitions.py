from apps.core.grid_registry import GridColumnDefinition, GridDefinition, register_grid_definition

SALES_GRID_KEY = "sales.sales"

SALES_GRID_DEFINITION = GridDefinition(
    key=SALES_GRID_KEY, module="sales", model_name="venta", version=1,
    default_page_size=25,
    saved_filter_keys=("search", "sale_status", "validation_summary", "fecha_desde", "fecha_hasta"),
    columns=(
        GridColumnDefinition(key="fecha_venta", system_label="Fecha de emisión", data_type="date", query_field="fecha_venta", filter_operators=(), required=True),
        GridColumnDefinition(key="orden_compra", system_label="Orden de compra", query_field="orden_compra", filter_operators=("contains", "equals", "startsWith")),
        GridColumnDefinition(key="minera_name", system_label="Minera", query_field="minera__name", filter_operators=("contains", "equals", "startsWith")),
        GridColumnDefinition(key="factura_numero", system_label="Factura", query_field="factura_numero", filter_operators=("contains", "equals", "startsWith")),
        GridColumnDefinition(key="numero_guia_hes", system_label="Guía / HES", query_field="numero_guia_hes", filter_operators=("contains", "equals", "startsWith")),
        GridColumnDefinition(key="valor_neto", system_label="Monto neto", data_type="number", query_field="valor_neto", filter_operators=("equals", "greaterThan", "lessThan", "inRange")),
        GridColumnDefinition(key="iva", system_label="IVA (19%)", data_type="number", query_field="iva", filter_operators=("equals", "greaterThan", "lessThan", "inRange")),
        GridColumnDefinition(key="total", system_label="Total con IVA", data_type="number", query_field="total", filter_operators=("equals", "greaterThan", "lessThan", "inRange")),
        GridColumnDefinition(key="sale_status", system_label="Estado", data_type="choice", query_field="sale_status", filter_operators=("equals",)),
        GridColumnDefinition(key="validation_summary", system_label="Validación", sortable=False, filter_operators=()),
        GridColumnDefinition(key="stock_descontado", system_label="Stock", data_type="choice", query_field="stock_descontado", filter_operators=()),
        GridColumnDefinition(key="actions", system_label="Acciones", sortable=False, hideable=False, pinnable=False, required=True, exportable=False),
    ),
    official_export_columns=("fecha_venta", "orden_compra", "minera_name", "factura_numero", "numero_guia_hes", "valor_neto", "iva", "total", "sale_status", "validation_summary", "stock_descontado"),
)
register_grid_definition(SALES_GRID_DEFINITION)
SALES_DETAIL_GRID_KEY = "sales.details"
SALES_DETAIL_GRID_DEFINITION = GridDefinition(
    key=SALES_DETAIL_GRID_KEY, module="sales", model_name="detalleventa", version=1,
    default_page_size=25,
    columns=(
        GridColumnDefinition(key="producto_categoria", system_label="Categoría"),
        GridColumnDefinition(key="producto_modelo", system_label="Producto", required=True),
        GridColumnDefinition(key="codigo_sap", system_label="Código SAP"),
        GridColumnDefinition(key="cantidad", system_label="Cantidad", data_type="number"),
        GridColumnDefinition(key="valor_unitario", system_label="Valor unitario neto", data_type="number"),
        GridColumnDefinition(key="valor_total", system_label="Subtotal neto", data_type="number"),
        GridColumnDefinition(key="controla_stock_snapshot", system_label="Control stock", data_type="choice"),
    ),
)
register_grid_definition(SALES_DETAIL_GRID_DEFINITION)

SALES_ALERT_GRID_KEY = "sales.alerts"
SALES_ALERT_GRID_DEFINITION = GridDefinition(
    key=SALES_ALERT_GRID_KEY, module="sales", model_name="ventaalert", version=1,
    default_page_size=25,
    columns=(
        GridColumnDefinition(key="code_display", system_label="Alerta", required=True),
        GridColumnDefinition(key="message", system_label="Mensaje"),
        GridColumnDefinition(key="severity_display", system_label="Severidad"),
        GridColumnDefinition(key="is_active", system_label="Activa", data_type="choice"),
    ),
)
register_grid_definition(SALES_ALERT_GRID_DEFINITION)
