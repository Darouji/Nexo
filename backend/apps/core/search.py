from django.db.models import Q

from apps.accounts.models import User, UserRole
from apps.accounts.permissions import user_has_role
from apps.collaborators.models import Collaborator
from apps.commercial.models import Area, Contacto, Holding, Minera, Subarea
from apps.core.models import BaseStatus
from apps.core.utils import normalize_rut, normalize_text
from apps.documents.models import DocumentFile
from apps.imports.models import ImportBatch
from apps.inventory.models import Categoria, Producto
from apps.sales.models import Venta


PEOPLE_SEARCH_ROLES = [
    UserRole.ADMINISTRADOR,
    UserRole.RRHH,
    UserRole.INFORMATICO,
    UserRole.FINANZAS_COMERCIAL,
]

GENERAL_READ_ROLES = [
    UserRole.ADMINISTRADOR,
    UserRole.RRHH,
    UserRole.INFORMATICO,
    UserRole.FINANZAS_COMERCIAL,
    UserRole.OPERATIVO,
    UserRole.CONSULTA,
]

DEFAULT_LIMIT_PER_GROUP = 5
MAX_LIMIT_PER_GROUP = 10


def normalize_limit(value):
    try:
        limit = int(value)
    except (TypeError, ValueError):
        return DEFAULT_LIMIT_PER_GROUP

    if limit <= 0:
        return DEFAULT_LIMIT_PER_GROUP

    return min(limit, MAX_LIMIT_PER_GROUP)


def can_search_people(user):
    return user_has_role(user, PEOPLE_SEARCH_ROLES)


def can_search_general(user):
    return user_has_role(user, GENERAL_READ_ROLES)


def make_result(
    *,
    type,
    module,
    id,
    label,
    description="",
    api_url="",
    metadata=None,
):
    return {
        "type": type,
        "module": module,
        "id": id,
        "label": label,
        "description": description,
        "api_url": api_url,
        "metadata": metadata or {},
    }


def search_users(query, query_normalized, limit):
    queryset = (
        User.objects.filter(
            is_active=True,
            status=BaseStatus.ACTIVO,
        )
        .filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(email__icontains=query)
            | Q(role__icontains=query_normalized)
            | Q(position__icontains=query)
            | Q(department__icontains=query)
        )
        .order_by("username")[:limit]
    )

    results = []

    for user in queryset:
        full_name = user.get_full_name().strip()
        label = full_name or user.username
        description_parts = [user.get_role_display()]

        if user.email:
            description_parts.append(user.email)

        if user.department:
            description_parts.append(user.department)

        results.append(
            make_result(
                type="usuario",
                module="accounts",
                id=user.pk,
                label=label,
                description=" | ".join(description_parts),
                api_url=f"/api/auth/users/{user.pk}/",
                metadata={
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "status": user.status,
                },
            )
        )

    return results


def search_collaborators(query, query_normalized, limit):
    rut_normalized = normalize_rut(query)

    queryset = (
        Collaborator.objects.filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(full_name_normalized__icontains=query_normalized)
            | Q(rut__icontains=query)
            | Q(rut_normalized__icontains=rut_normalized)
            | Q(email__icontains=query)
            | Q(email_normalized__icontains=query.lower())
            | Q(position__icontains=query)
            | Q(department__icontains=query)
        )
        .order_by("last_name", "first_name")[:limit]
    )

    results = []

    for collaborator in queryset:
        description_parts = []

        if collaborator.position:
            description_parts.append(collaborator.position)

        if collaborator.department:
            description_parts.append(collaborator.department)

        if collaborator.email:
            description_parts.append(collaborator.email)

        results.append(
            make_result(
                type="colaborador",
                module="collaborators",
                id=collaborator.pk,
                label=collaborator.full_name,
                description=" | ".join(description_parts),
                api_url=f"/api/collaborators/{collaborator.pk}/",
                metadata={
                    "rut": collaborator.rut,
                    "email": collaborator.email,
                    "department": collaborator.department,
                    "status": collaborator.status,
                },
            )
        )

    return results


def search_commercial(query, query_normalized, limit):
    results = []

    holdings = (
        Holding.objects.filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(name__icontains=query)
            | Q(name_normalized__icontains=query_normalized)
            | Q(description__icontains=query)
        )
        .order_by("name")[:limit]
    )

    for holding in holdings:
        results.append(
            make_result(
                type="holding",
                module="commercial",
                id=holding.pk,
                label=holding.name,
                description=holding.description,
                api_url=f"/api/commercial/holdings/{holding.pk}/",
                metadata={"status": holding.status},
            )
        )

    mineras = (
        Minera.objects.select_related("holding", "city")
        .filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(name__icontains=query)
            | Q(name_normalized__icontains=query_normalized)
            | Q(rut__icontains=query)
            | Q(rut_normalized__icontains=normalize_rut(query))
            | Q(email__icontains=query)
            | Q(city__name__icontains=query)
            | Q(holding__name__icontains=query)
        )
        .order_by("name")[:limit]
    )

    for minera in mineras:
        description_parts = []

        if minera.holding:
            description_parts.append(f"Holding: {minera.holding.name}")

        if minera.city:
            description_parts.append(f"Ciudad: {minera.city.name}")

        if minera.rut:
            description_parts.append(f"RUT: {minera.rut}")

        results.append(
            make_result(
                type="minera",
                module="commercial",
                id=minera.pk,
                label=minera.name,
                description=" | ".join(description_parts),
                api_url=f"/api/commercial/mineras/{minera.pk}/",
                metadata={
                    "rut": minera.rut,
                    "holding_id": minera.holding_id,
                    "city_id": minera.city_id,
                    "status": minera.status,
                },
            )
        )

    areas = (
        Area.objects.select_related("minera")
        .filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(name__icontains=query)
            | Q(name_normalized__icontains=query_normalized)
            | Q(minera__name__icontains=query)
            | Q(description__icontains=query)
        )
        .order_by("minera__name", "name")[:limit]
    )

    for area in areas:
        results.append(
            make_result(
                type="area",
                module="commercial",
                id=area.pk,
                label=area.name,
                description=f"Minera: {area.minera.name}",
                api_url=f"/api/commercial/areas/{area.pk}/",
                metadata={
                    "minera_id": area.minera_id,
                    "status": area.status,
                },
            )
        )

    subareas = (
        Subarea.objects.select_related("area", "area__minera")
        .filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(name__icontains=query)
            | Q(name_normalized__icontains=query_normalized)
            | Q(area__name__icontains=query)
            | Q(area__minera__name__icontains=query)
            | Q(description__icontains=query)
        )
        .order_by("area__minera__name", "area__name", "name")[:limit]
    )

    for subarea in subareas:
        results.append(
            make_result(
                type="subarea",
                module="commercial",
                id=subarea.pk,
                label=subarea.name,
                description=f"{subarea.area.minera.name} | {subarea.area.name}",
                api_url=f"/api/commercial/subareas/{subarea.pk}/",
                metadata={
                    "area_id": subarea.area_id,
                    "minera_id": subarea.area.minera_id,
                    "status": subarea.status,
                },
            )
        )

    contactos = (
        Contacto.objects.select_related("subarea", "subarea__area", "subarea__area__minera")
        .filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(full_name_normalized__icontains=query_normalized)
            | Q(email__icontains=query)
            | Q(email_normalized__icontains=query.lower())
            | Q(phone__icontains=query)
            | Q(phone_normalized__icontains=query)
            | Q(position__icontains=query)
            | Q(subarea__name__icontains=query)
            | Q(subarea__area__name__icontains=query)
            | Q(subarea__area__minera__name__icontains=query)
        )
        .order_by("last_name", "first_name")[:limit]
    )

    for contacto in contactos:
        results.append(
            make_result(
                type="contacto",
                module="commercial",
                id=contacto.pk,
                label=contacto.full_name,
                description=(
                    f"{contacto.minera.name} | "
                    f"{contacto.area.name} | "
                    f"{contacto.subarea.name}"
                ),
                api_url=f"/api/commercial/contactos/{contacto.pk}/",
                metadata={
                    "email": contacto.email,
                    "phone": contacto.phone,
                    "subarea_id": contacto.subarea_id,
                    "area_id": contacto.area.id,
                    "minera_id": contacto.minera.id,
                    "status": contacto.status,
                },
            )
        )

    return results


def search_inventory(query, query_normalized, limit):
    results = []

    categorias = (
        Categoria.objects.filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(name__icontains=query)
            | Q(name_normalized__icontains=query_normalized)
            | Q(description__icontains=query)
        )
        .order_by("name")[:limit]
    )

    for categoria in categorias:
        results.append(
            make_result(
                type="categoria_producto",
                module="inventory",
                id=categoria.pk,
                label=categoria.name,
                description=categoria.description,
                api_url=f"/api/inventory/categorias/{categoria.pk}/",
                metadata={"status": categoria.status},
            )
        )

    productos = (
        Producto.objects.select_related("categoria")
        .filter(status=BaseStatus.ACTIVO)
        .filter(
            Q(modelo__icontains=query)
            | Q(modelo_normalized__icontains=query_normalized)
            | Q(detalle__icontains=query)
            | Q(codigo_sap__icontains=query)
            | Q(codigo_sap_normalized__icontains=query_normalized)
            | Q(categoria__name__icontains=query)
            | Q(categoria__name_normalized__icontains=query_normalized)
        )
        .order_by("categoria__name", "modelo")[:limit]
    )

    for producto in productos:
        results.append(
            make_result(
                type="producto",
                module="inventory",
                id=producto.pk,
                label=producto.modelo,
                description=(
                    f"{producto.categoria.name} | "
                    f"Stock: {producto.stock_actual} | "
                    f"SAP: {producto.codigo_sap or 'Sin SAP'}"
                ),
                api_url=f"/api/inventory/productos/{producto.pk}/",
                metadata={
                    "categoria_id": producto.categoria_id,
                    "codigo_sap": producto.codigo_sap,
                    "stock_actual": producto.stock_actual,
                    "stock_critico": producto.stock_critico,
                    "controla_stock": producto.controla_stock,
                    "status": producto.status,
                },
            )
        )

    return results


def search_sales(query, query_normalized, limit):
    ventas = (
        Venta.objects.select_related("minera", "area", "subarea", "contacto", "operador")
        .prefetch_related("detalles__producto")
        .filter(
            Q(factura_numero__icontains=query)
            | Q(orden_compra__icontains=query)
            | Q(numero_guia_hes__icontains=query)
            | Q(tipo_documento__icontains=query_normalized)
            | Q(sale_status__icontains=query_normalized)
            | Q(observations__icontains=query)
            | Q(minera__name__icontains=query)
            | Q(minera__name_normalized__icontains=query_normalized)
            | Q(area__name__icontains=query)
            | Q(subarea__name__icontains=query)
            | Q(contacto__first_name__icontains=query)
            | Q(contacto__last_name__icontains=query)
            | Q(detalles__producto__modelo__icontains=query)
            | Q(detalles__producto__modelo_normalized__icontains=query_normalized)
            | Q(detalles__producto__codigo_sap__icontains=query)
        )
        .distinct()
        .order_by("-fecha_venta", "-created_at")[:limit]
    )

    results = []

    for venta in ventas:
        description_parts = [
            venta.minera.name,
            venta.get_sale_status_display(),
            f"Total: {venta.total}",
        ]

        if venta.orden_compra:
            description_parts.append(f"OC: {venta.orden_compra}")

        if venta.factura_numero:
            description_parts.append(f"Factura: {venta.factura_numero}")

        results.append(
            make_result(
                type="venta",
                module="sales",
                id=venta.pk,
                label=f"Venta #{venta.pk}",
                description=" | ".join(description_parts),
                api_url=f"/api/sales/ventas/{venta.pk}/",
                metadata={
                    "sale_status": venta.sale_status,
                    "minera_id": venta.minera_id,
                    "fecha_venta": venta.fecha_venta.isoformat() if venta.fecha_venta else None,
                    "valor_neto": str(venta.valor_neto),
                    "iva": str(venta.iva),
                    "total": str(venta.total),
                    "stock_descontado": venta.stock_descontado,
                    "status": venta.status,
                },
            )
        )

    return results


def search_documents(query, query_normalized, limit):
    documents = (
        DocumentFile.objects.select_related("owner_content_type")
        .prefetch_related("versions")
        .filter(
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(document_type__icontains=query_normalized)
            | Q(owner_repr__icontains=query)
            | Q(owner_content_type__app_label__icontains=query)
            | Q(owner_content_type__model__icontains=query)
            | Q(versions__original_filename__icontains=query)
            | Q(versions__file_sha256__icontains=query)
        )
        .distinct()
        .order_by("-created_at")[:limit]
    )

    results = []

    for document in documents:
        active_version = document.active_version

        results.append(
            make_result(
                type="documento",
                module="documents",
                id=document.pk,
                label=document.title,
                description=(
                    f"{document.get_document_type_display()} | "
                    f"{document.owner_repr or 'Sin dueño legible'}"
                ),
                api_url=f"/api/documents/files/{document.pk}/",
                metadata={
                    "document_type": document.document_type,
                    "owner_content_type_id": document.owner_content_type_id,
                    "owner_object_id": document.owner_object_id,
                    "active_version_id": active_version.pk if active_version else None,
                    "active_filename": active_version.original_filename if active_version else "",
                    "status": document.status,
                },
            )
        )

    return results


def search_imports(query, query_normalized, limit):
    batches = (
        ImportBatch.objects.filter(
            Q(target__icontains=query_normalized)
            | Q(batch_status__icontains=query_normalized)
            | Q(original_filename__icontains=query)
            | Q(file_sha256__icontains=query)
            | Q(notes__icontains=query)
            | Q(rows__raw_data__icontains=query)
            | Q(rows__normalized_data__icontains=query)
            | Q(rows__messages__icontains=query)
            | Q(rows__imported_repr__icontains=query)
        )
        .distinct()
        .order_by("-created_at")[:limit]
    )

    results = []

    for batch in batches:
        results.append(
            make_result(
                type="importacion",
                module="imports",
                id=batch.pk,
                label=f"Importación #{batch.pk}",
                description=(
                    f"{batch.get_target_display()} | "
                    f"{batch.get_batch_status_display()} | "
                    f"{batch.original_filename}"
                ),
                api_url=f"/api/imports/batches/{batch.pk}/",
                metadata={
                    "target": batch.target,
                    "batch_status": batch.batch_status,
                    "total_rows": batch.total_rows,
                    "valid_rows": batch.valid_rows,
                    "error_rows": batch.error_rows,
                    "duplicate_rows": batch.duplicate_rows,
                    "review_rows": batch.review_rows,
                    "imported_rows": batch.imported_rows,
                    "status": batch.status,
                },
            )
        )

    return results


def global_search(*, user, query, limit_per_group=None):
    query = (query or "").strip()
    limit = normalize_limit(limit_per_group)

    if len(query) < 2:
        return {
            "query": query,
            "normalized_query": normalize_text(query),
            "limit_per_group": limit,
            "count": 0,
            "results": [],
        }

    query_normalized = normalize_text(query)
    results = []

    if can_search_people(user):
        results.extend(search_users(query, query_normalized, limit))
        results.extend(search_collaborators(query, query_normalized, limit))

    if can_search_general(user):
        results.extend(search_commercial(query, query_normalized, limit))
        results.extend(search_inventory(query, query_normalized, limit))
        results.extend(search_sales(query, query_normalized, limit))
        results.extend(search_documents(query, query_normalized, limit))
        results.extend(search_imports(query, query_normalized, limit))

    return {
        "query": query,
        "normalized_query": query_normalized,
        "limit_per_group": limit,
        "count": len(results),
        "results": results,
    }