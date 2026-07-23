def _clean_text(value, *, maximum=255):
    return str(value or "").strip()[:maximum]


def build_audit_target_snapshot(instance):
    """
    Construye una identidad legible y estable para presentar una auditoría.

    Cada módulo puede implementar ``get_audit_target_snapshot`` en su modelo
    para publicar identificadores de negocio sin acoplar Core a ese módulo.
    """

    provider = getattr(instance, "get_audit_target_snapshot", None)

    if callable(provider):
        raw_snapshot = provider()
    else:
        raw_snapshot = {
            "entity_label": instance._meta.verbose_name,
            "display_name": str(instance),
            "internal_id": instance.pk,
            "identifiers": [],
        }

    if not isinstance(raw_snapshot, dict):
        raw_snapshot = {}

    identifiers = []

    for item in raw_snapshot.get("identifiers", []):
        if not isinstance(item, dict):
            continue

        key = _clean_text(item.get("key"), maximum=100)
        label = _clean_text(item.get("label"), maximum=120)

        if not key or not label:
            continue

        identifiers.append(
            {
                "key": key,
                "label": label,
                "value": _clean_text(item.get("value")),
            }
        )

    return {
        "entity_label": _clean_text(
            raw_snapshot.get("entity_label") or instance._meta.verbose_name,
            maximum=120,
        ),
        "display_name": _clean_text(
            raw_snapshot.get("display_name") or str(instance)
        ),
        "internal_id": _clean_text(
            raw_snapshot.get("internal_id") or instance.pk,
            maximum=100,
        ),
        "identifiers": identifiers,
    }


def resolve_request_audit_instance(request):
    """
    Resuelve de forma genérica el registro objetivo de una vista Django REST.

    Se usa principalmente cuando una mutación fue rechazada antes de que la
    vista pudiera asignar ``request.audit_instance``. No depende de Inventario
    ni conoce modelos concretos.
    """

    resolver_match = getattr(request, "resolver_match", None)

    if resolver_match is None:
        return None

    view_class = getattr(resolver_match.func, "cls", None)
    queryset = getattr(view_class, "queryset", None)
    model = getattr(queryset, "model", None)

    if model is None:
        return None

    lookup_url_kwarg = getattr(view_class, "lookup_url_kwarg", None) or "pk"
    lookup_value = resolver_match.kwargs.get(lookup_url_kwarg)

    if lookup_value in (None, ""):
        return None

    try:
        return model._default_manager.filter(pk=lookup_value).first()
    except (TypeError, ValueError):
        return None
