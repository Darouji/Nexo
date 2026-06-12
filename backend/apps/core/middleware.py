import uuid

from django.utils.deprecation import MiddlewareMixin

from apps.core.models import AuditAction, AuditLog, AuditOrigin
from apps.core.request_context import reset_request_id, set_request_id


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
        )

        if not should_audit:
            context_token = getattr(request, "_request_id_context_token", None)
            reset_request_id(context_token)

            return response

        try:
            AuditLog.objects.create(
                actor=request.user,
                action=get_action_from_method(request.method),
                origin=AuditOrigin.API,
                module=get_module_from_path(request.path),
                model_name="",
                object_repr=request.path,
                ip_address=get_client_ip(request),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                metadata={
                    "method": request.method,
                    "path": request.path,
                    "status_code": response.status_code,
                    "request_id": request_id,
                },
            )
        except Exception:
            # La auditoría nunca debe impedir que la respuesta principal termine.
            # Los errores técnicos se revisarán con logging formal más adelante.
            pass

        context_token = getattr(request, "_request_id_context_token", None)
        reset_request_id(context_token)

        return response
