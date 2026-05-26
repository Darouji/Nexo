from rest_framework.permissions import BasePermission

from .models import UserRole


class IsAdminOrRRHH(BasePermission):
    message = "Solo Administrador o RRHH pueden realizar esta acción."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)

        if profile is None or not profile.is_active_profile:
            return False

        return profile.role in [
            UserRole.ADMINISTRADOR,
            UserRole.RRHH,
        ]