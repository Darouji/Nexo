from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.core.audit import (
    capture_field_values,
    create_record_change_logs_from_snapshot,
)
from apps.core.models import AuditAction, AuditOrigin

from .models import (
    KardexMovementType,
    MovimientoKardex,
    PendientePorRecibir,
    Producto,
)

PENDING_RECEIPT_AUDIT_FIELDS = [
    "cantidad_recibida",
    "cantidad_cancelada",
    "cantidad_pendiente",
    "estado",
    "updated_by",
]


def get_operator(user):
    if user is None:
        return None

    if not getattr(user, "is_authenticated", False):
        return None

    return user


def build_reference_data(reference):
    if reference is None:
        return {
            "reference_content_type": None,
            "reference_object_id": "",
            "reference_repr": "",
        }

    return {
        "reference_content_type": ContentType.objects.get_for_model(
            reference,
            for_concrete_model=False,
        ),
        "reference_object_id": str(reference.pk),
        "reference_repr": str(reference)[:255],
    }


def register_kardex_movement(
    *,
    producto,
    movement_type,
    cantidad,
    motivo,
    user=None,
    origin=AuditOrigin.MANUAL,
    reference=None,
):
    """
    Única entrada oficial para modificar stock.

    Regla:
    - No se edita Producto.stock_actual directamente desde vistas o serializers.
    - Todo cambio de stock crea MovimientoKardex.
    - La operación es atómica: producto y Kardex se guardan juntos o no se guarda nada.
    """

    if producto is None:
        raise ValidationError({"producto": "El producto es obligatorio."})

    if not motivo or not str(motivo).strip():
        raise ValidationError({"motivo": "El motivo del movimiento es obligatorio."})

    if cantidad == 0:
        raise ValidationError(
            {"cantidad": "La cantidad del movimiento no puede ser cero."}
        )

    if (
        movement_type
        in [
            KardexMovementType.ENTRADA_IMPORTACION,
            KardexMovementType.ENTRADA_MANUAL,
            KardexMovementType.ENTRADA_RECEPCION,
            KardexMovementType.REVERSA_ANULACION,
        ]
        and cantidad <= 0
    ):
        raise ValidationError(
            {"cantidad": "Este tipo de movimiento debe tener cantidad positiva."}
        )

    if movement_type == KardexMovementType.SALIDA_VENTA and cantidad >= 0:
        raise ValidationError(
            {"cantidad": "La salida por venta debe registrarse con cantidad negativa."}
        )

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": "Este producto no controla stock y no debe generar Kardex."
                }
            )

        stock_antes = locked_product.stock_actual
        stock_despues = stock_antes + cantidad

        if stock_despues < 0:
            raise ValidationError(
                {
                    "stock": (
                        "Stock insuficiente. "
                        f"Solicitado: {abs(cantidad)}. "
                        f"Disponible: {stock_antes}."
                    )
                }
            )

        locked_product.stock_actual = stock_despues
        locked_product.updated_by = get_operator(user)
        locked_product.save(
            update_fields=[
                "stock_actual",
                "updated_by",
                "updated_at",
            ]
        )

        reference_data = build_reference_data(reference)

        movement = MovimientoKardex(
            producto=locked_product,
            movement_type=movement_type,
            origin=origin,
            operador=get_operator(user),
            cantidad=cantidad,
            stock_antes=stock_antes,
            stock_despues=stock_despues,
            motivo=str(motivo).strip(),
            created_by=get_operator(user),
            updated_by=get_operator(user),
            **reference_data,
        )
        movement.save()

        return movement


def register_manual_entry(*, producto, cantidad, motivo, user=None):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.ENTRADA_MANUAL,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.MANUAL,
    )


def register_inventory_adjustment(*, producto, cantidad, motivo, user=None):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.AJUSTE_INVENTARIO,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.MANUAL,
    )


def register_sale_exit(*, producto, cantidad, motivo, user=None, reference=None):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.SALIDA_VENTA,
        cantidad=-abs(cantidad),
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
    )


def register_sale_annulment_reverse(
    *, producto, cantidad, motivo, user=None, reference=None
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.REVERSA_ANULACION,
        cantidad=abs(cantidad),
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
    )


def register_sale_difference_adjustment(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    reference=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.AJUSTE_INVENTARIO,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
    )


def create_pending_receipt(
    *,
    producto,
    cantidad,
    motivo="",
    referencia="",
    user=None,
):
    motivo = str(motivo or "").strip()
    referencia = str(referencia or "").strip()

    if cantidad <= 0:
        raise ValidationError(
            {"cantidad": "La cantidad por recibir debe ser positiva."}
        )

    if not motivo and not referencia:
        raise ValidationError(
            {
                "motivo": (
                    "Debe indicar un motivo o una referencia para registrar "
                    "un pendiente por recibir."
                )
            }
        )

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": (
                        "Este producto no maneja inventario y no puede registrar "
                        "unidades por recibir."
                    )
                }
            )

        pending_receipt = PendientePorRecibir.objects.create(
            producto=locked_product,
            cantidad_original=cantidad,
            referencia=referencia,
            motivo=motivo,
            created_by=get_operator(user),
            updated_by=get_operator(user),
        )

    return pending_receipt


def receive_pending_receipt(
    *,
    pending_receipt,
    cantidad,
    motivo,
    user=None,
):
    motivo = str(motivo or "").strip()

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad recibida debe ser positiva."})

    if not motivo:
        raise ValidationError({"motivo": "El motivo de la recepción es obligatorio."})

    with transaction.atomic():
        pending_product_id = pending_receipt.producto_id

        locked_product = Producto.objects.select_for_update().get(pk=pending_product_id)

        locked_pending_receipt = (
            PendientePorRecibir.objects.select_for_update()
            .select_related("producto")
            .get(pk=pending_receipt.pk)
        )

        if locked_pending_receipt.producto_id != locked_product.pk:
            raise ValidationError(
                {
                    "producto": (
                        "La recepción pendiente no corresponde al producto indicado."
                    )
                }
            )

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": (
                        "Este producto no maneja inventario y no puede recibir "
                        "stock físico."
                    )
                }
            )

        if cantidad > locked_pending_receipt.cantidad_pendiente:
            raise ValidationError(
                {
                    "cantidad": (
                        "La cantidad recibida no puede superar las unidades pendientes. "
                        f"Pendiente actual: "
                        f"{locked_pending_receipt.cantidad_pendiente}."
                    )
                }
            )

        old_values = capture_field_values(
            locked_pending_receipt,
            PENDING_RECEIPT_AUDIT_FIELDS,
        )

        movement = register_kardex_movement(
            producto=locked_product,
            movement_type=KardexMovementType.ENTRADA_RECEPCION,
            cantidad=cantidad,
            motivo=motivo,
            user=user,
            origin=AuditOrigin.MANUAL,
            reference=locked_pending_receipt,
        )

        locked_pending_receipt.cantidad_recibida += cantidad
        locked_pending_receipt.updated_by = get_operator(user)
        locked_pending_receipt.save(
            update_fields=[
                "cantidad_recibida",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_pending_receipt,
            old_values=old_values,
            fields=PENDING_RECEIPT_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.CAMBIAR_ESTADO,
        )

    return locked_pending_receipt, movement


def cancel_pending_receipt(
    *,
    pending_receipt,
    cantidad,
    motivo,
    user=None,
):
    motivo = str(motivo or "").strip()

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad a cancelar debe ser positiva."})

    if not motivo:
        raise ValidationError({"motivo": "El motivo de la cancelación es obligatorio."})

    with transaction.atomic():
        Producto.objects.select_for_update().get(pk=pending_receipt.producto_id)

        locked_pending_receipt = PendientePorRecibir.objects.select_for_update().get(
            pk=pending_receipt.pk
        )

        if cantidad > locked_pending_receipt.cantidad_pendiente:
            raise ValidationError(
                {
                    "cantidad": (
                        "La cantidad cancelada no puede superar las unidades pendientes. "
                        f"Pendiente actual: "
                        f"{locked_pending_receipt.cantidad_pendiente}."
                    )
                }
            )

        old_values = capture_field_values(
            locked_pending_receipt,
            PENDING_RECEIPT_AUDIT_FIELDS,
        )

        locked_pending_receipt.cantidad_cancelada += cantidad
        locked_pending_receipt.updated_by = get_operator(user)
        locked_pending_receipt.save(
            update_fields=[
                "cantidad_cancelada",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_pending_receipt,
            old_values=old_values,
            fields=PENDING_RECEIPT_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.CAMBIAR_ESTADO,
        )

    return locked_pending_receipt
