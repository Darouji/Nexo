from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from .audit import (
    create_business_audit_log,
    create_record_change_logs_from_snapshot,
)
from .grid_registry import GridDefinition, normalize_grid_config
from .models import (
    AuditAction,
    AuditOrigin,
    BaseStatus,
    ColumnDisplayName,
    GridPreference,
)


def get_effective_column_labels(definition: GridDefinition) -> dict[str, str]:
    overrides = ColumnDisplayName.objects.filter(
        module=definition.module,
        model_name=definition.model_name,
        status=BaseStatus.ACTIVO,
    ).values_list("field_key", "visible_name")

    allowed_keys = definition.column_map
    return {
        field_key: visible_name
        for field_key, visible_name in overrides
        if field_key in allowed_keys
    }


def serialize_grid_definition(
    definition: GridDefinition,
    *,
    can_rename_global=False,
    can_export_official=False,
) -> dict:
    labels = get_effective_column_labels(definition)

    return {
        "grid_key": definition.key,
        "definition_version": definition.version,
        "default_page_size": definition.default_page_size,
        "allowed_page_sizes": list(definition.allowed_page_sizes),
        "columns": [
            column.as_public_dict(visible_name=labels.get(column.key))
            for column in definition.columns
        ],
        "permissions": {
            "can_rename_global": can_rename_global,
            "can_export_official": can_export_official,
        },
    }


def serialize_grid_preference(preference: GridPreference | None, definition):
    if preference is None:
        return {
            "grid_key": definition.key,
            "definition_version": definition.version,
            "revision": 0,
            "config": {
                "columns": [],
                "page_size": definition.default_page_size,
            },
        }

    normalized_config = normalize_grid_config(definition, preference.config)

    if (
        normalized_config != preference.config
        or preference.definition_version != definition.version
    ):
        preference.config = normalized_config
        preference.definition_version = definition.version
        preference.revision += 1
        preference.save(
            update_fields=[
                "config",
                "definition_version",
                "revision",
                "updated_at",
            ]
        )

    return {
        "grid_key": preference.grid_key,
        "definition_version": preference.definition_version,
        "revision": preference.revision,
        "config": preference.config,
    }


@transaction.atomic
def save_grid_preference(*, user, definition, revision, config):
    normalized_config = normalize_grid_config(
        definition,
        config,
        reject_unknown=True,
    )

    preference = (
        GridPreference.objects.select_for_update()
        .filter(user=user, grid_key=definition.key)
        .first()
    )

    current_revision = preference.revision if preference else 0
    if revision != current_revision:
        raise ValidationError(
            {
                "revision": (
                    "La preferencia cambió en otra sesión. Recargue la grilla "
                    "antes de volver a guardar."
                )
            },
            code="grid_preference_conflict",
        )

    if preference is None:
        try:
            with transaction.atomic():
                preference = GridPreference.objects.create(
                    user=user,
                    grid_key=definition.key,
                    definition_version=definition.version,
                    revision=1,
                    config=normalized_config,
                )
        except IntegrityError:
            raise ValidationError(
                {
                    "revision": (
                        "La preferencia fue creada simultáneamente en otra sesión. "
                        "Recargue la grilla antes de guardar."
                    )
                },
                code="grid_preference_conflict",
            )
    else:
        preference.definition_version = definition.version
        preference.revision += 1
        preference.config = normalized_config
        preference.save(
            update_fields=[
                "definition_version",
                "revision",
                "config",
                "updated_at",
            ]
        )

    return preference


@transaction.atomic
def rename_global_column(*, definition, field_key, visible_name, reason, user, request):
    column = definition.column_map.get(field_key)

    if column is None or field_key == "actions":
        raise ValidationError({"field_key": "La columna no puede renombrarse."})

    override = (
        ColumnDisplayName.objects.select_for_update()
        .filter(
            module=definition.module,
            model_name=definition.model_name,
            field_key=field_key,
        )
        .first()
    )

    previous_name = override.visible_name if override else column.system_label

    if override is None:
        override = ColumnDisplayName(
            module=definition.module,
            model_name=definition.model_name,
            field_key=field_key,
            created_by=user,
        )

    override.visible_name = visible_name
    override.modified_by = user
    override.updated_by = user
    override.status = BaseStatus.ACTIVO
    override.save()

    create_record_change_logs_from_snapshot(
        instance=override,
        old_values={"visible_name": previous_name},
        fields=["visible_name"],
        user=user,
        origin=AuditOrigin.API,
        reason=reason,
        action=AuditAction.RENOMBRAR,
    )
    create_business_audit_log(
        instance=override,
        action=AuditAction.RENOMBRAR,
        user=user,
        origin=AuditOrigin.API,
        reason=reason,
        metadata={
            "grid_key": definition.key,
            "field_key": field_key,
            "system_label": column.system_label,
            "old_visible_name": previous_name,
            "new_visible_name": visible_name,
            "scope": "organization",
        },
        request=request,
    )

    return override
