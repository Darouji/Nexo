import logging
import uuid

from django.contrib.contenttypes.models import ContentType
from django.utils.deprecation import MiddlewareMixin

from apps.core.audit_targets import (
    build_audit_target_snapshot,
    resolve_request_audit_instance,
)
from apps.core.models import AuditAction, AuditLog, AuditOrigin
from apps.core.request_context import reset_request_id, set_request_id

logger = logging.getLogger(__name__)


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def get_module_from_path(path):
    parts = [part for part in path.split("/") if part]

    if len(parts) >= 2 and parts[0] == "api":
        return parts[1]

    if parts:
        return parts[0]

    return ""


AUDIT_MIDDLEWARE_EXCLUDED_PATHS = {
    "/api/auth/login/",
    "/api/auth/logout/",
}

REQUEST_ID_HEADER = "X-Request-ID"
REQUEST_ID_META_KEY = "HTTP_X_REQUEST_ID"


def get_or_create_request_id(request):
    """
    Obtiene un Request ID enviado por el cliente o genera uno nuevo.

    Permite correlacionar:
    - respuesta frontend
    - logs backend
    - auditoría
    - errores reportados por usuario
    """

    request_id = request.META.get(REQUEST_ID_META_KEY, "").strip()

    if not request_id:
        request_id = str(uuid.uuid4())

    return request_id[:100]


def get_action_from_method(method):
    method = method.upper()

    if method == "POST":
        return AuditAction.CREAR

    if method in ["PUT", "PATCH"]:
        return AuditAction.EDITAR

    if method == "DELETE":
        return AuditAction.ELIMINAR

    return AuditAction.EDITAR


def get_audit_target_data(request):
    instance = getattr(request, "audit_instance", None)

    if instance is None or not getattr(instance, "pk", None):
        instance = resolve_request_audit_instance(request)

    if instance is None or not getattr(instance, "pk", None):
        return {
            "content_type": None,
            "object_id": "",
            "model_name": "",
            "object_repr": request.path,
            "target_snapshot": None,
        }

    content_type = ContentType.objects.get_for_model(
        instance,
        for_concrete_model=False,
    )

    return {
        "content_type": content_type,
        "object_id": str(instance.pk),
        "model_name": instance._meta.model_name,
        "object_repr": str(instance)[:255],
        "target_snapshot": build_audit_target_snapshot(instance),
    }


class ActivityLogMiddleware(MiddlewareMixin):
    """
    Auditoría liviana por request.

    Este middleware no reemplaza la auditoría específica por registro.
    Solo deja una huella global de operaciones API de modificación.

    Además asigna un Request ID a cada petición para trazabilidad.
    """

    def process_request(self, request):
        request.request_id = get_or_create_request_id(request)
        request._request_id_context_token = set_request_id(request.request_id)

    def process_response(self, request, response):
        request_id = getattr(request, "request_id", None)

        if not request_id:
            request_id = get_or_create_request_id(request)

        response[REQUEST_ID_HEADER] = request_id

        should_audit = (
            request.method in ["POST", "PUT", "PATCH", "DELETE"]
            and hasattr(request, "user")
            and request.user.is_authenticated
            and request.path.startswith("/api/")
            and request.path not in AUDIT_MIDDLEWARE_EXCLUDED_PATHS
            and not getattr(request, "skip_activity_audit", False)
        )

        if not should_audit:
            context_token = getattr(request, "_request_id_context_token", None)
            reset_request_id(context_token)

            return response

        try:
            target_data = get_audit_target_data(request)

            metadata = {
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "outcome": (
                    "completed"
                    if 200 <= response.status_code < 400
                    else "rejected"
                    if 400 <= response.status_code < 500
                    else "error"
                ),
                "request_id": request_id,
            }

            custom_metadata = getattr(request, "audit_metadata", {})
            if isinstance(custom_metadata, dict):
                metadata.update(custom_metadata)

            if target_data["target_snapshot"]:
                metadata.setdefault(
                    "target_snapshot",
                    target_data["target_snapshot"],
                )

            AuditLog.objects.create(
                actor=request.user,
                action=getattr(
                    request,
                    "audit_action",
                    get_action_from_method(request.method),
                ),
                origin=getattr(request, "audit_origin", AuditOrigin.API),
                module=get_module_from_path(request.path),
                model_name=target_data["model_name"],
                content_type=target_data["content_type"],
                object_id=target_data["object_id"],
                object_repr=target_data["object_repr"],
                ip_address=get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                reason=str(getattr(request, "audit_reason", "") or "").strip(),
                metadata=metadata,
            )
        except Exception:
            logger.exception(
                "No se pudo registrar la auditoría global de la solicitud.",
                extra={
                    "request_id": request_id,
                    "path": request.path,
                    "method": request.method,
                },
            )

        context_token = getattr(request, "_request_id_context_token", None)
        reset_request_id(context_token)

        return response
