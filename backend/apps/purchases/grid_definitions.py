from apps.core.grid_registry import (
    GridColumnDefinition,
    GridDefinition,
    register_grid_definition,
)

SUPPLIER_GRID_KEY = "purchases.suppliers"
ORDER_GRID_KEY = "purchases.orders"
RECEIPT_GRID_KEY = "purchases.receipts"

SUPPLIER_GRID_DEFINITION = GridDefinition(
    key=SUPPLIER_GRID_KEY,
    module="purchases",
    model_name="supplier",
    version=1,
    default_page_size=25,
    saved_filter_keys=("search", "status"),
    columns=(
        GridColumnDefinition(
            key="legal_name", system_label="Razón social", query_field="legal_name",
            filter_operators=("contains", "equals", "startsWith"), required=True,
        ),
        GridColumnDefinition(
            key="trade_name", system_label="Nombre comercial", query_field="trade_name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="tax_id", system_label="Identidad tributaria", query_field="tax_id",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="contact_name", system_label="Contacto", query_field="contact_name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="country", system_label="País", query_field="country",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="email", system_label="Correo", query_field="email",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="phone", system_label="Teléfono", query_field="phone",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="status", system_label="Estado", data_type="choice",
            query_field="status", filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="actions", system_label="Acciones", sortable=False,
            hideable=False, pinnable=False, required=True, exportable=False,
        ),
    ),
    official_export_columns=(
        "legal_name", "trade_name", "tax_id", "country", "contact_name",
        "email", "phone", "status",
    ),
)
register_grid_definition(SUPPLIER_GRID_DEFINITION)

ORDER_GRID_DEFINITION = GridDefinition(
    key=ORDER_GRID_KEY,
    module="purchases",
    model_name="purchaseorder",
    version=2,
    default_page_size=25,
    saved_filter_keys=("search", "state", "supplier", "currency"),
    columns=(
        GridColumnDefinition(
            key="number", system_label="Orden de compra", query_field="number",
            filter_operators=("contains", "equals", "startsWith"), required=True,
        ),
        GridColumnDefinition(
            key="supplier__legal_name", system_label="Proveedor",
            query_field="supplier__legal_name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="order_date", system_label="Fecha", data_type="date",
            query_field="order_date", filter_operators=(),
        ),
        GridColumnDefinition(
            key="expected_date", system_label="Fecha esperada", data_type="date",
            query_field="expected_date", filter_operators=(),
        ),
        GridColumnDefinition(
            key="state", system_label="Estado", data_type="choice",
            query_field="state", filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="currency", system_label="Moneda", data_type="choice",
            query_field="currency", filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="subtotal_original", system_label="Monto neto", data_type="number",
            query_field="subtotal_original",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="tax_total_original", system_label="IVA (19%)", data_type="number",
            query_field="tax_total_original",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="total_original", system_label="Total con IVA", data_type="number",
            query_field="total_original",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="total_clp", system_label="Total CLP", data_type="number",
            query_field="total_clp",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="cost_quality", system_label="Calidad del costo", data_type="choice",
            query_field="cost_quality", filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="responsible__username", system_label="Responsable",
            query_field="responsible__username",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="actions", system_label="Acciones", sortable=False,
            hideable=False, pinnable=False, required=True, exportable=False,
        ),
    ),
    official_export_columns=(
        "number", "supplier__legal_name", "order_date", "expected_date",
        "state", "currency", "subtotal_original", "tax_total_original",
        "total_original", "total_clp", "cost_quality",
        "responsible__username",
    ),
)
register_grid_definition(ORDER_GRID_DEFINITION)

RECEIPT_GRID_DEFINITION = GridDefinition(
    key=RECEIPT_GRID_KEY,
    module="purchases",
    model_name="purchasereceiptcommitment",
    version=1,
    default_page_size=25,
    saved_filter_keys=("search", "state", "order"),
    columns=(
        GridColumnDefinition(
            key="order_line__order__number", system_label="Orden de compra",
            query_field="order_line__order__number",
            filter_operators=("contains", "equals", "startsWith"), required=True,
        ),
        GridColumnDefinition(
            key="order_line__product_model_snapshot", system_label="Producto / Modelo",
            query_field="order_line__product_model_snapshot",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="destination_location__name", system_label="Ubicación de destino",
            query_field="destination_location__name",
            filter_operators=("contains", "equals", "startsWith"),
        ),
        GridColumnDefinition(
            key="committed_quantity", system_label="Cantidad comprometida",
            data_type="number", query_field="committed_quantity",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="pending_receipt__cantidad_recibida", system_label="Cantidad recibida",
            data_type="number", query_field="pending_receipt__cantidad_recibida",
            filter_operators=("equals", "greaterThan", "lessThan", "inRange"),
        ),
        GridColumnDefinition(
            key="pending_receipt__estado", system_label="Estado",
            data_type="choice", query_field="pending_receipt__estado",
            filter_operators=("equals",),
        ),
        GridColumnDefinition(
            key="pending_quantity", system_label="Cantidad pendiente",
            sortable=False, filter_operators=(),
        ),
        GridColumnDefinition(
            key="actions", system_label="Acciones", sortable=False,
            hideable=False, pinnable=False, required=True, exportable=False,
        ),
    ),
    official_export_columns=(
        "order_line__order__number", "order_line__product_model_snapshot",
        "destination_location__name", "committed_quantity",
        "pending_receipt__cantidad_recibida", "pending_quantity",
        "pending_receipt__estado",
    ),
)
register_grid_definition(RECEIPT_GRID_DEFINITION)

from . import logistics_grid_definitions  # noqa: E402,F401
