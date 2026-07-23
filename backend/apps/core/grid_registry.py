from dataclasses import dataclass, field
from typing import Any

from django.db.models import QuerySet
from rest_framework.exceptions import NotFound, ValidationError


@dataclass(frozen=True)
class GridColumnDefinition:
    key: str
    system_label: str
    data_type: str = "text"
    query_field: str | None = None
    sortable: bool = True
    filter_operators: tuple[str, ...] = ()
    hideable: bool = True
    pinnable: bool = True
    required: bool = False
    exportable: bool = True

    def as_public_dict(self, *, visible_name: str | None = None) -> dict[str, Any]:
        return {
            "field_key": self.key,
            "system_label": self.system_label,
            "visible_name": visible_name or self.system_label,
            "data_type": self.data_type,
            "sortable": self.sortable,
            "filter_operators": list(self.filter_operators),
            "hideable": self.hideable,
            "pinnable": self.pinnable,
            "required": self.required,
            "exportable": self.exportable,
        }


@dataclass(frozen=True)
class GridDefinition:
    key: str
    module: str
    model_name: str
    version: int
    columns: tuple[GridColumnDefinition, ...]
    default_page_size: int = 25
    allowed_page_sizes: tuple[int, ...] = (10, 25, 50, 100)
    official_export_columns: tuple[str, ...] = field(default_factory=tuple)
    saved_filter_keys: tuple[str, ...] = field(default_factory=tuple)

    @property
    def column_map(self) -> dict[str, GridColumnDefinition]:
        return {column.key: column for column in self.columns}


_GRID_DEFINITIONS: dict[str, GridDefinition] = {}


def register_grid_definition(definition: GridDefinition) -> None:
    existing = _GRID_DEFINITIONS.get(definition.key)

    if existing is not None and existing != definition:
        raise RuntimeError(f"La grilla {definition.key} ya posee otra definición.")

    _GRID_DEFINITIONS[definition.key] = definition


def get_grid_definition(grid_key: str) -> GridDefinition:
    definition = _GRID_DEFINITIONS.get(str(grid_key or "").strip())

    if definition is None:
        raise NotFound("La grilla solicitada no está registrada.")

    return definition


def normalize_grid_config(
    definition: GridDefinition,
    raw_config: Any,
    *,
    reject_unknown=False,
) -> dict[str, Any]:
    if not isinstance(raw_config, dict):
        raise ValidationError({"config": "La configuración debe ser un objeto."})

    raw_columns = raw_config.get("columns", [])

    if not isinstance(raw_columns, list):
        raise ValidationError({"config": {"columns": "Debe ser una lista."}})

    normalized_columns = []
    seen_keys = set()
    column_map = definition.column_map

    for index, raw_column in enumerate(raw_columns):
        if not isinstance(raw_column, dict):
            raise ValidationError(
                {"config": {"columns": {index: "Debe ser un objeto."}}}
            )

        field_key = str(raw_column.get("field_key") or "").strip()
        column = column_map.get(field_key)

        if column is None:
            if reject_unknown:
                raise ValidationError(
                    {
                        "config": {
                            "columns": {
                                index: f"La columna {field_key or '<vacía>'} no está permitida."
                            }
                        }
                    }
                )
            continue

        if field_key in seen_keys:
            raise ValidationError(
                {"config": {"columns": {index: "La columna está duplicada."}}}
            )

        seen_keys.add(field_key)

        width = raw_column.get("width")
        if width is not None:
            if not isinstance(width, int) or not 80 <= width <= 1000:
                raise ValidationError(
                    {
                        "config": {
                            "columns": {
                                index: "El ancho debe estar entre 80 y 1000 píxeles."
                            }
                        }
                    }
                )

        hidden = bool(raw_column.get("hidden", False))
        if column.required or not column.hideable:
            hidden = False

        pinned = raw_column.get("pinned")
        if pinned not in (None, "left", "right"):
            raise ValidationError(
                {
                    "config": {
                        "columns": {
                            index: "La fijación debe ser left, right o null."
                        }
                    }
                }
            )
        if not column.pinnable:
            pinned = None

        normalized_column = {
            "field_key": field_key,
            "hidden": hidden,
            "pinned": pinned,
        }
        if width is not None:
            normalized_column["width"] = width

        normalized_columns.append(normalized_column)

    page_size = raw_config.get("page_size", definition.default_page_size)
    if page_size not in definition.allowed_page_sizes:
        raise ValidationError(
            {
                "config": {
                    "page_size": (
                        "Tamaño no permitido. Use "
                        + ", ".join(map(str, definition.allowed_page_sizes))
                        + "."
                    )
                }
            }
        )

    return {
        "columns": normalized_columns,
        "page_size": page_size,
    }


def normalize_saved_view_config(
    definition: GridDefinition,
    raw_config: Any,
) -> dict[str, Any]:
    """Valida una vista personal sin permitir campos ajenos a la grilla."""

    layout = normalize_grid_config(
        definition,
        raw_config,
        reject_unknown=True,
    )

    raw_sort = raw_config.get("sort")
    normalized_sort = None

    if raw_sort is not None:
        if not isinstance(raw_sort, dict):
            raise ValidationError({"config": {"sort": "Debe ser un objeto."}})

        sort_field = str(raw_sort.get("field") or "").strip()
        direction = str(raw_sort.get("direction") or "").strip().lower()
        column = definition.column_map.get(sort_field)

        if column is None or not column.sortable:
            raise ValidationError(
                {"config": {"sort": {"field": "La columna no permite ordenar."}}}
            )

        if direction not in {"asc", "desc"}:
            raise ValidationError(
                {"config": {"sort": {"direction": "Use asc o desc."}}}
            )

        normalized_sort = {
            "field": sort_field,
            "direction": direction,
        }

    raw_filters = raw_config.get("filters", {})
    if not isinstance(raw_filters, dict):
        raise ValidationError({"config": {"filters": "Debe ser un objeto."}})

    allowed_filter_keys = set(definition.saved_filter_keys)
    unknown_filter_keys = set(raw_filters) - allowed_filter_keys - {
        "column_filters"
    }
    if unknown_filter_keys:
        raise ValidationError(
            {
                "config": {
                    "filters": (
                        "Contiene filtros no permitidos: "
                        + ", ".join(sorted(unknown_filter_keys))
                        + "."
                    )
                }
            }
        )

    normalized_filters = {}
    for key in definition.saved_filter_keys:
        value = raw_filters.get(key, "")
        if value is None:
            value = ""
        if not isinstance(value, (str, int, bool)):
            raise ValidationError(
                {"config": {"filters": {key: "El valor no es válido."}}}
            )

        normalized_value = str(value).strip()
        if len(normalized_value) > 300:
            raise ValidationError(
                {"config": {"filters": {key: "Máximo 300 caracteres."}}}
            )
        normalized_filters[key] = normalized_value

    raw_column_filters = raw_filters.get("column_filters", [])
    if not isinstance(raw_column_filters, list):
        raise ValidationError(
            {"config": {"filters": {"column_filters": "Debe ser una lista."}}}
        )
    if len(raw_column_filters) > 20:
        raise ValidationError(
            {
                "config": {
                    "filters": {
                        "column_filters": "No se permiten más de 20 filtros."
                    }
                }
            }
        )

    normalized_column_filters = []
    for index, raw_filter in enumerate(raw_column_filters):
        if not isinstance(raw_filter, dict):
            raise ValidationError(
                {
                    "config": {
                        "filters": {
                            "column_filters": {index: "Debe ser un objeto."}
                        }
                    }
                }
            )

        field_key = str(raw_filter.get("field") or "").strip()
        operator = str(raw_filter.get("operator") or "").strip()
        column = definition.column_map.get(field_key)

        if (
            column is None
            or not column.query_field
            or operator not in column.filter_operators
        ):
            raise ValidationError(
                {
                    "config": {
                        "filters": {
                            "column_filters": {
                                index: "El filtro o su operador no están permitidos."
                            }
                        }
                    }
                }
            )

        value = raw_filter.get("value")
        value_to = raw_filter.get("value_to")

        if column.data_type == "number":
            try:
                value = int(value)
                if value_to not in (None, ""):
                    value_to = int(value_to)
            except (TypeError, ValueError):
                raise ValidationError(
                    {
                        "config": {
                            "filters": {
                                "column_filters": {
                                    index: "El filtro requiere números enteros."
                                }
                            }
                        }
                    }
                )
        else:
            value = str(value or "").strip()
            if not value or len(value) > 300:
                raise ValidationError(
                    {
                        "config": {
                            "filters": {
                                "column_filters": {
                                    index: "El texto debe tener entre 1 y 300 caracteres."
                                }
                            }
                        }
                    }
                )

        normalized_filter = {
            "field": field_key,
            "operator": operator,
            "value": value,
        }
        if value_to not in (None, ""):
            normalized_filter["value_to"] = value_to
        normalized_column_filters.append(normalized_filter)

    normalized_filters["column_filters"] = normalized_column_filters

    return {
        **layout,
        "sort": normalized_sort,
        "filters": normalized_filters,
        "definition_version": definition.version,
    }


def apply_grid_filters(
    queryset: QuerySet,
    definition: GridDefinition,
    filters: Any,
) -> QuerySet:
    if filters in (None, "", []):
        return queryset

    if not isinstance(filters, list):
        raise ValidationError({"grid_filters": "Debe ser una lista."})

    if len(filters) > 20:
        raise ValidationError({"grid_filters": "No se permiten más de 20 filtros."})

    column_map = definition.column_map

    for index, item in enumerate(filters):
        if not isinstance(item, dict):
            raise ValidationError({"grid_filters": {index: "Debe ser un objeto."}})

        field_key = str(item.get("field") or "").strip()
        operator = str(item.get("operator") or "").strip()
        column = column_map.get(field_key)

        if column is None or not column.query_field:
            raise ValidationError(
                {"grid_filters": {index: "La columna no permite filtros."}}
            )

        if operator not in column.filter_operators:
            raise ValidationError(
                {"grid_filters": {index: "El operador no está permitido."}}
            )

        value = item.get("value")
        value_to = item.get("value_to")
        lookup = column.query_field

        if column.data_type == "number":
            try:
                numeric_value = int(value)
                numeric_value_to = int(value_to) if value_to not in (None, "") else None
            except (TypeError, ValueError):
                raise ValidationError(
                    {"grid_filters": {index: "El filtro requiere números enteros."}}
                )

            if operator == "equals":
                queryset = queryset.filter(**{lookup: numeric_value})
            elif operator == "greaterThan":
                queryset = queryset.filter(**{f"{lookup}__gt": numeric_value})
            elif operator == "lessThan":
                queryset = queryset.filter(**{f"{lookup}__lt": numeric_value})
            elif operator == "inRange":
                if numeric_value_to is None:
                    raise ValidationError(
                        {"grid_filters": {index: "El rango requiere un valor final."}}
                    )
                queryset = queryset.filter(
                    **{
                        f"{lookup}__gte": numeric_value,
                        f"{lookup}__lte": numeric_value_to,
                    }
                )
        else:
            text_value = str(value or "").strip()
            if not text_value:
                raise ValidationError(
                    {"grid_filters": {index: "El valor no puede estar vacío."}}
                )

            if operator == "contains":
                queryset = queryset.filter(**{f"{lookup}__icontains": text_value})
            elif operator == "equals":
                queryset = queryset.filter(**{f"{lookup}__iexact": text_value})
            elif operator == "startsWith":
                queryset = queryset.filter(**{f"{lookup}__istartswith": text_value})

    return queryset
