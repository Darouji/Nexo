import json
from collections import defaultdict
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.audit import (
    capture_field_values,
    create_record_change_logs_from_snapshot,
)
from apps.core.models import (
    AlertSeverity,
    AuditAction,
    AuditOrigin,
    BaseStatus,
    RecordChangeLog,
)
from apps.inventory.models import Producto
from apps.inventory.services import (
    register_sale_annulment_reverse,
    register_sale_difference_adjustment,
    register_sale_exit,
)

from .models import (
    DetalleVenta,
    Venta,
    VentaAlert,
    VentaAlertCode,
    VentaStatus,
    quantize_money,
)

IVA_RATE = Decimal("0.19")


def get_operator(user):
    if user is None:
        return None

    if not getattr(user, "is_authenticated", False):
        return None

    return user


def validate_sale_stock_availability(details_data):
    """
    Valida stock de forma preventiva antes de crear la venta.

    Regla:
    - Agrupa cantidades por producto.
    - Bloquea productos con stock insuficiente antes de crear Venta/DetalleVenta.
    - Usa select_for_update dentro de la transacción para evitar carreras.
    - Devuelve un error estructurado para frontend, auditoría y API.
    """

    required_by_product = defaultdict(int)
    product_labels = {}

    for detail_data in details_data:
        producto = detail_data["producto"]
        cantidad = int(detail_data["cantidad"])

        if not producto.controla_stock:
            continue

        required_by_product[producto.pk] += cantidad
        product_labels[producto.pk] = str(producto)

    if not required_by_product:
        return

    locked_products = Producto.objects.select_for_update().filter(
        pk__in=required_by_product.keys()
    )
    products_by_id = {product.pk: product for product in locked_products}

    for product_id, requested_quantity in required_by_product.items():
        product = products_by_id.get(product_id)

        if product is None:
            raise ValidationError(
                {
                    "producto": (
                        "No se encontró el producto seleccionado para validar stock."
                    )
                }
            )

        if not product.controla_stock:
            continue

        if product.stock_actual < requested_quantity:
            raise ValidationError(
                {
                    "code": VentaAlertCode.STOCK_INSUFICIENTE,
                    "message": "Stock insuficiente",
                    "producto_id": product.pk,
                    "producto": product_labels.get(product_id, str(product)),
                    "cantidad_solicitada": requested_quantity,
                    "stock_disponible": product.stock_actual,
                }
            )


def refresh_sale_alerts(venta, user=None):
    """
    Recalcula alertas específicas de venta.

    Esta función no reemplaza las validaciones bloqueantes.
    Solo deja alertas legibles y filtrables para frontend y estadísticas.
    """

    now = timezone.now()

    VentaAlert.objects.filter(
        venta=venta,
        is_active=True,
    ).update(
        is_active=False,
        resolved_at=now,
        resolved_by=get_operator(user),
        updated_by=get_operator(user),
    )

    if venta.sale_status == VentaStatus.ANULADA:
        return

    alerts_to_create = []

    if not venta.factura_numero and not venta.factura_pdf:
        alerts_to_create.append(
            VentaAlert(
                venta=venta,
                code=VentaAlertCode.FALTA_FACTURA,
                message="Falta factura",
                severity=AlertSeverity.ADVERTENCIA,
                created_by=get_operator(user),
                updated_by=get_operator(user),
            )
        )

    if not venta.numero_guia_hes and not venta.guia_pdf:
        alerts_to_create.append(
            VentaAlert(
                venta=venta,
                code=VentaAlertCode.FALTA_GUIA,
                message="Falta guía de despacho o HES",
                severity=AlertSeverity.ADVERTENCIA,
                created_by=get_operator(user),
                updated_by=get_operator(user),
            )
        )

    if venta.factura_numero:
        duplicated_invoice = (
            Venta.objects.filter(factura_numero=venta.factura_numero)
            .exclude(pk=venta.pk)
            .exclude(sale_status=VentaStatus.ANULADA)
            .exists()
        )

        if duplicated_invoice:
            alerts_to_create.append(
                VentaAlert(
                    venta=venta,
                    code=VentaAlertCode.FACTURA_DUPLICADA,
                    message="Factura posiblemente duplicada",
                    severity=AlertSeverity.BLOQUEANTE,
                    created_by=get_operator(user),
                    updated_by=get_operator(user),
                )
            )

    if venta.orden_compra:
        duplicated_oc = (
            Venta.objects.filter(
                orden_compra=venta.orden_compra,
                minera=venta.minera,
            )
            .exclude(pk=venta.pk)
            .exclude(sale_status=VentaStatus.ANULADA)
            .exists()
        )

        if duplicated_oc:
            alerts_to_create.append(
                VentaAlert(
                    venta=venta,
                    code=VentaAlertCode.OC_DUPLICADA,
                    message="Orden de compra posiblemente duplicada",
                    severity=AlertSeverity.ADVERTENCIA,
                    created_by=get_operator(user),
                    updated_by=get_operator(user),
                )
            )

    if alerts_to_create:
        VentaAlert.objects.bulk_create(alerts_to_create)


def calculate_sale_totals(venta):
    net = sum(
        (
            detail.valor_total
            for detail in venta.detalles.filter(status=BaseStatus.ACTIVO)
        ),
        Decimal("0"),
    )
    net = quantize_money(net)
    iva = quantize_money(net * IVA_RATE)
    total = quantize_money(net + iva)

    venta.valor_neto = net
    venta.iva = iva
    venta.total = total
    venta.save(update_fields=["valor_neto", "iva", "total", "updated_at"])


def summarize_existing_sale_details(details):
    data = []

    for detail in details:
        data.append(
            {
                "id": detail.pk,
                "producto_id": detail.producto_id,
                "producto": str(detail.producto),
                "cantidad": detail.cantidad,
                "valor_unitario": str(detail.valor_unitario),
                "valor_total": str(detail.valor_total),
                "codigo_sap": detail.codigo_sap,
                "controla_stock": detail.controla_stock_snapshot,
            }
        )

    return json.dumps(data, ensure_ascii=False, sort_keys=True)


def summarize_sale_details_payload(details_data):
    data = []

    for detail_data in details_data:
        producto = detail_data["producto"]
        cantidad = int(detail_data["cantidad"])
        valor_unitario = Decimal(detail_data["valor_unitario"])
        valor_total = quantize_money(Decimal(cantidad) * valor_unitario)

        data.append(
            {
                "producto_id": producto.pk,
                "producto": str(producto),
                "cantidad": cantidad,
                "valor_unitario": str(valor_unitario),
                "valor_total": str(valor_total),
                "codigo_sap": detail_data.get("codigo_sap", "") or producto.codigo_sap,
                "controla_stock": producto.controla_stock,
            }
        )

    return json.dumps(data, ensure_ascii=False, sort_keys=True)


def aggregate_stock_quantities_from_existing_details(details):
    quantities = defaultdict(int)
    labels = {}

    for detail in details:
        if not detail.controla_stock_snapshot:
            continue

        quantities[detail.producto_id] += detail.cantidad
        labels[detail.producto_id] = str(detail.producto)

    return quantities, labels


def aggregate_stock_quantities_from_payload(details_data):
    quantities = defaultdict(int)
    labels = {}

    for detail_data in details_data:
        producto = detail_data["producto"]

        if not producto.controla_stock:
            continue

        quantities[producto.pk] += int(detail_data["cantidad"])
        labels[producto.pk] = str(producto)

    return quantities, labels


def validate_sale_stock_difference(*, old_quantities, new_quantities, product_labels):
    affected_product_ids = sorted(
        set(old_quantities.keys()) | set(new_quantities.keys())
    )

    if not affected_product_ids:
        return {}, {}

    locked_products = (
        Producto.objects.select_for_update()
        .filter(
            pk__in=affected_product_ids,
        )
        .order_by("pk")
    )
    products_by_id = {product.pk: product for product in locked_products}

    stock_differences = {}

    for product_id in affected_product_ids:
        old_quantity = old_quantities.get(product_id, 0)
        new_quantity = new_quantities.get(product_id, 0)
        difference = new_quantity - old_quantity

        if difference == 0:
            continue

        product = products_by_id.get(product_id)

        if product is None:
            raise ValidationError(
                {
                    "producto": (
                        "No se encontró el producto seleccionado para validar "
                        "la edición de stock."
                    )
                }
            )

        if difference > 0 and product.stock_actual < difference:
            raise ValidationError(
                {
                    "code": VentaAlertCode.STOCK_INSUFICIENTE,
                    "message": "Stock insuficiente para editar la venta",
                    "producto_id": product.pk,
                    "producto": product_labels.get(product_id, str(product)),
                    "cantidad_solicitada": difference,
                    "stock_disponible": product.stock_actual,
                }
            )

        stock_differences[product_id] = difference

    return products_by_id, stock_differences


def create_sale_details_change_log(
    *, venta, old_summary, new_summary, user=None, reason=""
):
    content_type = ContentType.objects.get_for_model(
        venta,
        for_concrete_model=False,
    )

    return RecordChangeLog.objects.create(
        content_type=content_type,
        object_id=str(venta.pk),
        action=AuditAction.EDITAR,
        field_name="detalles",
        old_value=old_summary,
        new_value=new_summary,
        changed_by=user if getattr(user, "is_authenticated", False) else None,
        origin=AuditOrigin.API,
        reason=reason,
    )


def create_sale_with_details(*, sale_data, details_data, user=None):
    if not details_data:
        raise ValidationError({"detalles": "La venta debe tener al menos un detalle."})

    operator = get_operator(user)

    with transaction.atomic():
        validate_sale_stock_availability(details_data)
        venta = Venta.objects.create(
            operador=operator,
            sale_status=VentaStatus.INGRESADA,
            stock_descontado=False,
            created_by=operator,
            updated_by=operator,
            **sale_data,
        )

        created_details = []

        for detail_data in details_data:
            producto = detail_data["producto"]

            detail = DetalleVenta.objects.create(
                venta=venta,
                producto=producto,
                cantidad=detail_data["cantidad"],
                valor_unitario=detail_data["valor_unitario"],
                codigo_sap=detail_data.get("codigo_sap", ""),
                created_by=operator,
                updated_by=operator,
            )
            created_details.append(detail)

        calculate_sale_totals(venta)

        stock_was_discounted = False

        for detail in created_details:
            if not detail.producto.controla_stock:
                continue

            register_sale_exit(
                producto=detail.producto,
                cantidad=detail.cantidad,
                motivo=f"Salida por venta #{venta.pk}",
                user=operator,
                reference=venta,
            )

            stock_was_discounted = True

        if stock_was_discounted:
            venta.stock_descontado = True
            venta.save(update_fields=["stock_descontado", "updated_at"])

        refresh_sale_alerts(venta, user=operator)

        return venta


def update_sale_metadata(*, venta, sale_data, user=None):
    """
    Actualiza campos generales de una venta y recalcula sus alertas.

    Regla:
    - No edita líneas de venta.
    - No toca Kardex.
    - No permite modificar una venta anulada desde este flujo.
    - Refresca alertas específicas para que Inicio, Ventas y Estadísticas
      no muestren problemas ya corregidos.
    - Registra cambios reales campo a campo en RecordChangeLog.
    """

    operator = get_operator(user)

    with transaction.atomic():
        locked_sale = Venta.objects.select_for_update().get(pk=venta.pk)

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError(
                {
                    "sale_status": "No se puede editar una venta anulada desde este flujo."
                }
            )

        changed_fields = list(sale_data.keys())
        old_values = capture_field_values(locked_sale, changed_fields)

        for field, value in sale_data.items():
            setattr(locked_sale, field, value)

        locked_sale.updated_by = operator
        locked_sale.save()

        create_record_change_logs_from_snapshot(
            instance=locked_sale,
            old_values=old_values,
            fields=changed_fields,
            user=operator,
            origin=AuditOrigin.API,
            reason="Actualización de datos generales de venta.",
        )

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale


def replace_sale_details_with_differential_kardex(
    *,
    venta,
    details_data,
    reason,
    user=None,
):
    """
    Edita líneas de venta mediante flujo controlado.

    Regla:
    - No se editan líneas directamente por PATCH/PUT normal.
    - Se archivan líneas activas anteriores.
    - Se crean nuevas líneas activas.
    - Se calcula diferencia de stock por producto.
    - Se generan movimientos Kardex de diferencia.
    - No se sobrescribe Kardex anterior.
    - La operación completa es atómica.
    """

    if not details_data:
        raise ValidationError({"lineas": "La venta debe tener al menos una línea."})

    if not reason or not str(reason).strip():
        raise ValidationError(
            {"motivo": "El motivo de edición de líneas es obligatorio."}
        )

    clean_reason = str(reason).strip()
    operator = get_operator(user)

    with transaction.atomic():
        locked_sale = Venta.objects.select_for_update().get(pk=venta.pk)

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError(
                {"sale_status": ("No se pueden editar líneas de una venta anulada.")}
            )

        active_details = list(
            DetalleVenta.objects.select_related(
                "producto",
                "producto__categoria",
            )
            .filter(
                venta=locked_sale,
                status=BaseStatus.ACTIVO,
            )
            .order_by("pk")
        )

        old_summary = summarize_existing_sale_details(active_details)
        new_summary = summarize_sale_details_payload(details_data)

        old_quantities, old_labels = aggregate_stock_quantities_from_existing_details(
            active_details
        )
        new_quantities, new_labels = aggregate_stock_quantities_from_payload(
            details_data
        )

        product_labels = {
            **old_labels,
            **new_labels,
        }

        products_by_id, stock_differences = validate_sale_stock_difference(
            old_quantities=old_quantities,
            new_quantities=new_quantities,
            product_labels=product_labels,
        )

        if active_details:
            DetalleVenta.objects.filter(
                pk__in=[detail.pk for detail in active_details]
            ).update(
                status=BaseStatus.ARCHIVADO,
                updated_by=operator,
                updated_at=timezone.now(),
            )

        new_details = []

        for detail_data in details_data:
            producto = detail_data["producto"]

            detail = DetalleVenta.objects.create(
                venta=locked_sale,
                producto=producto,
                cantidad=detail_data["cantidad"],
                valor_unitario=detail_data["valor_unitario"],
                codigo_sap=detail_data.get("codigo_sap", ""),
                created_by=operator,
                updated_by=operator,
            )
            new_details.append(detail)

        for product_id, difference in stock_differences.items():
            if difference == 0:
                continue

            product = products_by_id[product_id]

            if difference > 0:
                register_sale_difference_adjustment(
                    producto=product,
                    cantidad=-difference,
                    motivo=(
                        f"Ajuste diferencial por edición de venta #{locked_sale.pk}: "
                        f"aumento de cantidad. {clean_reason}"
                    ),
                    user=operator,
                    reference=locked_sale,
                )
            else:
                register_sale_difference_adjustment(
                    producto=product,
                    cantidad=abs(difference),
                    motivo=(
                        f"Ajuste diferencial por edición de venta #{locked_sale.pk}: "
                        f"disminución de cantidad. {clean_reason}"
                    ),
                    user=operator,
                    reference=locked_sale,
                )

        calculate_sale_totals(locked_sale)

        locked_sale.stock_descontado = any(
            detail.controla_stock_snapshot for detail in new_details
        )
        locked_sale.updated_by = operator
        locked_sale.save(
            update_fields=[
                "stock_descontado",
                "updated_by",
                "updated_at",
            ]
        )

        create_sale_details_change_log(
            venta=locked_sale,
            old_summary=old_summary,
            new_summary=new_summary,
            user=operator,
            reason=f"Edición controlada de líneas de venta: {clean_reason}",
        )

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale


def concretar_sale(*, venta, user=None):
    operator = get_operator(user)

    with transaction.atomic():
        locked_sale = Venta.objects.select_for_update().get(pk=venta.pk)

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError(
                {"sale_status": "No se puede concretar una venta anulada."}
            )

        if locked_sale.sale_status == VentaStatus.CONCRETADA:
            return locked_sale

        audited_fields = [
            "sale_status",
            "concretada_at",
            "concretada_by",
        ]
        old_values = capture_field_values(locked_sale, audited_fields)

        locked_sale.sale_status = VentaStatus.CONCRETADA
        locked_sale.concretada_at = timezone.now()
        locked_sale.concretada_by = operator
        locked_sale.updated_by = operator
        locked_sale.save(
            update_fields=[
                "sale_status",
                "concretada_at",
                "concretada_by",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_sale,
            old_values=old_values,
            fields=audited_fields,
            user=operator,
            origin=AuditOrigin.API,
            reason="Concreción de venta.",
            action=AuditAction.CAMBIAR_ESTADO,
        )

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale


def annul_sale(*, venta, reason, user=None):
    operator = get_operator(user)

    if not reason or not str(reason).strip():
        raise ValidationError({"motivo": "El motivo de anulación es obligatorio."})

    clean_reason = str(reason).strip()

    with transaction.atomic():
        locked_sale = (
            Venta.objects.select_for_update()
            .prefetch_related("detalles__producto")
            .get(pk=venta.pk)
        )

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError({"sale_status": "La venta ya está anulada."})

        audited_fields = [
            "sale_status",
            "status",
            "stock_descontado",
            "anulada_at",
            "anulada_by",
            "anulacion_motivo",
        ]
        old_values = capture_field_values(locked_sale, audited_fields)

        if locked_sale.stock_descontado:
            for detail in locked_sale.detalles.all():
                if not detail.controla_stock_snapshot:
                    continue

                register_sale_annulment_reverse(
                    producto=detail.producto,
                    cantidad=detail.cantidad,
                    motivo=f"Reversa por anulación de venta #{locked_sale.pk}: {clean_reason}",
                    user=operator,
                    reference=locked_sale,
                )

        locked_sale.sale_status = VentaStatus.ANULADA
        locked_sale.status = BaseStatus.ANULADO
        locked_sale.stock_descontado = False
        locked_sale.anulada_at = timezone.now()
        locked_sale.anulada_by = operator
        locked_sale.anulacion_motivo = clean_reason
        locked_sale.updated_by = operator
        locked_sale.save(
            update_fields=[
                "sale_status",
                "status",
                "stock_descontado",
                "anulada_at",
                "anulada_by",
                "anulacion_motivo",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_sale,
            old_values=old_values,
            fields=audited_fields,
            user=operator,
            origin=AuditOrigin.API,
            reason=f"Anulación de venta: {clean_reason}",
            action=AuditAction.ANULAR,
        )

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale
