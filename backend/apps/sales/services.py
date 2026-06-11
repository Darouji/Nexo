from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.models import AlertSeverity, BaseStatus
from apps.inventory.services import register_sale_annulment_reverse, register_sale_exit

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
    net = sum((detail.valor_total for detail in venta.detalles.all()), Decimal("0"))
    net = quantize_money(net)
    iva = quantize_money(net * IVA_RATE)
    total = quantize_money(net + iva)

    venta.valor_neto = net
    venta.iva = iva
    venta.total = total
    venta.save(update_fields=["valor_neto", "iva", "total", "updated_at"])


def create_sale_with_details(*, sale_data, details_data, user=None):
    if not details_data:
        raise ValidationError({"detalles": "La venta debe tener al menos un detalle."})

    operator = get_operator(user)

    with transaction.atomic():
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
    """

    operator = get_operator(user)

    with transaction.atomic():
        locked_sale = Venta.objects.select_for_update().get(pk=venta.pk)

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError(
                {"sale_status": "No se puede editar una venta anulada desde este flujo."}
            )

        for field, value in sale_data.items():
            setattr(locked_sale, field, value)

        locked_sale.updated_by = operator
        locked_sale.save()

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

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale


def annul_sale(*, venta, reason, user=None):
    operator = get_operator(user)

    if not reason or not str(reason).strip():
        raise ValidationError({"motivo": "El motivo de anulación es obligatorio."})

    with transaction.atomic():
        locked_sale = (
            Venta.objects.select_for_update()
            .prefetch_related("detalles__producto")
            .get(pk=venta.pk)
        )

        if locked_sale.sale_status == VentaStatus.ANULADA:
            raise ValidationError({"sale_status": "La venta ya está anulada."})

        if locked_sale.stock_descontado:
            for detail in locked_sale.detalles.all():
                if not detail.controla_stock_snapshot:
                    continue

                register_sale_annulment_reverse(
                    producto=detail.producto,
                    cantidad=detail.cantidad,
                    motivo=f"Reversa por anulación de venta #{locked_sale.pk}: {reason}",
                    user=operator,
                    reference=locked_sale,
                )

        locked_sale.sale_status = VentaStatus.ANULADA
        locked_sale.status = BaseStatus.ANULADO
        locked_sale.stock_descontado = False
        locked_sale.anulada_at = timezone.now()
        locked_sale.anulada_by = operator
        locked_sale.anulacion_motivo = str(reason).strip()
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

        refresh_sale_alerts(locked_sale, user=operator)

        return locked_sale