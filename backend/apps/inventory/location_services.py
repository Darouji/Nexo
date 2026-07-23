from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Sum

from apps.core.audit import create_business_audit_log
from apps.core.models import AuditAction, AuditOrigin, BaseStatus

from .location_stock_context import allow_location_stock_write
from .models import (
    ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
    InventoryLocation,
    InventoryLocationType,
    InventoryTransfer,
    PendientePorRecibir,
    ProductLocationBalance,
    Producto,
)


REGULARIZATION_LOCATION_NAME = "Stock histórico por regularizar"
SENSITIVE_LOCATION_TYPES = {
    InventoryLocationType.DOMICILIO_CUSTODIA,
    InventoryLocationType.CLIENTE_FAENA,
}


def get_regularization_location():
    location = InventoryLocation.objects.filter(is_regularization=True).first()

    if not location:
        raise ValidationError(
            {
                "ubicacion": (
                    "No existe la ubicación técnica de regularización. "
                    "Ejecute las migraciones antes de operar inventario."
                )
            }
        )

    return location


def validate_operational_location(location, *, field_name="ubicacion"):
    if location is None:
        raise ValidationError({field_name: "La ubicación es obligatoria."})

    if location.status != BaseStatus.ACTIVO:
        raise ValidationError(
            {field_name: "La ubicación seleccionada no se encuentra activa."}
        )

    return location


def resolve_stock_location(*, product, location=None, quantity_delta):
    """
    Resuelve la ubicación para un movimiento de stock.

    Las entradas históricas o integraciones antiguas sin ubicación se asignan
    a regularización. Para una salida sólo se infiere cuando existe exactamente
    una ubicación capaz de cubrirla; si hay ambigüedad, se exige selección.
    """

    if location is not None:
        validate_operational_location(location)

        if quantity_delta < 0:
            available = (
                ProductLocationBalance.objects.filter(
                    product_id=product.pk,
                    location_id=location.pk,
                )
                .values_list("quantity", flat=True)
                .first()
                or 0
            )
            required = abs(quantity_delta)
            if available < required:
                raise ValidationError(
                    {
                        "ubicacion": (
                            f"Stock insuficiente en {location.name}. "
                            f"Solicitado: {required}. Disponible: {available}."
                        )
                    }
                )

        return location

    if quantity_delta >= 0:
        return get_regularization_location()

    required = abs(quantity_delta)
    candidates = list(
        ProductLocationBalance.objects.select_related("location")
        .filter(
            product_id=product.pk,
            quantity__gte=required,
            location__status=BaseStatus.ACTIVO,
        )
        .order_by("location_id")[:2]
    )

    if len(candidates) == 1:
        return candidates[0].location

    if not candidates:
        raise ValidationError(
            {
                "ubicacion": (
                    "Ninguna ubicación activa posee stock suficiente para "
                    f"esta salida de {required} unidades."
                )
            }
        )

    raise ValidationError(
        {
            "ubicacion": (
                "El producto tiene stock suficiente en más de una ubicación. "
                "Debe indicar desde cuál se realizará la salida."
            )
        }
    )


def apply_location_balance_delta(*, product, location, delta):
    if delta == 0:
        raise ValidationError(
            {"cantidad": "La variación por ubicación no puede ser cero."}
        )

    validate_operational_location(location)

    balance = (
        ProductLocationBalance.objects.select_for_update()
        .filter(product_id=product.pk, location_id=location.pk)
        .first()
    )

    if balance is None:
        if delta < 0:
            raise ValidationError(
                {
                    "ubicacion": (
                        f"No existe stock de {product.modelo} en {location.name}."
                    )
                }
            )

        balance = ProductLocationBalance(
            product=product,
            location=location,
            quantity=0,
        )

    next_quantity = balance.quantity + delta
    if next_quantity < 0:
        raise ValidationError(
            {
                "ubicacion": (
                    f"Stock insuficiente en {location.name}. "
                    f"Solicitado: {abs(delta)}. Disponible: {balance.quantity}."
                )
            }
        )

    balance.quantity = next_quantity
    with allow_location_stock_write():
        balance.save()

    return balance


def product_location_total(product):
    return (
        ProductLocationBalance.objects.filter(product_id=product.pk).aggregate(
            total=Sum("quantity")
        )["total"]
        or 0
    )


def assert_product_location_total(product):
    location_total = product_location_total(product)

    if location_total != product.stock_actual:
        raise ValidationError(
            {
                "stock": (
                    "Se detectó una inconsistencia entre el stock total y los "
                    "saldos por ubicación. La operación fue revertida."
                )
            }
        )

    return location_total


def _transfer_payload_matches(
    transfer,
    *,
    product,
    origin_location,
    destination_location,
    quantity,
    reason,
    evidence_reference,
):
    return (
        transfer.product_id == product.pk
        and transfer.origin_location_id == origin_location.pk
        and transfer.destination_location_id == destination_location.pk
        and transfer.quantity == quantity
        and transfer.reason == reason
        and transfer.evidence_reference == evidence_reference
    )


def transfer_inventory(
    *,
    product,
    origin_location,
    destination_location,
    quantity,
    reason,
    idempotency_key,
    user,
    evidence_reference="",
    request=None,
):
    reason = str(reason or "").strip()
    evidence_reference = str(evidence_reference or "").strip()
    idempotency_key = str(idempotency_key or "").strip()

    if not idempotency_key:
        raise ValidationError(
            {
                "idempotency_key": (
                    "La transferencia requiere una clave de idempotencia."
                )
            }
        )
    if quantity <= 0:
        raise ValidationError({"quantity": "La cantidad debe ser positiva."})
    if not reason:
        raise ValidationError({"reason": "El motivo es obligatorio."})
    if user is None or not getattr(user, "is_authenticated", False):
        raise ValidationError(
            {"responsible": "La transferencia requiere un usuario responsable."}
        )

    existing = (
        InventoryTransfer.objects.select_related(
            "product",
            "origin_location",
            "destination_location",
        )
        .filter(idempotency_key=idempotency_key)
        .first()
    )
    if existing:
        if not _transfer_payload_matches(
            existing,
            product=product,
            origin_location=origin_location,
            destination_location=destination_location,
            quantity=quantity,
            reason=reason,
            evidence_reference=evidence_reference,
        ):
            raise ValidationError(
                {
                    "idempotency_key": (
                        "Esta clave ya fue utilizada por una transferencia "
                        "con datos diferentes."
                    )
                }
            )
        return existing, False

    with transaction.atomic():
        locked_product = (
            Producto.objects.select_for_update()
            .select_related("categoria")
            .get(pk=product.pk)
        )
        if (
            locked_product.status != BaseStatus.ACTIVO
            or not locked_product.controla_stock
        ):
            raise ValidationError(
                {
                    "product": (
                        "El producto debe estar activo y manejar inventario "
                        "para transferir stock."
                    )
                }
            )

        location_ids = sorted(
            {origin_location.pk, destination_location.pk}
        )
        locations = list(
            InventoryLocation.objects.select_for_update()
            .filter(pk__in=location_ids)
            .order_by("pk")
        )
        if len(locations) != 2:
            raise ValidationError(
                {"destination_location": "Una de las ubicaciones ya no existe."}
            )

        locations_by_id = {location.pk: location for location in locations}
        origin = locations_by_id[origin_location.pk]
        destination = locations_by_id[destination_location.pk]
        validate_operational_location(origin, field_name="origin_location")
        validate_operational_location(
            destination,
            field_name="destination_location",
        )

        if origin.pk == destination.pk:
            raise ValidationError(
                {
                    "destination_location": (
                        "La ubicación de destino debe ser diferente del origen."
                    )
                }
            )

        if (
            origin.location_type in SENSITIVE_LOCATION_TYPES
            or destination.location_type in SENSITIVE_LOCATION_TYPES
        ) and not evidence_reference:
            raise ValidationError(
                {
                    "evidence_reference": (
                        "Debe indicar una referencia o evidencia cuando la "
                        "transferencia involucra custodia o cliente/faena."
                    )
                }
            )

        existing = (
            InventoryTransfer.objects.select_for_update()
            .select_related(
                "product",
                "origin_location",
                "destination_location",
            )
            .filter(idempotency_key=idempotency_key)
            .first()
        )
        if existing:
            if not _transfer_payload_matches(
                existing,
                product=locked_product,
                origin_location=origin,
                destination_location=destination,
                quantity=quantity,
                reason=reason,
                evidence_reference=evidence_reference,
            ):
                raise ValidationError(
                    {
                        "idempotency_key": (
                            "Esta clave ya fue utilizada por una transferencia "
                            "con datos diferentes."
                        )
                    }
                )
            return existing, False

        transfer = InventoryTransfer(
            product=locked_product,
            origin_location=origin,
            destination_location=destination,
            quantity=quantity,
            responsible=user,
            reason=reason,
            evidence_reference=evidence_reference,
            idempotency_key=idempotency_key,
            created_by=user,
            updated_by=user,
        )
        try:
            with transaction.atomic():
                transfer.save()
        except (IntegrityError, ValidationError) as error:
            existing = (
                InventoryTransfer.objects.select_related(
                    "product",
                    "origin_location",
                    "destination_location",
                )
                .filter(idempotency_key=idempotency_key)
                .first()
            )
            if existing and _transfer_payload_matches(
                existing,
                product=locked_product,
                origin_location=origin,
                destination_location=destination,
                quantity=quantity,
                reason=reason,
                evidence_reference=evidence_reference,
            ):
                return existing, False
            raise error

        assert_product_location_total(locked_product)
        apply_location_balance_delta(
            product=locked_product,
            location=origin,
            delta=-quantity,
        )
        apply_location_balance_delta(
            product=locked_product,
            location=destination,
            delta=quantity,
        )
        assert_product_location_total(locked_product)

        create_business_audit_log(
            instance=transfer,
            action=AuditAction.TRASLADAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=reason,
            metadata={
                "operation": "inventory_transfer",
                "product_id": locked_product.pk,
                "product_model": locked_product.modelo,
                "product_sap_code": locked_product.codigo_sap,
                "product_category": locked_product.categoria.name,
                "origin_location_id": origin.pk,
                "origin_location_name": origin.name,
                "destination_location_id": destination.pk,
                "destination_location_name": destination.name,
                "quantity": quantity,
                "evidence_reference": evidence_reference,
                "idempotency_key": idempotency_key,
                "stock_total_unchanged": locked_product.stock_actual,
            },
            request=request,
        )

    return transfer, True


def archive_inventory_location(*, location, reason, user=None, request=None):
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "El motivo es obligatorio."})

    with transaction.atomic():
        locked_location = InventoryLocation.objects.select_for_update().get(
            pk=location.pk
        )

        if locked_location.is_regularization:
            raise ValidationError(
                {
                    "location": (
                        "La ubicación histórica de regularización no puede "
                        "archivarse."
                    )
                }
            )
        if locked_location.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {"location": "Sólo se puede archivar una ubicación activa."}
            )
        if locked_location.product_balances.filter(quantity__gt=0).exists():
            raise ValidationError(
                {
                    "location": (
                        "Debe trasladar todo el stock antes de archivar la "
                        "ubicación."
                    )
                }
            )
        if PendientePorRecibir.objects.filter(
            destination_location=locked_location,
            estado__in=ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
        ).exists():
            raise ValidationError(
                {
                    "location": (
                        "La ubicación tiene recepciones pendientes y no puede "
                        "archivarse."
                    )
                }
            )

        locked_location.status = BaseStatus.ARCHIVADO
        locked_location.updated_by = user
        locked_location.save(
            update_fields=["status", "updated_by", "updated_at"]
        )
        create_business_audit_log(
            instance=locked_location,
            action=AuditAction.ARCHIVAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=reason,
            metadata={
                "operation": "inventory_location_archive",
                "location_name": locked_location.name,
                "location_type": locked_location.location_type,
            },
            request=request,
        )

    return locked_location
