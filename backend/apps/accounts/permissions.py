from rest_framework.permissions import BasePermission

from .models import UserRole


def get_active_profile(user):
    profile = getattr(user, "profile", None)

    if profile is None or not profile.is_active_profile:
        return None

    return profile


class IsAdministrador(BasePermission):
    message = "Solo Administrador puede realizar esta acción."

    def has_permission(self, request, view):
        profile = get_active_profile(request.user)

        if profile is None:
            return False

        return profile.role == UserRole.ADMINISTRADOR


class IsAdminOrRRHH(BasePermission):
    message = "Solo Administrador o RRHH pueden realizar esta acción."

    def has_permission(self, request, view):
        profile = get_active_profile(request.user)

        if profile is None:
            return False

        return profile.role in [
            UserRole.ADMINISTRADOR,
            UserRole.RRHH,
        ]


class IsOperativoGlobal(BasePermission):
    message = "Solo roles operativos globales pueden realizar esta acción."

    def has_permission(self, request, view):
        profile = get_active_profile(request.user)

        if profile is None:
            return False

        return profile.role in [
            UserRole.ADMINISTRADOR,
            UserRole.RRHH,
            UserRole.INFORMATICO,
            UserRole.FINANZAS_COMERCIAL,
        ]


class IsConsultaOrOperativoGlobal(BasePermission):
    message = "Solo usuarios autorizados pueden consultar esta información."

    def has_permission(self, request, view):
        profile = get_active_profile(request.user)

        if profile is None:
            return False

        return profile.role in [
            UserRole.ADMINISTRADOR,
            UserRole.RRHH,
            UserRole.INFORMATICO,
            UserRole.FINANZAS_COMERCIAL,
            UserRole.CONSULTA,
        ]