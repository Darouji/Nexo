from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.core.models import BaseStatus

from .models import UserRole

MANAGEMENT_ROLES = {
    UserRole.ADMINISTRADOR,
    UserRole.RRHH,
    UserRole.INFORMATICO,
    UserRole.FINANZAS_COMERCIAL,
}

READ_ONLY_ROLES = {
    UserRole.OPERATIVO,
    UserRole.CONSULTA,
}

READ_ROLES = MANAGEMENT_ROLES | READ_ONLY_ROLES

AUDIT_ROLES = MANAGEMENT_ROLES


class InventoryCapability:
    VIEW = "inventory.view"
    MANAGE_PRODUCTS = "inventory.manage_products"
    MANAGE_PRODUCT_LIFECYCLE = "inventory.manage_product_lifecycle"
    MANAGE_CATEGORIES = "inventory.manage_categories"
    REGISTER_ENTRY = "inventory.register_entry"
    ADJUST_STOCK = "inventory.adjust_stock"
    MANAGE_PENDING_RECEIPTS = "inventory.manage_pending_receipts"
    EXPORT_VIEW = "inventory.export_view"
    EXPORT_OFFICIAL = "inventory.export_official"
    MANAGE_LOCATIONS = "inventory.manage_locations"
    TRANSFER_STOCK = "inventory.transfer_stock"


INVENTORY_CAPABILITY_ROLES = {
    InventoryCapability.VIEW: READ_ROLES,
    InventoryCapability.MANAGE_PRODUCTS: MANAGEMENT_ROLES,
    InventoryCapability.MANAGE_PRODUCT_LIFECYCLE: MANAGEMENT_ROLES,
    InventoryCapability.MANAGE_CATEGORIES: MANAGEMENT_ROLES,
    InventoryCapability.REGISTER_ENTRY: MANAGEMENT_ROLES,
    InventoryCapability.ADJUST_STOCK: MANAGEMENT_ROLES,
    InventoryCapability.MANAGE_PENDING_RECEIPTS: MANAGEMENT_ROLES,
    InventoryCapability.EXPORT_VIEW: READ_ROLES,
    InventoryCapability.EXPORT_OFFICIAL: MANAGEMENT_ROLES,
    InventoryCapability.MANAGE_LOCATIONS: MANAGEMENT_ROLES,
    InventoryCapability.TRANSFER_STOCK: MANAGEMENT_ROLES,
}

PURCHASE_VIEW_ROLES = {
    UserRole.ADMINISTRADOR,
    UserRole.FINANZAS_COMERCIAL,
    UserRole.OPERATIVO,
    UserRole.CONSULTA,
}

PURCHASE_MANAGEMENT_ROLES = {
    UserRole.ADMINISTRADOR,
    UserRole.FINANZAS_COMERCIAL,
}


class PurchaseCapability:
    VIEW = "purchases.view"
    MANAGE_SUPPLIERS = "purchases.manage_suppliers"
    CREATE_ORDER = "purchases.create_order"
    EDIT_DRAFT = "purchases.edit_draft"
    SUBMIT_REVIEW = "purchases.submit_review"
    APPROVE_ORDER = "purchases.approve_order"
    ISSUE_ORDER = "purchases.issue_order"
    RECEIVE_ORDER = "purchases.receive_order"
    MANAGE_COSTS = "purchases.manage_costs"
    CANCEL_ORDER = "purchases.cancel_order"
    CLOSE_ORDER = "purchases.close_order"
    EXPORT_VIEW = "purchases.export_view"
    EXPORT_OFFICIAL = "purchases.export_official"


PURCHASE_CAPABILITY_ROLES = {
    PurchaseCapability.VIEW: PURCHASE_VIEW_ROLES,
    PurchaseCapability.MANAGE_SUPPLIERS: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.CREATE_ORDER: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.EDIT_DRAFT: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.SUBMIT_REVIEW: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.APPROVE_ORDER: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.ISSUE_ORDER: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.RECEIVE_ORDER: PURCHASE_MANAGEMENT_ROLES | {UserRole.OPERATIVO},
    PurchaseCapability.MANAGE_COSTS: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.CANCEL_ORDER: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.CLOSE_ORDER: PURCHASE_MANAGEMENT_ROLES,
    PurchaseCapability.EXPORT_VIEW: PURCHASE_VIEW_ROLES,
    PurchaseCapability.EXPORT_OFFICIAL: PURCHASE_MANAGEMENT_ROLES,
}


def is_active_internal_user(user):
    if user is None:
        return False

    if not getattr(user, "is_authenticated", False):
        return False

    if not getattr(user, "is_active", False):
        return False

    return getattr(user, "status", BaseStatus.ACTIVO) == BaseStatus.ACTIVO


def user_role(user):
    if not is_active_internal_user(user):
        return ""

    return getattr(user, "role", "")


def has_management_access(user):
    return user_role(user) in MANAGEMENT_ROLES


def has_read_access(user):
    return user_role(user) in READ_ROLES


def has_audit_access(user):
    return user_role(user) in AUDIT_ROLES


def has_inventory_capability(user, capability):
    allowed_roles = INVENTORY_CAPABILITY_ROLES.get(capability, set())
    return user_role(user) in allowed_roles


def build_inventory_capabilities(user):
    return {
        capability: has_inventory_capability(user, capability)
        for capability in INVENTORY_CAPABILITY_ROLES
    }


def has_purchase_capability(user, capability):
    allowed_roles = PURCHASE_CAPABILITY_ROLES.get(capability, set())
    return user_role(user) in allowed_roles


def build_purchase_capabilities(user):
    return {
        capability: has_purchase_capability(user, capability)
        for capability in PURCHASE_CAPABILITY_ROLES
    }


def module_permission(
    *, can_view=False, can_create=False, can_update=False, can_delete=False
):
    return {
        "can_view": can_view,
        "can_create": can_create,
        "can_update": can_update,
        "can_delete": can_delete,
    }


def build_module_permissions(user):
    """
    Mapa de permisos pensado para frontend.

    Importante:
    - Esto NO reemplaza los permisos reales del backend.
    - El backend sigue siendo la fuente de verdad.
    - Este mapa ayuda a React a mostrar/ocultar módulos y botones.
    """

    can_read = has_read_access(user)
    can_manage = has_management_access(user)
    can_audit = has_audit_access(user)
    can_view_purchases = has_purchase_capability(user, PurchaseCapability.VIEW)
    can_create_purchases = has_purchase_capability(
        user, PurchaseCapability.CREATE_ORDER
    )
    can_update_purchases = any(
        has_purchase_capability(user, capability)
        for capability in (
            PurchaseCapability.EDIT_DRAFT,
            PurchaseCapability.SUBMIT_REVIEW,
            PurchaseCapability.APPROVE_ORDER,
            PurchaseCapability.ISSUE_ORDER,
            PurchaseCapability.RECEIVE_ORDER,
            PurchaseCapability.MANAGE_COSTS,
            PurchaseCapability.CANCEL_ORDER,
            PurchaseCapability.CLOSE_ORDER,
        )
    )

    return {
        "inicio": module_permission(can_view=can_read),
        "omnibox": module_permission(can_view=can_read),
        "estadisticas": module_permission(can_view=can_read),
        "usuarios": module_permission(
            can_view=can_manage,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "colaboradores": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "comercial": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "inventario": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "ventas": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "compras": module_permission(
            can_view=can_view_purchases,
            can_create=can_create_purchases,
            can_update=can_update_purchases,
            can_delete=False,
        ),
        "documentos": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "importaciones": module_permission(
            can_view=can_read,
            can_create=can_manage,
            can_update=can_manage,
            can_delete=False,
        ),
        "auditoria": module_permission(
            can_view=can_audit,
            can_create=False,
            can_update=False,
            can_delete=False,
        ),
        "health_full": module_permission(
            can_view=can_audit,
            can_create=False,
            can_update=False,
            can_delete=False,
        ),
        "grid_labels": module_permission(
            can_view=can_read,
            can_create=False,
            can_update=can_manage,
            can_delete=False,
        ),
    }


def build_menu(user):
    permissions = build_module_permissions(user)

    menu_candidates = [
        {
            "key": "inicio",
            "label": "Inicio",
            "path": "/inicio",
            "module": "inicio",
        },
        {
            "key": "estadisticas",
            "label": "Estadísticas",
            "path": "/estadisticas",
            "module": "estadisticas",
        },
        {
            "key": "comercial",
            "label": "Comercial",
            "path": "/comercial",
            "module": "comercial",
        },
        {
            "key": "inventario",
            "label": "Inventario",
            "path": "/inventario",
            "module": "inventario",
        },
        {
            "key": "ventas",
            "label": "Ventas",
            "path": "/ventas",
            "module": "ventas",
        },
        {
            "key": "compras",
            "label": "Compras / Egresos",
            "path": "/compras",
            "module": "compras",
        },
        {
            "key": "documentos",
            "label": "Documentos",
            "path": "/documentos",
            "module": "documentos",
        },
        {
            "key": "importaciones",
            "label": "Importaciones",
            "path": "/importaciones",
            "module": "importaciones",
        },
        {
            "key": "usuarios",
            "label": "Usuarios",
            "path": "/usuarios",
            "module": "usuarios",
        },
        {
            "key": "auditoria",
            "label": "Auditoría",
            "path": "/auditoria",
            "module": "auditoria",
        },
    ]

    return [
        item
        for item in menu_candidates
        if permissions.get(item["module"], {}).get("can_view")
    ]


def build_token_status(token):
    expire_hours = getattr(settings, "DRF_TOKEN_EXPIRE_HOURS", 12)

    if token is None or not hasattr(token, "created"):
        return {
            "authenticated": True,
            "token_created_at": None,
            "token_expires_at": None,
            "token_expires_in_seconds": None,
            "token_expire_hours": expire_hours,
        }

    expires_at = None
    expires_in_seconds = None

    if expire_hours and expire_hours > 0:
        expires_at = token.created + timedelta(hours=expire_hours)
        expires_in_seconds = max(
            0,
            int((expires_at - timezone.now()).total_seconds()),
        )

    return {
        "authenticated": True,
        "token_created_at": token.created,
        "token_expires_at": expires_at,
        "token_expires_in_seconds": expires_in_seconds,
        "token_expire_hours": expire_hours,
    }


def build_access_payload(user):
    inventory_capabilities = build_inventory_capabilities(user)
    purchase_capabilities = build_purchase_capabilities(user)

    return {
        "role": user_role(user),
        "is_management_role": has_management_access(user),
        "is_read_role": has_read_access(user),
        "is_audit_role": has_audit_access(user),
        "capabilities": {
            **inventory_capabilities,
            **purchase_capabilities,
        },
        "permissions": build_module_permissions(user),
        "menu": build_menu(user),
    }
