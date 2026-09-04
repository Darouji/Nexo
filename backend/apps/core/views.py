from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    OpenApiTypes,
    extend_schema,
)
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import CanViewAuditLogs, IsConsultaOrOperativoGlobal

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


def database_health_check():
    """
    Verifica conectividad básica con la base de datos.
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return {
            "status": "ok",
            "message": "Base de datos disponible.",
        }

    except Exception as error:
        return {
            "status": "error",
            "message": "No se pudo conectar a la base de datos.",
            "details": str(error),
        }


@extend_schema(
    tags=["Core"],
    summary="Health check público",
    description=(
        "Verifica que la API NEXO ERP/CRM esté disponible. "
        "Este endpoint es público y no entrega información sensible de configuración."
    ),
    responses={
        200: OpenApiTypes.OBJECT,
    },
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "message": "API Nexo V2 funcionando",
            "version": "0.1.0",
        }
    )


@extend_schema(
    tags=["Core"],
    summary="Health check completo protegido",
    description=(
        "Verifica estado de API, conectividad con base de datos y configuración básica. "
        "Está protegido porque entrega información técnica que solo deben consultar "
        "usuarios con permisos de auditoría o administración."
    ),
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos de auditoría."),
        503: OpenApiResponse(description="Algún check técnico falló."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated, CanViewAuditLogs])
def full_health_check(request):
    database_status = database_health_check()

    checks = {
        "api": {
            "status": "ok",
            "message": "API disponible.",
        },
        "database": database_status,
        "settings": {
            "debug": settings.DEBUG,
            "database_engine": settings.DATABASES["default"]["ENGINE"],
            "allowed_hosts_configured": bool(settings.ALLOWED_HOSTS),
            "token_expire_hours": getattr(settings, "DRF_TOKEN_EXPIRE_HOURS", None),
            "timezone": settings.TIME_ZONE,
        },
    }

    has_errors = any(check.get("status") == "error" for check in checks.values())

    return Response(
        {
            "status": "error" if has_errors else "ok",
            "generated_at": timezone.now(),
            "checks": checks,
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE
        if has_errors
        else status.HTTP_200_OK,
    )


@extend_schema(
    tags=["Core"],
    summary="Omnibox global",
    description=(
        "Búsqueda global transversal de NEXO ERP/CRM. "
        "Debe respetar permisos del usuario autenticado y devolver resultados agrupados "
        "por tipo de entidad o módulo."
    ),
    parameters=[
        OpenApiParameter(
            name="q",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Texto de búsqueda.",
        ),
        OpenApiParameter(
            name="limit",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Cantidad máxima de resultados por grupo.",
        ),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos de consulta."),
    },
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


@extend_schema(
    tags=["Core"],
    summary="Datos de Inicio y Estadísticas",
    description=(
        "Devuelve indicadores iniciales para la pantalla de Inicio y el módulo "
        "de Estadísticas e Inteligencia Comercial. "
        "El contenido exacto puede crecer a medida que se completen módulos como "
        "Comercial, Inventario, Ventas, Documentos e Importaciones."
    ),
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos de consulta."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def dashboard_statistics(request):
    try:
        period_months = int(request.query_params.get("months", 6))
    except (TypeError, ValueError):
        period_months = 6

    if period_months not in {1, 3, 5, 6, 12}:
        period_months = 6

    payload = get_dashboard_statistics(
        user=request.user,
        sales_period_months=period_months,
    )
    return Response(payload)


@extend_schema(
    tags=["Core"],
    summary="Actividad reciente de auditoría",
    description=(
        "Devuelve actividad reciente global del sistema. "
        "Está pensado para la pantalla Inicio, el módulo Auditoría y paneles "
        "de trazabilidad."
    ),
    parameters=[
        OpenApiParameter(
            name="limit",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Cantidad máxima de registros. Máximo 200.",
        ),
        OpenApiParameter(
            name="module",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filtra por módulo.",
        ),
        OpenApiParameter(
            name="action",
            type=str,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Filtra por acción de auditoría.",
        ),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos de auditoría."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated, CanViewAuditLogs])
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


@extend_schema(
    tags=["Core"],
    summary="Historial por registro",
    description=(
        "Devuelve historial campo a campo de un registro específico. "
        "Requiere app_label, model y object_id para identificar el modelo y registro."
    ),
    parameters=[
        OpenApiParameter(
            name="app_label",
            type=str,
            location=OpenApiParameter.QUERY,
            required=True,
            description="App Django del modelo. Ejemplo: sales.",
        ),
        OpenApiParameter(
            name="model",
            type=str,
            location=OpenApiParameter.QUERY,
            required=True,
            description="Nombre del modelo en minúscula. Ejemplo: venta.",
        ),
        OpenApiParameter(
            name="object_id",
            type=str,
            location=OpenApiParameter.QUERY,
            required=True,
            description="ID del registro.",
        ),
        OpenApiParameter(
            name="limit",
            type=int,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Cantidad máxima de cambios. Máximo 200.",
        ),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiResponse(description="Faltan parámetros obligatorios."),
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos de auditoría."),
        404: OpenApiResponse(description="Tipo de contenido no encontrado."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated, CanViewAuditLogs])
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
