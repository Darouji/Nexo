from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.core.models import BaseStatus

from .models import UserRole


def get_active_user(user):
    if user is None:
        return None

    if not user.is_authenticated:
        return None

    if not user.is_active:
        return None

    if getattr(user, "status", BaseStatus.ACTIVO) != BaseStatus.ACTIVO:
        return None

    return user


def user_has_role(user, allowed_roles):
    active_user = get_active_user(user)

    if active_user is None:
        return False

    return active_user.role in allowed_roles


class IsAuthenticatedAndActive(BasePermission):
    message = "El usuario debe estar autenticado y activo."

    def has_permission(self, request, view):
        return get_active_user(request.user) is not None


class IsAdministrador(BasePermission):
    message = "Solo Administrador puede realizar esta acción."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [UserRole.ADMINISTRADOR],
        )


class IsAdminOrRRHH(BasePermission):
    message = "Solo Administrador o RRHH pueden realizar esta acción."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.RRHH,
            ],
        )


class CanManageUsers(BasePermission):
    message = "No tiene permisos para gestionar usuarios."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.RRHH,
                UserRole.INFORMATICO,
                UserRole.FINANZAS_COMERCIAL,
            ],
        )


class IsOperativoGlobal(BasePermission):
    """
    Rol de gestión interna global.

    Se mantiene este nombre porque otros módulos ya lo importan.
    """

    message = "Solo roles operativos globales pueden realizar esta acción."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.RRHH,
                UserRole.INFORMATICO,
                UserRole.FINANZAS_COMERCIAL,
            ],
        )


class IsConsultaOrOperativoGlobal(BasePermission):
    """
    Permiso de lectura general.

    CONSULTA puede leer.
    OPERATIVO también puede consultar información operativa.
    """

    message = "Solo usuarios autorizados pueden consultar esta información."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.RRHH,
                UserRole.INFORMATICO,
                UserRole.FINANZAS_COMERCIAL,
                UserRole.OPERATIVO,
                UserRole.CONSULTA,
            ],
        )


class IsReadOnlyOrOperativoGlobal(BasePermission):
    """
    Lectura para usuarios autorizados.
    Escritura solo para roles de gestión global.
    """

    message = "No tiene permisos para realizar esta acción."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return IsConsultaOrOperativoGlobal().has_permission(request, view)

        return IsOperativoGlobal().has_permission(request, view)