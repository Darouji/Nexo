# Permisos de API compartidos por los dominios de NEXO.
# Esta capa aplica autorización en backend; los controles visuales de React sólo
# reflejan estas decisiones y nunca deben considerarse una barrera de seguridad.
from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.core.models import BaseStatus

from .access import has_inventory_capability, has_purchase_capability
from .models import UserRole


# Normaliza la condición mínima común para cualquier permiso interno: identidad
# autenticada, cuenta Django activa y estado funcional ACTIVO.
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


# Las comprobaciones por rol pasan siempre por get_active_user para evitar que
# una cuenta inactiva conserve privilegios por el valor histórico de su rol.
def user_has_role(user, allowed_roles):
    active_user = get_active_user(user)

    if active_user is None:
        return False

    return active_user.role in allowed_roles


class IsAuthenticatedAndActive(BasePermission):
    """Exige una cuenta interna válida antes de evaluar permisos más específicos."""

    message = "El usuario debe estar autenticado y activo."

    def has_permission(self, request, view):
        return get_active_user(request.user) is not None


class HasInventoryCapability(BasePermission):
    """Autoriza una capacidad de Inventario declarada por la vista y la acción."""

    message = "No tiene la capacidad necesaria para realizar esta acción de inventario."

    def has_permission(self, request, view):
        capability_resolver = getattr(
            view,
            "get_required_inventory_capability",
            None,
        )

        # Una vista sin capacidad declarada se rechaza de forma segura en vez de
        # inferir permisos a partir del método HTTP.
        if not callable(capability_resolver):
            return False

        capability = capability_resolver()

        if not capability:
            return False

        return has_inventory_capability(request.user, capability)


class HasPurchaseCapability(BasePermission):
    """Autoriza una capacidad de Compras declarada por la vista y la acción."""

    message = "No tiene la capacidad necesaria para realizar esta acción de compras."

    def has_permission(self, request, view):
        capability_resolver = getattr(
            view,
            "get_required_purchase_capability",
            None,
        )

        # Compras también falla de forma cerrada cuando la acción no declara el
        # permiso concreto que necesita.
        if not callable(capability_resolver):
            return False

        capability = capability_resolver()

        if not capability:
            return False

        return has_purchase_capability(request.user, capability)


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


class CanViewAuditLogs(BasePermission):
    """
    Permiso para ver auditoría y trazabilidad sensible.

    Decisión funcional NEXO:
    Administrador, Informático, RRHH y Finanzas/Comercial tienen acceso
    amplio debido al tamaño reducido del equipo interno.

    No se entrega este acceso a OPERATIVO ni CONSULTA.
    """

    message = "No tiene permisos para ver auditoría del sistema."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.INFORMATICO,
                UserRole.RRHH,
                UserRole.FINANZAS_COMERCIAL,
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


class CanManageGlobalGridLabels(BasePermission):
    """
    Capacidad administrativa para renombrar etiquetas globales de columnas.

    El cambio es organizacional y se refleja para todos los usuarios. Nunca
    representa un alias personal ni modifica el campo técnico.
    """

    message = "No tiene permisos para renombrar columnas globalmente."

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
        # SAFE_METHODS conserva acceso de consulta sin extender ese permiso a
        # mutaciones realizadas con POST, PUT, PATCH o DELETE.
        if request.method in SAFE_METHODS:
            return IsConsultaOrOperativoGlobal().has_permission(request, view)

        return IsOperativoGlobal().has_permission(request, view)
