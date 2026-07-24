from hashlib import sha256
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F, Sum

from apps.core.audit import create_business_audit_log
from apps.core.models import AuditAction, AuditOrigin, BaseStatus
from apps.inventory.models import InventoryLocation, Producto
from apps.inventory.services import (
    cancel_pending_receipt,
    create_pending_receipt,
    receive_pending_receipt,
)

from .models import (
    CostAllocation,
    CostQuality,
    LandedCost,
    PurchaseCurrency,
    PurchaseOperationType,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderOperation,
    PurchaseOrderStatus,
    PurchaseReceiptCommitment,
)

MONEY = Decimal("0.01")


def _derived_key(scope, root_key, *parts):
    raw = "|".join([str(scope), str(root_key), *(str(part) for part in parts)])
    return f"purchases:{scope}:{sha256(raw.encode('utf-8')).hexdigest()}"


def _money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _require_user(user):
    if user is None or not getattr(user, "is_authenticated", False):
        raise ValidationError({"responsible": "La operación requiere un usuario responsable."})
    return user


def _validate_order_actors(order):
    if order.supplier.status != BaseStatus.ACTIVO:
        raise ValidationError({"supplier": "El proveedor debe estar activo."})
    if (
        not order.responsible.is_active
        or getattr(order.responsible, "status", BaseStatus.ACTIVO) != BaseStatus.ACTIVO
    ):
        raise ValidationError({"responsible": "El responsable debe ser un usuario activo."})


def _get_operation(*, idempotency_key, order, operation_type, payload=None, lock=False):
    key = str(idempotency_key or "").strip()
    if not key:
        raise ValidationError({"idempotency_key": "La clave de idempotencia es obligatoria."})
    queryset = PurchaseOrderOperation.objects
    if lock:
        queryset = queryset.select_for_update()
    operation = queryset.filter(idempotency_key=key).first()
    if operation is None:
        return None
    if operation.order_id != order.pk or operation.operation_type != operation_type:
        raise ValidationError({
            "idempotency_key": "La clave de idempotencia ya fue utilizada para otra operación."
        })
    if payload is not None and operation.payload != payload:
        raise ValidationError({
            "idempotency_key": "La clave de idempotencia ya fue utilizada con datos diferentes."
        })
    return operation


def _record_operation(
    *, order, operation_type, idempotency_key, user, previous_state,
    new_state, reason="", payload=None, request=None, audit_action=AuditAction.CAMBIAR_ESTADO,
):
    operation = PurchaseOrderOperation.objects.create(
        order=order,
        operation_type=operation_type,
        idempotency_key=str(idempotency_key).strip(),
        previous_state=previous_state,
        new_state=new_state,
        reason=str(reason or "").strip(),
        payload=payload or {},
        responsible=user,
        created_by=user,
        updated_by=user,
    )
    create_business_audit_log(
        instance=order,
        action=audit_action,
        user=user,
        origin=AuditOrigin.API,
        reason=reason,
        metadata={
            "operation": operation_type,
            "operation_record_id": operation.pk,
            "idempotency_key": operation.idempotency_key,
            "previous_status": previous_state,
            "new_status": new_state,
            **(payload or {}),
        },
        request=request,
    )
    return operation


def _line_values(*, line_data, order):
    product = line_data.get("product")
    destination = line_data.get("destination_location")
    if product:
        product = Producto.objects.select_related("categoria").get(pk=product.pk)
        if product.status != BaseStatus.ACTIVO or product.descontinuado:
            raise ValidationError({"product": "El producto debe estar activo y no descontinuado."})
        if product.controla_stock and not destination:
            raise ValidationError({
                "destination_location": "El producto inventariable requiere una ubicación de destino."
            })
        if not product.controla_stock:
            destination = None
    if destination:
        destination = InventoryLocation.objects.get(pk=destination.pk)
        if destination.status != BaseStatus.ACTIVO:
            raise ValidationError({"destination_location": "La ubicación de destino debe estar activa."})

    quantity = int(line_data.get("quantity") or 0)
    price = _money(line_data.get("unit_price_original"))
    tax_rate = Decimal(str(line_data.get("tax_rate") or 0))
    if quantity <= 0:
        raise ValidationError({"quantity": "La cantidad debe ser un entero positivo."})
    if price < 0 or tax_rate < 0:
        raise ValidationError({"unit_price_original": "Precio e impuesto no pueden ser negativos."})
    subtotal = _money(price * quantity)
    tax_total = _money(subtotal * tax_rate / Decimal("100"))
    total = subtotal + tax_total
    model_snapshot = str(line_data.get("product_model_snapshot") or "").strip()
    sap_snapshot = str(line_data.get("product_sap_snapshot") or "").strip()
    category_snapshot = str(line_data.get("product_category_snapshot") or "").strip()
    if product:
        model_snapshot = product.modelo
        sap_snapshot = product.codigo_sap
        category_snapshot = product.categoria.name
    description = str(line_data.get("description") or "").strip()
    if not product and not description:
        raise ValidationError({"description": "Una línea no inventariable requiere descripción."})
    if not model_snapshot:
        model_snapshot = description
    return {
        "order": order,
        "product": product,
        "controls_inventory_snapshot": bool(product and product.controla_stock),
        "product_model_snapshot": model_snapshot,
        "product_sap_snapshot": sap_snapshot,
        "product_category_snapshot": category_snapshot,
        "description": description,
        "quantity": quantity,
        "unit_price_original": price,
        "tax_rate": tax_rate,
        "subtotal_original": subtotal,
        "tax_total_original": tax_total,
        "total_original": total,
        "total_clp": _money(total * order.exchange_rate),
        "destination_location": destination,
    }


def _recalculate_order(order):
    totals = order.lines.aggregate(
        subtotal=Sum("subtotal_original"),
        tax=Sum("tax_total_original"),
        total=Sum("total_original"),
        total_clp=Sum("total_clp"),
    )
    order.subtotal_original = _money(totals["subtotal"])
    order.tax_total_original = _money(totals["tax"])
    order.total_original = _money(totals["total"])
    order.total_clp = _money(totals["total_clp"])
    order.save(update_fields=[
        "subtotal_original", "tax_total_original", "total_original",
        "total_clp", "updated_at",
    ])
    return order


def _create_payload(data, lines):
    return {
        "number": str(data.get("number") or "").strip().upper(),
        "supplier_id": data["supplier"].pk,
        "order_date": str(data.get("order_date") or ""),
        "expected_date": str(data.get("expected_date") or ""),
        "exchange_rate": str(data.get("exchange_rate") or 1),
        "exchange_rate_date": str(data.get("exchange_rate_date") or ""),
        "exchange_rate_source": str(data.get("exchange_rate_source") or "").strip(),
        "responsible_id": data.get("responsible").pk if data.get("responsible") else None,
        "notes": str(data.get("notes") or "").strip(),
        "currency": str(data.get("currency") or PurchaseCurrency.CLP),
        "lines": [
            {
                "product_id": item.get("product").pk if item.get("product") else None,
                "destination_location_id": (
                    item.get("destination_location").pk
                    if item.get("destination_location")
                    else None
                ),
                "product_model_snapshot": str(item.get("product_model_snapshot") or "").strip(),
                "product_sap_snapshot": str(item.get("product_sap_snapshot") or "").strip(),
                "product_category_snapshot": str(item.get("product_category_snapshot") or "").strip(),
                "description": str(item.get("description") or "").strip(),
                "quantity": int(item.get("quantity") or 0),
                "unit_price_original": str(item.get("unit_price_original") or 0),
                "tax_rate": str(item.get("tax_rate") or 0),
            }
            for item in lines
        ],
    }


def _find_create_operation(idempotency_key, payload):
    key = str(idempotency_key or "").strip()
    if not key:
        raise ValidationError({"idempotency_key": "La clave de idempotencia es obligatoria."})
    operation = PurchaseOrderOperation.objects.select_related("order").filter(
        idempotency_key=key
    ).first()
    if operation is None:
        return None
    if operation.operation_type != PurchaseOperationType.CREATE or operation.payload != payload:
        raise ValidationError({
            "idempotency_key": "La clave de idempotencia ya fue utilizada con datos diferentes."
        })
    return operation


def create_purchase_order(*, data, lines, idempotency_key, user, request=None):
    user = _require_user(user)
    if not lines:
        raise ValidationError({"lines": "La orden debe contener al menos una línea."})
    payload = _create_payload(data, lines)
    payload["responsible_id"] = payload["responsible_id"] or user.pk
    existing = _find_create_operation(idempotency_key, payload)
    if existing:
        return existing.order
    supplier = data["supplier"]
    if supplier.status != BaseStatus.ACTIVO:
        raise ValidationError({"supplier": "El proveedor debe estar activo."})
    try:
        with transaction.atomic():
            existing = _find_create_operation(idempotency_key, payload)
            if existing:
                return existing.order
            order_data = dict(data)
            order_data["responsible"] = order_data.get("responsible") or user
            order = PurchaseOrder(
                **order_data,
                state=PurchaseOrderStatus.BORRADOR,
                created_by=user,
                updated_by=user,
            )
            order.full_clean()
            _validate_order_actors(order)
            order.save()
            for line_data in lines:
                line = PurchaseOrderLine(**_line_values(line_data=line_data, order=order))
                line.created_by = user
                line.updated_by = user
                line.full_clean()
                line.save()
            _recalculate_order(order)
            _record_operation(
                order=order, operation_type=PurchaseOperationType.CREATE,
                idempotency_key=idempotency_key, user=user,
                previous_state="", new_state=order.state,
                reason="Creación de orden de compra en borrador.",
                payload=payload, request=request, audit_action=AuditAction.CREAR,
            )
            return order
    except IntegrityError:
        existing = _find_create_operation(idempotency_key, payload)
        if existing:
            return existing.order
        if PurchaseOrder.objects.filter(number=payload["number"]).exists():
            raise ValidationError({"number": "Ya existe una orden con ese número."})
        raise


@transaction.atomic
def edit_purchase_order(*, order, data, lines=None, user, request=None):
    user = _require_user(user)
    locked = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if locked.state != PurchaseOrderStatus.BORRADOR:
        raise ValidationError({"state": "Solo se puede editar una orden en borrador."})
    for field in (
        "number", "supplier", "order_date", "expected_date", "currency",
        "exchange_rate", "exchange_rate_date", "exchange_rate_source",
        "responsible", "notes",
    ):
        if field in data:
            setattr(locked, field, data[field])
    locked.updated_by = user
    locked.full_clean()
    _validate_order_actors(locked)
    locked.save()
    if lines is not None:
        if not lines:
            raise ValidationError({"lines": "La orden debe contener al menos una línea."})
        if locked.lines.filter(receipt_commitments__isnull=False).exists():
            raise ValidationError({"lines": "No se pueden reemplazar líneas con recepciones comprometidas."})
        locked.lines.all().delete()
        for line_data in lines:
            line = PurchaseOrderLine(**_line_values(line_data=line_data, order=locked))
            line.created_by = user
            line.updated_by = user
            line.full_clean()
            line.save()
    _recalculate_order(locked)
    create_business_audit_log(
        instance=locked,
        action=AuditAction.EDITAR,
        user=user,
        reason="Edición de orden de compra en borrador.",
        metadata={"operation": "purchase_order_edit"},
        request=request,
    )
    return locked


def _transition(*, order, expected_states, new_state, operation_type, idempotency_key, user, reason, request):
    user = _require_user(user)
    payload = {"reason": str(reason or "").strip()}
    existing = _get_operation(
        idempotency_key=idempotency_key, order=order,
        operation_type=operation_type, payload=payload,
    )
    if existing:
        return existing.order
    try:
        with transaction.atomic():
            locked = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
            existing = _get_operation(
                idempotency_key=idempotency_key, order=locked,
                operation_type=operation_type, payload=payload, lock=True,
            )
            if existing:
                return existing.order
            _validate_order_actors(locked)
            if locked.state not in expected_states:
                raise ValidationError({
                    "state": f"La orden no puede pasar de {locked.get_state_display()} a {PurchaseOrderStatus(new_state).label}."
                })
            previous = locked.state
            locked.state = new_state
            locked.updated_by = user
            locked.save(update_fields=["state", "updated_by", "updated_at"])
            _record_operation(
                order=locked, operation_type=operation_type,
                idempotency_key=idempotency_key, user=user,
                previous_state=previous, new_state=new_state,
                reason=reason, payload=payload, request=request,
            )
            return locked
    except IntegrityError:
        existing = _get_operation(
            idempotency_key=idempotency_key, order=order,
            operation_type=operation_type, payload=payload,
        )
        if existing:
            return existing.order
        raise


def submit_for_review(*, order, idempotency_key, user, reason="", request=None):
    return _transition(
        order=order, expected_states={PurchaseOrderStatus.BORRADOR},
        new_state=PurchaseOrderStatus.EN_REVISION,
        operation_type=PurchaseOperationType.SUBMIT,
        idempotency_key=idempotency_key, user=user, reason=reason, request=request,
    )


def approve_purchase_order(*, order, idempotency_key, user, reason="", request=None):
    return _transition(
        order=order, expected_states={PurchaseOrderStatus.EN_REVISION},
        new_state=PurchaseOrderStatus.APROBADA,
        operation_type=PurchaseOperationType.APPROVE,
        idempotency_key=idempotency_key, user=user, reason=reason, request=request,
    )


def issue_purchase_order(*, order, idempotency_key, user, reason="", request=None):
    user = _require_user(user)
    reason = str(reason or "").strip() or "Orden de compra emitida."
    payload = {"reason": reason}
    existing = _get_operation(
        idempotency_key=idempotency_key, order=order,
        operation_type=PurchaseOperationType.ISSUE, payload=payload,
    )
    if existing:
        return existing.order
    try:
        with transaction.atomic():
            locked = PurchaseOrder.objects.select_for_update().prefetch_related("lines").get(pk=order.pk)
            existing = _get_operation(
                idempotency_key=idempotency_key, order=locked,
                operation_type=PurchaseOperationType.ISSUE, payload=payload, lock=True,
            )
            if existing:
                return existing.order
            _validate_order_actors(locked)
            if locked.state != PurchaseOrderStatus.APROBADA:
                raise ValidationError({"state": "Solo se puede emitir una orden aprobada."})
            if not locked.lines.exists():
                raise ValidationError({"lines": "La orden debe contener líneas."})
            lines = locked.lines.select_related("product", "destination_location").order_by(
                "product_id", "destination_location_id", "id"
            )
            for line in lines:
                if not line.product_id or not line.controls_inventory_snapshot:
                    continue
                pending = create_pending_receipt(
                    producto=line.product,
                    cantidad=line.quantity,
                    motivo=f"Recepción asociada a la orden {locked.number}.",
                    referencia=locked.number,
                    destination_location=line.destination_location,
                    idempotency_key=_derived_key("issue", idempotency_key, "line", line.pk),
                    audit_origin=AuditOrigin.AUTOMATICO,
                    user=user,
                    request=request,
                )
                PurchaseReceiptCommitment.objects.create(
                    order_line=line,
                    pending_receipt=pending,
                    destination_location=line.destination_location,
                    committed_quantity=line.quantity,
                    created_by=user,
                    updated_by=user,
                )
            previous = locked.state
            locked.state = PurchaseOrderStatus.EMITIDA
            locked.updated_by = user
            locked.save(update_fields=["state", "updated_by", "updated_at"])
            _record_operation(
                order=locked, operation_type=PurchaseOperationType.ISSUE,
                idempotency_key=idempotency_key, user=user,
                previous_state=previous, new_state=locked.state,
                reason=reason, payload=payload, request=request,
            )
            return locked
    except IntegrityError:
        existing = _get_operation(
            idempotency_key=idempotency_key, order=order,
            operation_type=PurchaseOperationType.ISSUE, payload=payload,
        )
        if existing:
            return existing.order
        raise


def _refresh_receipt_state(order, user):
    commitments = list(
        PurchaseReceiptCommitment.objects.filter(order_line__order=order)
        .select_related("pending_receipt")
    )
    if not commitments:
        return order.state
    received = sum(item.pending_receipt.cantidad_recibida for item in commitments)
    pending = sum(item.pending_receipt.cantidad_pendiente for item in commitments)
    new_state = order.state
    if pending == 0:
        new_state = PurchaseOrderStatus.RECIBIDA
    elif received > 0:
        new_state = PurchaseOrderStatus.PARCIALMENTE_RECIBIDA
    elif order.state in {PurchaseOrderStatus.PARCIALMENTE_RECIBIDA, PurchaseOrderStatus.RECIBIDA}:
        new_state = PurchaseOrderStatus.EMITIDA
    if new_state != order.state:
        order.state = new_state
        order.updated_by = user
        order.save(update_fields=["state", "updated_by", "updated_at"])
    return new_state


def receive_purchase_commitment(
    *, commitment, quantity, reason, idempotency_key, user, request=None
):
    user = _require_user(user)
    payload = {"commitment_id": commitment.pk, "quantity": int(quantity), "reason": str(reason or "").strip()}
    order = commitment.order_line.order
    existing = _get_operation(
        idempotency_key=idempotency_key, order=order,
        operation_type=PurchaseOperationType.RECEIVE, payload=payload,
    )
    if existing:
        return existing.order, commitment
    try:
        with transaction.atomic():
            locked_order = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
            locked_commitment = (
                PurchaseReceiptCommitment.objects.select_for_update()
                .select_related("pending_receipt", "order_line")
                .get(pk=commitment.pk)
            )
            existing = _get_operation(
                idempotency_key=idempotency_key, order=locked_order,
                operation_type=PurchaseOperationType.RECEIVE, payload=payload, lock=True,
            )
            if existing:
                return existing.order, locked_commitment
            if locked_order.state not in {
                PurchaseOrderStatus.EMITIDA, PurchaseOrderStatus.PARCIALMENTE_RECIBIDA
            }:
                raise ValidationError({"state": "La orden no está disponible para recepción."})
            previous = locked_order.state
            receive_pending_receipt(
                pending_receipt=locked_commitment.pending_receipt,
                cantidad=int(quantity),
                motivo=reason,
                idempotency_key=_derived_key("receive", idempotency_key, "commitment", locked_commitment.pk),
                user=user,
                request=request,
            )
            locked_commitment.refresh_from_db()
            new_state = _refresh_receipt_state(locked_order, user)
            _record_operation(
                order=locked_order, operation_type=PurchaseOperationType.RECEIVE,
                idempotency_key=idempotency_key, user=user,
                previous_state=previous, new_state=new_state,
                reason=reason, payload=payload, request=request,
            )
            return locked_order, locked_commitment
    except IntegrityError:
        existing = _get_operation(
            idempotency_key=idempotency_key, order=order,
            operation_type=PurchaseOperationType.RECEIVE, payload=payload,
        )
        if existing:
            return existing.order, commitment
        raise


def cancel_purchase_remainders(*, order, reason, idempotency_key, user, request=None):
    user = _require_user(user)
    reason = str(reason or "").strip()
    if not reason:
        raise ValidationError({"reason": "El motivo de cancelación es obligatorio."})
    payload = {"reason": reason}
    existing = _get_operation(
        idempotency_key=idempotency_key, order=order,
        operation_type=PurchaseOperationType.CANCEL, payload=payload,
    )
    if existing:
        return existing.order
    with transaction.atomic():
        locked = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
        existing = _get_operation(
            idempotency_key=idempotency_key, order=locked,
            operation_type=PurchaseOperationType.CANCEL, payload=payload, lock=True,
        )
        if existing:
            return existing.order
        if locked.state in {PurchaseOrderStatus.CERRADA, PurchaseOrderStatus.CANCELADA}:
            raise ValidationError({"state": "La orden ya está cerrada o cancelada."})
        previous = locked.state
        commitments = PurchaseReceiptCommitment.objects.filter(
            order_line__order=locked
        ).select_related("pending_receipt").order_by(
            "order_line__product_id", "destination_location_id", "id"
        )
        received = 0
        if not any(item.pending_receipt.cantidad_pendiente for item in commitments):
            raise ValidationError({"receipts": "La orden no tiene remanentes pendientes para cancelar."})
        for item in commitments:
            received += item.pending_receipt.cantidad_recibida
            if item.pending_receipt.cantidad_pendiente:
                cancel_pending_receipt(
                    pending_receipt=item.pending_receipt,
                    cantidad=item.pending_receipt.cantidad_pendiente,
                    motivo=reason,
                    idempotency_key=_derived_key("cancel", idempotency_key, "commitment", item.pk),
                    user=user,
                    request=request,
                )
        locked.state = (
            PurchaseOrderStatus.PARCIALMENTE_RECIBIDA
            if received > 0
            else PurchaseOrderStatus.CANCELADA
        )
        locked.updated_by = user
        locked.save(update_fields=["state", "updated_by", "updated_at"])
        _record_operation(
            order=locked, operation_type=PurchaseOperationType.CANCEL,
            idempotency_key=idempotency_key, user=user,
            previous_state=previous, new_state=locked.state,
            reason=reason, payload=payload, request=request,
        )
        return locked


@transaction.atomic
def register_landed_cost(*, order, data, idempotency_key, user, request=None):
    user = _require_user(user)
    request_payload = {key: str(value or "") for key, value in data.items()}
    existing = PurchaseOrderOperation.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if (
            existing.order_id != order.pk
            or existing.operation_type != PurchaseOperationType.COST
            or existing.payload.get("request") != request_payload
        ):
            raise ValidationError({"idempotency_key": "La clave ya fue utilizada con datos diferentes."})
        return LandedCost.objects.get(pk=existing.payload["landed_cost_id"])
    locked = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    if locked.state in {PurchaseOrderStatus.BORRADOR, PurchaseOrderStatus.EN_REVISION, PurchaseOrderStatus.CANCELADA, PurchaseOrderStatus.CERRADA}:
        raise ValidationError({"state": "No se pueden registrar costos en el estado actual."})
    amount = _money(data["amount_original"])
    rate = Decimal(str(data.get("exchange_rate") or 1))
    if amount < 0 or rate <= 0:
        raise ValidationError({"amount_original": "El monto debe ser no negativo y el tipo de cambio positivo."})
    cost = LandedCost(
        order=locked, **data, amount_original=amount, exchange_rate=rate,
        amount_clp=_money(amount * rate), created_by=user, updated_by=user,
    )
    cost.full_clean()
    cost.save()
    _record_operation(
        order=locked, operation_type=PurchaseOperationType.COST,
        idempotency_key=idempotency_key, user=user,
        previous_state=locked.state, new_state=locked.state,
        reason="Registro de costo asociado a compra.",
        payload={"request": request_payload, "landed_cost_id": cost.pk},
        request=request, audit_action=AuditAction.EDITAR,
    )
    return cost


@transaction.atomic
def allocate_landed_cost(*, landed_cost, allocations, idempotency_key, user, request=None):
    user = _require_user(user)
    line_ids = [item["order_line"].pk for item in allocations]
    if len(line_ids) != len(set(line_ids)):
        raise ValidationError({"allocations": "No se puede repetir una línea en la misma asignación."})
    request_payload = {
        "landed_cost_id": landed_cost.pk,
        "allocations": sorted([
            {"line": item["order_line"].pk, "amount": str(item["amount_clp"]),
             "quality": str(item.get("quality") or CostQuality.CONFIRMED),
             "rationale": str(item.get("rationale") or "").strip()}
            for item in allocations
        ], key=lambda item: item["line"]),
    }
    existing = PurchaseOrderOperation.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        if (
            existing.order_id != landed_cost.order_id
            or existing.operation_type != PurchaseOperationType.ALLOCATE
            or existing.payload.get("request") != request_payload
        ):
            raise ValidationError({"idempotency_key": "La clave ya fue utilizada con datos diferentes."})
        return LandedCost.objects.get(pk=landed_cost.pk)
    cost = LandedCost.objects.select_for_update().select_related("order").get(pk=landed_cost.pk)
    if cost.order.state == PurchaseOrderStatus.CERRADA:
        raise ValidationError({"state": "Una orden cerrada no admite nuevas asignaciones."})
    total = sum((_money(item["amount_clp"]) for item in allocations), Decimal("0"))
    if total != cost.amount_clp:
        raise ValidationError({
            "allocations": f"Las asignaciones deben sumar exactamente {cost.amount_clp} CLP."
        })
    if PurchaseOrderLine.objects.filter(pk__in=line_ids).exclude(order=cost.order).exists():
        raise ValidationError({"allocations": "Todas las líneas deben pertenecer a la misma orden."})
    cost.allocations.all().delete()
    for item in allocations:
        CostAllocation.objects.create(
            landed_cost=cost,
            order_line=item["order_line"],
            amount_clp=_money(item["amount_clp"]),
            quality=item.get("quality", CostQuality.CONFIRMED),
            rationale=str(item.get("rationale") or "").strip(),
            created_by=user,
            updated_by=user,
        )
    cost.quality = CostQuality.CONFIRMED
    cost.updated_by = user
    cost.save(update_fields=["quality", "updated_by", "updated_at"])
    _record_operation(
        order=cost.order, operation_type=PurchaseOperationType.ALLOCATE,
        idempotency_key=idempotency_key, user=user,
        previous_state=cost.order.state, new_state=cost.order.state,
        reason="Asignación de costo asociado a compra.",
        payload={"request": request_payload}, request=request,
        audit_action=AuditAction.EDITAR,
    )
    return cost


def close_purchase_order(*, order, reason, idempotency_key, user, request=None):
    user = _require_user(user)
    reason = str(reason or "").strip()
    payload = {"reason": reason}
    existing = _get_operation(
        idempotency_key=idempotency_key, order=order,
        operation_type=PurchaseOperationType.CLOSE, payload=payload,
    )
    if existing:
        return existing.order
    with transaction.atomic():
        locked = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
        existing = _get_operation(
            idempotency_key=idempotency_key, order=locked,
            operation_type=PurchaseOperationType.CLOSE, payload=payload, lock=True,
        )
        if existing:
            return existing.order
        has_commitments = PurchaseReceiptCommitment.objects.filter(
            order_line__order=locked
        ).exists()
        valid_states = {PurchaseOrderStatus.RECIBIDA}
        valid_states.add(PurchaseOrderStatus.PARCIALMENTE_RECIBIDA)
        if not has_commitments:
            valid_states.add(PurchaseOrderStatus.EMITIDA)
        if locked.state not in valid_states:
            raise ValidationError({"state": "Solo se puede cerrar una orden completamente conciliada."})
        if PurchaseReceiptCommitment.objects.filter(
            order_line__order=locked,
            pending_receipt__cantidad_original__gt=(
                F("pending_receipt__cantidad_recibida")
                + F("pending_receipt__cantidad_cancelada")
            ),
        ).exists():
            raise ValidationError({"receipts": "Existen unidades pendientes por conciliar."})
        for cost in locked.landed_costs.all():
            allocated = cost.allocations.aggregate(total=Sum("amount_clp"))["total"] or Decimal("0")
            if cost.quality != CostQuality.CONFIRMED or _money(allocated) != cost.amount_clp:
                raise ValidationError({"costs": "Todos los costos deben estar confirmados y completamente asignados."})
        previous = locked.state
        locked.state = PurchaseOrderStatus.CERRADA
        locked.cost_quality = CostQuality.CONFIRMED
        locked.updated_by = user
        locked.save(update_fields=["state", "cost_quality", "updated_by", "updated_at"])
        _record_operation(
            order=locked, operation_type=PurchaseOperationType.CLOSE,
            idempotency_key=idempotency_key, user=user,
            previous_state=previous, new_state=locked.state,
            reason=reason, payload=payload, request=request,
        )
        return locked

