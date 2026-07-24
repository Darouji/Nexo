import csv
from io import BytesIO, StringIO

from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook

from apps.core.grid_services import get_effective_column_labels
from apps.core.models import AuditAction, AuditLog, AuditOrigin

from .grid_definitions import (
    PENDING_RECEIPT_GRID_DEFINITION,
    PRODUCT_GRID_DEFINITION,
)


def neutralize_spreadsheet_formula(value):
    if value is None:
        return ""

    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"

    return value


def product_export_value(product, field_key):
    if field_key == "categoria__name":
        return product.categoria.name
    if field_key == "por_recibir_total":
        return int(getattr(product, "por_recibir_total", 0) or 0)
    if field_key == "origen":
        return product.get_origen_display()
    if field_key == "stock_status":
        return product.stock_status
    if field_key == "estado_producto_display":
        return product.estado_producto_display

    return getattr(product, field_key, "")


def resolve_export_columns(
    *,
    mode,
    requested_columns,
    definition=PRODUCT_GRID_DEFINITION,
):
    column_map = definition.column_map

    if mode == "official":
        field_keys = list(definition.official_export_columns)
    else:
        field_keys = requested_columns or [
            column.key for column in definition.columns if column.exportable
        ]

    invalid = [
        field_key
        for field_key in field_keys
        if field_key not in column_map or not column_map[field_key].exportable
    ]
    if invalid:
        from rest_framework.exceptions import ValidationError

        raise ValidationError(
            {"columns": f"Columnas no exportables: {', '.join(invalid)}."}
        )

    return field_keys


def build_product_export_response(*, queryset, mode, export_format, columns):
    definition = PRODUCT_GRID_DEFINITION
    labels = get_effective_column_labels(definition) if mode == "view" else {}

    headers = [
        neutralize_spreadsheet_formula(
            labels.get(field_key, definition.column_map[field_key].system_label)
        )
        for field_key in columns
    ]
    rows = [
        [
            neutralize_spreadsheet_formula(product_export_value(product, field_key))
            for field_key in columns
        ]
        for product in queryset
    ]

    filename = f"serkan_catalogo_productos_{mode}.{export_format}"

    if export_format == "csv":
        output = StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        response = HttpResponse(
            "\ufeff" + output.getvalue(),
            content_type="text/csv; charset=utf-8",
        )
    else:
        workbook = Workbook(write_only=True)
        worksheet = workbook.create_sheet("Catálogo")
        worksheet.append(headers)
        for row in rows:
            worksheet.append(row)

        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
        )

    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def pending_receipt_export_value(pending_receipt, field_key):
    if field_key == "producto__modelo_normalized":
        return pending_receipt.producto.modelo
    if field_key == "producto__categoria__name_normalized":
        return pending_receipt.producto.categoria.name
    if field_key == "producto__codigo_sap_normalized":
        return pending_receipt.producto.codigo_sap
    if field_key == "destination_location__name_normalized":
        return pending_receipt.destination_location.name
    if field_key == "cantidad_pendiente_orden":
        return pending_receipt.cantidad_pendiente
    if field_key == "estado":
        return pending_receipt.get_estado_display()
    if field_key == "created_by__username":
        if not pending_receipt.created_by:
            return ""
        return (
            pending_receipt.created_by.get_full_name().strip()
            or pending_receipt.created_by.username
        )
    if field_key == "created_at":
        return timezone.localtime(pending_receipt.created_at).strftime(
            "%d-%m-%Y %H:%M:%S"
        )

    return getattr(pending_receipt, field_key, "")


def build_pending_receipt_export_response(
    *,
    queryset,
    mode,
    export_format,
    columns,
):
    definition = PENDING_RECEIPT_GRID_DEFINITION
    labels = get_effective_column_labels(definition) if mode == "view" else {}
    headers = [
        neutralize_spreadsheet_formula(
            labels.get(field_key, definition.column_map[field_key].system_label)
        )
        for field_key in columns
    ]
    rows = [
        [
            neutralize_spreadsheet_formula(
                pending_receipt_export_value(pending_receipt, field_key)
            )
            for field_key in columns
        ]
        for pending_receipt in queryset
    ]
    filename = f"serkan_pendientes_por_recibir_{mode}.{export_format}"

    if export_format == "csv":
        output = StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        response = HttpResponse(
            "\ufeff" + output.getvalue(),
            content_type="text/csv; charset=utf-8",
        )
    else:
        workbook = Workbook(write_only=True)
        worksheet = workbook.create_sheet("Por recibir")
        worksheet.append(headers)
        for row in rows:
            worksheet.append(row)

        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
        )

    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def record_grid_export(
    *,
    request,
    definition,
    mode,
    export_format,
    columns,
    row_count,
    model_name,
    object_repr,
):
    AuditLog.objects.create(
        actor=request.user,
        action=AuditAction.EXPORTAR,
        origin=AuditOrigin.API,
        module="inventory",
        model_name=model_name,
        object_repr=object_repr,
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        metadata={
            "request_id": getattr(request, "request_id", ""),
            "grid_key": definition.key,
            "mode": mode,
            "format": export_format,
            "columns": columns,
            "row_count": row_count,
        },
    )


def record_product_export(*, request, mode, export_format, columns, row_count):
    record_grid_export(
        request=request,
        definition=PRODUCT_GRID_DEFINITION,
        mode=mode,
        export_format=export_format,
        columns=columns,
        row_count=row_count,
        model_name="producto",
        object_repr="Catálogo de productos",
    )
