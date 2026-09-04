from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.core.models import AuditOrigin, BaseStatus
from apps.inventory.models import (
    Categoria,
    InventoryLocation,
    InventoryLocationType,
    PendientePorRecibir,
    Producto,
)

from .models import (
    PurchaseOperationType,
    PurchaseOrderOperation,
    PurchaseOrderStatus,
    PurchaseReceiptCommitment,
    Supplier,
)
from .services import (
    approve_purchase_order,
    cancel_purchase_remainders,
    close_purchase_order,
    create_purchase_order,
    issue_purchase_order,
    receive_purchase_commitment,
    submit_for_review,
)


class PurchaseFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="compras",
            email="compras@example.invalid",
            role=UserRole.FINANZAS_COMERCIAL,
        )
        self.supplier = Supplier.objects.create(
            legal_name="Proveedor Industrial SpA",
            trade_name="Proveedor Industrial",
            tax_id="76.123.456-7",
            created_by=self.user,
            updated_by=self.user,
        )
        self.category = Categoria.objects.create(
            name="Eléctrico", created_by=self.user, updated_by=self.user
        )
        self.location = InventoryLocation.objects.create(
            name="Bodega principal",
            location_type=InventoryLocationType.BODEGA,
            created_by=self.user,
            updated_by=self.user,
        )
        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Alternador 24V",
            codigo_sap="SAP-ALT-24",
            stock_actual=0,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def create_order(self, *, key="create-oc-1", product=None, number="OC-1001"):
        selected_product = self.product if product is None else product
        destination = self.location if selected_product.controla_stock else None
        return create_purchase_order(
            data={
                "number": number,
                "supplier": self.supplier,
                "order_date": date(2026, 7, 24),
                "currency": "CLP",
                "exchange_rate": Decimal("1"),
                "responsible": self.user,
            },
            lines=[{
                "product": selected_product,
                "quantity": 10,
                "unit_price_original": Decimal("100"),
                "tax_rate": Decimal("19"),
                "destination_location": destination,
            }],
            idempotency_key=key,
            user=self.user,
        )

    def issue(self, order):
        submit_for_review(
            order=order, idempotency_key=f"submit-{order.pk}",
            user=self.user, reason="Revisión requerida",
        )
        approve_purchase_order(
            order=order, idempotency_key=f"approve-{order.pk}",
            user=self.user, reason="Compra aprobada",
        )
        return issue_purchase_order(
            order=order, idempotency_key=f"issue-{order.pk}",
            user=self.user, reason="Orden emitida",
        )

    def test_full_receipt_changes_stock_only_when_physically_received(self):
        order = self.create_order()
        self.assertEqual(order.total_original, Decimal("1190.00"))
        self.assertEqual(order.total_clp, Decimal("1190.00"))
        order = self.issue(order)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_actual, 0)
        self.assertEqual(PendientePorRecibir.objects.count(), 1)
        commitment = PurchaseReceiptCommitment.objects.get()
        self.assertEqual(
            commitment.pending_receipt.operations.count(),
            0,
        )
        self.assertEqual(
            commitment.pending_receipt.creation_idempotency_key.startswith("purchases:issue:"),
            True,
        )

        order, _ = receive_purchase_commitment(
            commitment=commitment,
            quantity=4,
            reason="Recepción física parcial",
            idempotency_key="receive-1",
            user=self.user,
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_actual, 4)
        self.assertEqual(order.state, PurchaseOrderStatus.PARCIALMENTE_RECIBIDA)

        replay, _ = receive_purchase_commitment(
            commitment=commitment,
            quantity=4,
            reason="Recepción física parcial",
            idempotency_key="receive-1",
            user=self.user,
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_actual, 4)
        self.assertEqual(replay.pk, order.pk)

        order, _ = receive_purchase_commitment(
            commitment=commitment,
            quantity=6,
            reason="Recepción física final",
            idempotency_key="receive-2",
            user=self.user,
        )
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_actual, 10)
        self.assertEqual(order.state, PurchaseOrderStatus.RECIBIDA)
        closed = close_purchase_order(
            order=order, reason="Compra conciliada",
            idempotency_key="close-1", user=self.user,
        )
        self.assertEqual(closed.state, PurchaseOrderStatus.CERRADA)

    def test_create_is_idempotent_and_payload_changes_are_rejected(self):
        first = self.create_order(key="same-create")
        second = self.create_order(key="same-create")
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(PurchaseOrderOperation.objects.filter(
            operation_type=PurchaseOperationType.CREATE
        ).count(), 1)
        with self.assertRaises(ValidationError):
            create_purchase_order(
                data={
                    "number": "OC-1001",
                    "supplier": self.supplier,
                    "order_date": date(2026, 7, 24),
                    "expected_date": date(2026, 8, 30),
                    "currency": "CLP",
                    "exchange_rate": Decimal("1"),
                    "responsible": self.user,
                },
                lines=[{
                    "product": self.product,
                    "quantity": 10,
                    "unit_price_original": Decimal("100"),
                    "tax_rate": Decimal("19"),
                    "destination_location": self.location,
                }],
                idempotency_key="same-create",
                user=self.user,
            )

    def test_partial_receipt_with_cancelled_remainder_is_not_labeled_received(self):
        order = self.issue(self.create_order(number="OC-1002", key="create-2"))
        commitment = PurchaseReceiptCommitment.objects.get(order_line__order=order)
        order, _ = receive_purchase_commitment(
            commitment=commitment, quantity=3, reason="Recepción parcial",
            idempotency_key="partial-receive", user=self.user,
        )
        order = cancel_purchase_remainders(
            order=order, reason="Proveedor no despachará el saldo",
            idempotency_key="cancel-balance", user=self.user,
        )
        self.assertEqual(order.state, PurchaseOrderStatus.PARCIALMENTE_RECIBIDA)
        commitment.pending_receipt.refresh_from_db()
        self.assertEqual(commitment.pending_receipt.cantidad_pendiente, 0)
        closed = close_purchase_order(
            order=order, reason="Saldo cancelado y conciliado",
            idempotency_key="close-partial", user=self.user,
        )
        self.assertEqual(closed.state, PurchaseOrderStatus.CERRADA)

    def test_non_inventory_product_never_creates_pending_or_kardex(self):
        license_product = Producto.objects.create(
            categoria=self.category,
            modelo="Licencia anual",
            codigo_sap="SAP-LIC-1",
            controla_stock=False,
            created_by=self.user,
            updated_by=self.user,
        )
        order = self.create_order(
            key="create-license", number="OC-LIC-1", product=license_product
        )
        line = order.lines.get()
        self.assertFalse(line.controls_inventory_snapshot)
        order = self.issue(order)
        self.assertFalse(PurchaseReceiptCommitment.objects.filter(order_line=line).exists())
        closed = close_purchase_order(
            order=order, reason="Servicio conciliado",
            idempotency_key="close-license", user=self.user,
        )
        self.assertEqual(closed.state, PurchaseOrderStatus.CERRADA)
        license_product.refresh_from_db()
        self.assertEqual(license_product.stock_actual, 0)

    def test_inactive_supplier_or_responsible_blocks_progress(self):
        order = self.create_order(number="OC-1003", key="create-3")
        self.supplier.mark_inactive(self.user)
        with self.assertRaises(ValidationError):
            submit_for_review(
                order=order, idempotency_key="submit-inactive-supplier",
                user=self.user, reason="Intento",
            )
        self.supplier.status = BaseStatus.ACTIVO
        self.supplier.save()
        self.user.status = BaseStatus.INACTIVO
        self.user.save(update_fields=["status"])
        with self.assertRaises(ValidationError):
            submit_for_review(
                order=order, idempotency_key="submit-inactive-user",
                user=self.user, reason="Intento",
            )


class PurchasePermissionTests(TestCase):
    def setUp(self):
        self.finance = User.objects.create_user(
            username="finanzas", email="finanzas@example.invalid",
            role=UserRole.FINANZAS_COMERCIAL,
        )
        self.operator = User.objects.create_user(
            username="operativo", email="operativo@example.invalid",
            role=UserRole.OPERATIVO,
        )
        self.it_user = User.objects.create_user(
            username="informatica", email="informatica@example.invalid",
            role=UserRole.INFORMATICO,
        )
        self.client = APIClient()

    def test_informatics_has_no_purchase_access_under_central_policy(self):
        self.client.force_authenticate(self.it_user)
        self.assertEqual(self.client.get("/api/purchases/proveedores/").status_code, 403)
        response = self.client.post(
            "/api/purchases/proveedores/",
            {"legal_name": "Proveedor", "tax_id": "76.999.999-1"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_finance_can_create_supplier_but_operator_cannot(self):
        payload = {"legal_name": "Proveedor", "tax_id": "76.999.999-1"}
        self.client.force_authenticate(self.operator)
        self.assertEqual(
            self.client.post("/api/purchases/proveedores/", payload, format="json").status_code,
            403,
        )
        self.client.force_authenticate(self.finance)
        self.assertEqual(
            self.client.post("/api/purchases/proveedores/", payload, format="json").status_code,
            201,
        )
