from django.utils.deprecation import MiddlewareMixin

from apps.core.models import AuditAction, AuditLog, AuditOrigin


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
    """

    def process_response(self, request, response):
        should_audit = (
            request.method in ["POST", "PUT", "PATCH", "DELETE"]
            and hasattr(request, "user")
            and request.user.is_authenticated
            and request.path.startswith("/api/")
            and request.path not in AUDIT_MIDDLEWARE_EXCLUDED_PATHS
        )

        if not should_audit:
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
                },
            )
        except Exception:
            # La auditoría nunca debe impedir que la respuesta principal termine.
            # Los errores técnicos se revisarán con logging formal más adelante.
            pass

        return response
