import json
from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.inventory.models import (
    Categoria,
    InventoryLocation,
    InventoryLocationType,
    MovimientoKardex,
    PendientePorRecibir,
    Producto,
)

from apps.inventory.services import create_pending_receipt

from .models import PurchaseReceiptCommitment, Supplier
from .services import (
    approve_purchase_order,
    create_purchase_order,
    issue_purchase_order,
    submit_for_review,
)


class PurchaseApiContractTests(TestCase):
    def setUp(self):
        self.finance = User.objects.create_user(
            username="finanzas_api",
            email="finanzas-api@example.invalid",
            role=UserRole.FINANZAS_COMERCIAL,
        )
        self.operator = User.objects.create_user(
            username="operativo_api",
            email="operativo-api@example.invalid",
            role=UserRole.OPERATIVO,
        )
        self.supplier = Supplier.objects.create(
            legal_name="=Proveedor con fórmula",
            tax_id="76.000.001-1",
            country="Chile",
            created_by=self.finance,
            updated_by=self.finance,
        )
        self.client = APIClient()

    def _issued_commitment(self):
        category = Categoria.objects.create(
            name="Compras API", created_by=self.finance, updated_by=self.finance
        )
        location = InventoryLocation.objects.create(
            name="Bodega API",
            location_type=InventoryLocationType.BODEGA,
            created_by=self.finance,
            updated_by=self.finance,
        )
        product = Producto.objects.create(
            categoria=category,
            modelo="Motor API",
            codigo_sap="SAP-API-1",
            controla_stock=True,
            created_by=self.finance,
            updated_by=self.finance,
        )
        order = create_purchase_order(
            data={
                "number": "OC-API-1",
                "supplier": self.supplier,
                "order_date": date(2026, 7, 24),
                "currency": "CLP",
                "exchange_rate": Decimal("1"),
                "responsible": self.finance,
            },
            lines=[{
                "product": product,
                "quantity": 2,
                "unit_price_original": Decimal("100"),
                "destination_location": location,
            }],
            idempotency_key="api-create-1",
            user=self.finance,
        )
        submit_for_review(
            order=order, idempotency_key="api-submit-1",
            user=self.finance, reason="Revisar",
        )
        approve_purchase_order(
            order=order, idempotency_key="api-approve-1",
            user=self.finance, reason="Aprobar",
        )
        issue_purchase_order(
            order=order, idempotency_key="api-issue-1",
            user=self.finance, reason="Emitir",
        )
        return PurchaseReceiptCommitment.objects.select_related(
            "order_line__product"
        ).get(), product

    def test_operator_can_receive_but_cannot_export_official(self):
        commitment, product = self._issued_commitment()
        self.client.force_authenticate(self.operator)
        response = self.client.post(
            f"/api/purchases/compromisos-recepcion/{commitment.pk}/recibir/",
            {"quantity": 2, "reason": "Recepción física"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-operator-receive",
        )
        self.assertEqual(response.status_code, 200, response.data)
        product.refresh_from_db()
        self.assertEqual(product.stock_actual, 2)
        response = self.client.get(
            "/api/purchases/proveedores/export/",
            {"mode": "official", "file_format": "csv"},
        )
        self.assertEqual(response.status_code, 403)

    def test_physical_receipts_lists_purchase_and_manual_origins(self):
        commitment, product = self._issued_commitment()
        manual = create_pending_receipt(
            producto=product,
            cantidad=3,
            motivo="Recepción manual esperada.",
            referencia="MANUAL-API-1",
            destination_location=commitment.destination_location,
            idempotency_key="api-manual-pending-1",
            user=self.finance,
        )
        self.client.force_authenticate(self.finance)
        response = self.client.get("/api/purchases/recepciones-fisicas/")
        self.assertEqual(response.status_code, 200, response.data)
        origins = {item["origin"] for item in response.data["results"]}
        self.assertEqual(origins, {"PURCHASE_ORDER", "MANUAL"})
        self.assertEqual(response.data["count"], 2)
        export_response = self.client.get(
            "/api/purchases/recepciones-fisicas/export/",
            {
                "mode": "view",
                "file_format": "csv",
                "columns": "producto__modelo_normalized,referencia",
            },
        )
        self.assertEqual(export_response.status_code, 200)
        cancel_response = self.client.post(
            f"/api/purchases/recepciones-fisicas/{manual.pk}/cancelar/",
            {"quantity": 1, "reason": "Ya no se espera esta unidad"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-unified-cancel-manual",
        )
        self.assertEqual(cancel_response.status_code, 200, cancel_response.data)
        manual.refresh_from_db()
        product.refresh_from_db()
        self.assertEqual(manual.cantidad_pendiente, 2)
        self.assertEqual(product.stock_actual, 0)
        history_response = self.client.get(
            f"/api/purchases/recepciones-fisicas/{manual.pk}/historial/"
        )
        self.assertEqual(history_response.status_code, 200, history_response.data)
        self.assertEqual(len(history_response.data), 1)

    def test_physical_receipt_updates_stock_kardex_and_purchase_order(self):
        commitment, product = self._issued_commitment()
        pending_id = commitment.pending_receipt_id
        self.client.force_authenticate(self.operator)
        response = self.client.post(
            f"/api/purchases/recepciones-fisicas/{pending_id}/recibir/",
            {"quantity": 2, "reason": "Recepción física unificada"},
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-unified-receive",
        )
        self.assertEqual(response.status_code, 200, response.data)
        product.refresh_from_db()
        commitment.order_line.order.refresh_from_db()
        self.assertEqual(product.stock_actual, 2)
        self.assertEqual(commitment.order_line.order.state, "RECIBIDA")
        self.assertEqual(MovimientoKardex.objects.filter(producto=product).count(), 1)
        self.assertEqual(
            PendientePorRecibir.objects.get(pk=pending_id).cantidad_pendiente,
            0,
        )
    def test_exports_are_filtered_safe_and_reject_empty_results(self):
        self.client.force_authenticate(self.finance)
        response = self.client.get(
            "/api/purchases/proveedores/export/",
            {"mode": "official", "file_format": "csv"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("'=Proveedor con fórmula", response.content.decode("utf-8-sig"))

        response = self.client.get(
            "/api/purchases/proveedores/export/",
            {
                "mode": "view",
                "file_format": "csv",
                "grid_filters": json.dumps([{
                    "field": "legal_name",
                    "operator": "equals",
                    "value": "No existe",
                }]),
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_order_creation_requires_idempotency_header(self):
        self.client.force_authenticate(self.finance)
        response = self.client.post(
            "/api/purchases/ordenes/",
            {
                "number": "OC-SIN-KEY",
                "supplier": self.supplier.pk,
                "order_date": "2026-07-24",
                "currency": "CLP",
                "exchange_rate": "1",
                "lines": [{
                    "description": "Servicio sin inventario",
                    "quantity": 1,
                    "unit_price_original": "100",
                }],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("idempotency_key", response.data["error"]["details"])

    def test_order_number_is_generated_when_omitted(self):
        self.client.force_authenticate(self.finance)
        response = self.client.post(
            "/api/purchases/ordenes/",
            {
                "supplier": self.supplier.pk,
                "order_date": "2026-07-24",
                "currency": "CLP",
                "exchange_rate": "1",
                "lines": [{
                    "description": "Servicio con número automático",
                    "quantity": 1,
                    "unit_price_original": "100",
                }],
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-auto-number",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertRegex(response.data["number"], r"^OC-\d{4}-\d{5}$")
