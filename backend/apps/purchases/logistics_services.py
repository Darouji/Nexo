from decimal import Decimal, ROUND_HALF_UP
from difflib import SequenceMatcher

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.audit import create_business_audit_log
from apps.core.models import AuditAction, AuditOrigin, BaseStatus
from apps.core.utils import normalize_text

from .logistics_models import (
    Carrier,
    PurchaseShipment,
    ShipmentCharge,
    ShipmentEvent,
    ShipmentEventType,
    ShipmentStatus,
)
from .models import PurchaseCurrency, PurchaseOrderStatus

MONEY = Decimal("0.01")


def _money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _require_idempotency_key(value):
    key = str(value or "").strip()
    if not key:
        raise ValidationError({"idempotency_key": "La clave de idempotencia es obligatoria."})
    return key[:100]


def find_carrier_suggestions(name, *, limit=5):
    normalized = normalize_text(name)
    if not normalized:
        return []
    candidates = Carrier.objects.filter(status=BaseStatus.ACTIVO).only(
        "id", "name", "name_normalized", "aliases"
    )
    scored = []
    for carrier in candidates:
        normalized_aliases = [normalize_text(alias) for alias in (carrier.aliases or [])]
        values = [carrier.name_normalized, *normalized_aliases]
        score = max(
            SequenceMatcher(None, normalized, candidate).ratio()
            for candidate in values
            if candidate
        )
        if score >= 0.62 or normalized in carrier.name_normalized:
            scored.append((score, carrier))
    scored.sort(key=lambda item: (-item[0], item[1].name))
    return [carrier for _, carrier in scored[:limit]]


@transaction.atomic
def resolve_or_create_carrier(*, name, user, defaults=None, request=None):
    normalized = normalize_text(name)
    if not normalized:
        raise ValidationError({"name": "Escriba la empresa transportista."})
    existing = Carrier.objects.select_for_update().filter(
        name_normalized=normalized
    ).first()
    if existing:
        if existing.status != BaseStatus.ACTIVO:
            existing.status = BaseStatus.ACTIVO
            existing.updated_by = user
            existing.save(update_fields=["status", "updated_by", "updated_at"])
        return existing, False

    values = dict(defaults or {})
    values["name"] = str(name).strip()
    values["created_by"] = user
    values["updated_by"] = user
    carrier = Carrier(**values)
    try:
        carrier.save()
    except IntegrityError:
        return Carrier.objects.get(name_normalized=normalized), False
    create_business_audit_log(
        instance=carrier,
        action=AuditAction.CREAR,
        user=user,
        origin=AuditOrigin.API,
        reason="Creación rápida de empresa transportista.",
        request=request,
    )
    return carrier, True


def _customs_defaults(order, data):
    threshold = Decimal(
        str(getattr(settings, "PURCHASE_CUSTOMS_ALERT_THRESHOLD_USD", "5000"))
    )
    expected = bool(data.get("customs_review_expected"))
    reason = str(data.get("customs_review_reason") or "").strip()
    if (
        not expected
        and order.currency == PurchaseCurrency.USD
        and order.total_original > threshold
    ):
        expected = True
        reason = (
            f"Supera el umbral operativo interno de USD {threshold:,.0f} "
            "informado por NEXO; confirmar gestión con courier o agente de aduanas."
        )
    return expected, reason


@transaction.atomic
def create_purchase_shipment(*, data, idempotency_key, user, request=None):
    key = _require_idempotency_key(idempotency_key)
    existing = PurchaseShipment.objects.select_related("order", "carrier").filter(
        creation_idempotency_key=key
    ).first()
    if existing:
        return existing

    order = data["order"]
    if order.state in {
        PurchaseOrderStatus.BORRADOR,
        PurchaseOrderStatus.EN_REVISION,
        PurchaseOrderStatus.CANCELADA,
        PurchaseOrderStatus.CERRADA,
    }:
        raise ValidationError({
            "order": "La orden debe estar aprobada o emitida para registrar un envío."
        })
    carrier = data["carrier"]
    if carrier.status != BaseStatus.ACTIVO:
        raise ValidationError({"carrier": "La empresa transportista debe estar activa."})

    expected, reason = _customs_defaults(order, data)
    values = dict(data)
    values["customs_review_expected"] = expected
    values["customs_review_reason"] = reason
    values["responsible"] = values.get("responsible") or user
    shipment = PurchaseShipment(
        **values,
        creation_idempotency_key=key,
        created_by=user,
        updated_by=user,
    )
    shipment.save()
    ShipmentEvent.objects.create(
        shipment=shipment,
        idempotency_key=f"{key}:created"[:100],
        event_type=ShipmentEventType.ACTUALIZACION,
        title="Envío registrado",
        description="Se creó el seguimiento logístico del pedido.",
        occurred_at=timezone.now(),
        new_state=shipment.state,
        new_custodian=shipment.current_custodian,
        updated_eta=shipment.effective_eta,
        responsible=user,
        created_by=user,
        updated_by=user,
    )
    create_business_audit_log(
        instance=shipment,
        action=AuditAction.CREAR,
        user=user,
        origin=AuditOrigin.API,
        reason="Creación de seguimiento logístico.",
        metadata={
            "order_id": order.pk,
            "carrier_id": carrier.pk,
            "tracking_number": shipment.tracking_number,
            "customs_review_expected": shipment.customs_review_expected,
        },
        request=request,
    )
    return shipment


@transaction.atomic
def register_shipment_event(*, shipment, data, idempotency_key, user, request=None):
    key = _require_idempotency_key(idempotency_key)
    existing = ShipmentEvent.objects.filter(idempotency_key=key).first()
    if existing:
        if existing.shipment_id != shipment.pk:
            raise ValidationError({
                "idempotency_key": "La clave ya fue utilizada para otro envío."
            })
        return existing

    locked = PurchaseShipment.objects.select_for_update().get(pk=shipment.pk)
    event = ShipmentEvent(
        **data,
        shipment=locked,
        idempotency_key=key,
        responsible=user,
        created_by=user,
        updated_by=user,
    )
    event.save()
    update_fields = ["updated_by", "updated_at"]
    if event.new_state:
        locked.state = event.new_state
        update_fields.append("state")
    if event.new_custodian:
        locked.current_custodian = event.new_custodian
        update_fields.append("current_custodian")
    if event.updated_eta:
        locked.current_eta = event.updated_eta
        update_fields.append("current_eta")
    if event.new_state == ShipmentStatus.ENTREGADO and not locked.actual_arrival_date:
        locked.actual_arrival_date = event.occurred_at.date()
        update_fields.append("actual_arrival_date")
    locked.updated_by = user
    locked.save(update_fields=update_fields)
    create_business_audit_log(
        instance=locked,
        action=AuditAction.CAMBIAR_ESTADO,
        user=user,
        origin=AuditOrigin.API,
        reason=event.description or event.title,
        metadata={
            "shipment_event_id": event.pk,
            "event_type": event.event_type,
            "new_state": event.new_state,
            "new_custodian": event.new_custodian,
            "updated_eta": str(event.updated_eta or ""),
        },
        request=request,
    )
    return event


@transaction.atomic
def register_shipment_charge(*, shipment, data, idempotency_key, user, request=None):
    key = _require_idempotency_key(idempotency_key)
    existing = ShipmentCharge.objects.filter(idempotency_key=key).first()
    if existing:
        if existing.shipment_id != shipment.pk:
            raise ValidationError({
                "idempotency_key": "La clave ya fue utilizada para otro envío."
            })
        return existing

    locked = PurchaseShipment.objects.select_for_update().get(pk=shipment.pk)
    values = dict(data)
    values["responsible"] = user
    if values.get("currency") == "CLP":
        values["exchange_rate"] = Decimal("1")
        values["exchange_rate_date"] = None
        values["exchange_rate_source"] = ""
    charge = ShipmentCharge(
        **values,
        shipment=locked,
        idempotency_key=key,
        created_by=user,
        updated_by=user,
    )
    charge.save()
    create_business_audit_log(
        instance=locked,
        action=AuditAction.CREAR,
        user=user,
        origin=AuditOrigin.API,
        reason=charge.reason,
        metadata={
            "shipment_charge_id": charge.pk,
            "charge_type": charge.charge_type,
            "charge_status": charge.charge_status,
            "amount_original": str(charge.amount_original),
            "currency": charge.currency,
            "amount_clp": str(_money(charge.amount_clp)),
        },
        request=request,
    )
    return charge
