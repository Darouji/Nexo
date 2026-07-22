from apps.core.grid_registry import (
    GridColumnDefinition,
    GridDefinition,
    register_grid_definition,
)


PRODUCT_GRID_KEY = "inventory.products"

PRODUCT_GRID_DEFINITION = GridDefinition(
    key=PRODUCT_GRID_KEY,
    module="inventory",
    model_name="producto",
    version=1,
    default_page_size=25,
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
