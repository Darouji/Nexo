from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsConsultaOrOperativoGlobal

from .models import AuditLog, RecordChangeLog
from .search import global_search
from .serializers import AuditLogSerializer, RecordChangeLogSerializer
from .statistics import get_dashboard_statistics


def parse_limit(value, *, default=50, maximum=200):
    try:
        limit = int(value)
    except (TypeError, ValueError):
        return default

    if limit < 1:
        return default

    return min(limit, maximum)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "message": "API Serkan V2 funcionando",
            "version": "0.1.0",
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def omnibox_search(request):
    query = request.query_params.get("q", "")
    limit = request.query_params.get("limit")

    payload = global_search(
        user=request.user,
        query=query,
        limit_per_group=limit,
    )

    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def dashboard_statistics(request):
    payload = get_dashboard_statistics(user=request.user)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def audit_activity(request):
    """
    Actividad reciente global del sistema.

    Pensado para:
    - Inicio
    - módulo Auditoría
    - paneles de trazabilidad
    """

    limit = parse_limit(request.query_params.get("limit"), default=50, maximum=200)
    module = request.query_params.get("module", "").strip()
    action = request.query_params.get("action", "").strip()

    queryset = AuditLog.objects.select_related("actor").order_by("-created_at")

    if module:
        queryset = queryset.filter(module=module)

    if action:
        queryset = queryset.filter(action=action)

    logs = queryset[:limit]

    return Response(
        {
            "count": len(logs),
            "limit": limit,
            "results": AuditLogSerializer(logs, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def record_change_history(request):
    """
    Historial campo a campo de un registro específico.

    Ejemplo:
    /api/audit/record-changes/?app_label=sales&model=venta&object_id=1
    """

    app_label = request.query_params.get("app_label", "").strip()
    model = request.query_params.get("model", "").strip().lower()
    object_id = request.query_params.get("object_id", "").strip()
    limit = parse_limit(request.query_params.get("limit"), default=50, maximum=200)

    if not app_label or not model or not object_id:
        return Response(
            {
                "detail": (
                    "Debe enviar app_label, model y object_id. "
                    "Ejemplo: ?app_label=sales&model=venta&object_id=1"
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        content_type = ContentType.objects.get(
            app_label=app_label,
            model=model,
        )
    except ContentType.DoesNotExist:
        return Response(
            {
                "detail": (
                    "No existe un tipo de contenido con esos datos. "
                    "Revise app_label y model."
                )
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    queryset = (
        RecordChangeLog.objects.select_related("changed_by", "content_type")
        .filter(
            content_type=content_type,
            object_id=str(object_id),
        )
        .order_by("-created_at")
    )

    changes = queryset[:limit]

    return Response(
        {
            "count": len(changes),
            "limit": limit,
            "app_label": app_label,
            "model": model,
            "object_id": object_id,
            "results": RecordChangeLogSerializer(changes, many=True).data,
        }
    )