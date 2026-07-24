import csv
from io import BytesIO, StringIO

from django.http import HttpResponse
from openpyxl import Workbook
from rest_framework.exceptions import ValidationError

from apps.core.grid_services import get_effective_column_labels


def neutralize_spreadsheet_formula(value):
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


def resolve_export_columns(*, definition, mode, requested_columns):
    if mode == "official":
        keys = list(definition.official_export_columns)
    else:
        keys = requested_columns or [
            column.key for column in definition.columns if column.exportable
        ]
    invalid = [
        key for key in keys
        if key not in definition.column_map or not definition.column_map[key].exportable
    ]
    if invalid:
        raise ValidationError({"columns": f"Columnas no exportables: {', '.join(invalid)}."})
    return keys


def _nested_value(instance, key):
    current = instance
    for part in key.split("__"):
        if current is None:
            return ""
        current = getattr(current, part, "")
    return current


def export_value(instance, key):
    value = _nested_value(instance, key)
    if callable(value):
        value = value()
    return neutralize_spreadsheet_formula(value)


def build_export_response(*, records, definition, mode, export_format, columns, filename, sheet):
    labels = get_effective_column_labels(definition) if mode == "view" else {}
    headers = [
        neutralize_spreadsheet_formula(
            labels.get(key, definition.column_map[key].system_label)
        )
        for key in columns
    ]
    rows = [[export_value(record, key) for key in columns] for record in records]
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
        worksheet = workbook.create_sheet(sheet[:31])
        worksheet.append(headers)
        for row in rows:
            worksheet.append(row)
        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    response["Content-Disposition"] = f'attachment; filename="{filename}.{export_format}"'
    return response
