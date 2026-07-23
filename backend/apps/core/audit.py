from django.contrib.contenttypes.models import ContentType

from .audit_targets import build_audit_target_snapshot
from .models import AuditAction, AuditLog, AuditOrigin, RecordChangeLog


def normalize_audit_value(value):
    """
    Convierte valores Python/Django a texto seguro para auditoría.

    No busca ser una serialización perfecta.
    Busca dejar una huella clara, estable y legible.
    """

    if value is None:
        return ""

    if hasattr(value, "pk") and hasattr(value, "_meta"):
        return str(value.pk)

    if hasattr(value, "name") and hasattr(value, "storage"):
        return str(value.name or "")

    return str(value)


def capture_field_values(instance, fields):
    """
    Captura una foto simple de valores antes de modificar un registro.
    """

    values = {}

    for field_name in fields:
        try:
            values[field_name] = normalize_audit_value(getattr(instance, field_name))
        except Exception:
            values[field_name] = "<no disponible>"

    return values


def create_record_change_logs_from_snapshot(
    *,
    instance,
    old_values,
    fields,
    user=None,
    origin=AuditOrigin.API,
    reason="",
    action=AuditAction.EDITAR,
):
    """
    Crea registros RecordChangeLog comparando valores antiguos vs actuales.

    Se usa después de guardar el modelo.
    """

    content_type = ContentType.objects.get_for_model(
        instance,
        for_concrete_model=False,
    )

    logs = []

    for field_name in fields:
        old_value = old_values.get(field_name, "")

        try:
            new_value = normalize_audit_value(getattr(instance, field_name))
        except Exception:
            new_value = "<no disponible>"

        if old_value == new_value:
            continue

        logs.append(
            RecordChangeLog(
                content_type=content_type,
                object_id=str(instance.pk),
                action=action,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                changed_by=user if getattr(user, "is_authenticated", False) else None,
                origin=origin,
                reason=reason,
            )
        )

    if logs:
        RecordChangeLog.objects.bulk_create(logs)

    return logs


def create_business_audit_log(
    *,
    instance,
    action,
    user=None,
    origin=AuditOrigin.API,
    reason="",
    metadata=None,
    request=None,
):
    """
    Registra una auditoría global dentro de la misma transacción de negocio.

    A diferencia de la auditoría de middleware, esta función se ejecuta
    dentro de transaction.atomic() cuando una operación es crítica.
    """

    content_type = ContentType.objects.get_for_model(
        instance,
        for_concrete_model=False,
    )

    audit_metadata = dict(metadata or {})
    audit_metadata.setdefault(
        "target_snapshot",
        build_audit_target_snapshot(instance),
    )
    ip_address = None
    user_agent = ""

    if request is not None:
        request_id = str(getattr(request, "request_id", "") or "").strip()

        if request_id:
            audit_metadata.setdefault("request_id", request_id[:100])

        # REMOTE_ADDR evita confiar automáticamente en X-Forwarded-For.
        ip_address = request.META.get("REMOTE_ADDR")
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]

    return AuditLog.objects.create(
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        origin=origin,
        module=instance._meta.app_label,
        model_name=instance._meta.model_name,
        content_type=content_type,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        ip_address=ip_address,
        user_agent=user_agent,
        reason=str(reason or "").strip(),
        metadata=audit_metadata,
    )
