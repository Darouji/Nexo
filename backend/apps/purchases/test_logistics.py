from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole

from .logistics_models import (
    ShipmentCharge,
    ShipmentCustodian,
    ShipmentEvent,
    ShipmentEventType,
    ShipmentStatus,
)
from .logistics_services import (
    create_purchase_shipment,
    register_shipment_charge,
    register_shipment_event,
    resolve_or_create_carrier,
)
from .models import Supplier
from .services import (
    approve_purchase_order,
    create_purchase_order,
    submit_for_review,
)


class PurchaseLogisticsFlowTests(TestCase):
    def setUp(self):
        self.finance = User.objects.create_user(
            username="finanzas_logistica",
            email="finanzas-logistica@example.invalid",
            role=UserRole.FINANZAS_COMERCIAL,
        )
        self.supplier = Supplier.objects.create(
            legal_name="Proveedor Internacional SpA",
            tax_id="76.222.333-4",
            country="Estados Unidos",
            created_by=self.finance,
            updated_by=self.finance,
        )
        self.order = create_purchase_order(
            data={
                "number": "",
                "supplier": self.supplier,
                "order_date": timezone.localdate(),
                "currency": "USD",
                "exchange_rate": Decimal("900"),
                "exchange_rate_date": timezone.localdate(),
                "exchange_rate_source": "Fuente de prueba",
                "responsible": self.finance,
            },
            lines=[
                {
                    "description": "Equipamiento importado",
                    "quantity": 2,
                    "unit_price_original": Decimal("3000"),
                    "tax_rate": Decimal("0"),
                }
            ],
            idempotency_key="logistics-order-create",
            user=self.finance,
        )
        submit_for_review(
            order=self.order,
            idempotency_key="logistics-order-review",
            user=self.finance,
            reason="Validación de compra internacional.",
        )
        self.order = approve_purchase_order(
            order=self.order,
            idempotency_key="logistics-order-approve",
            user=self.finance,
            reason="Compra internacional aprobada.",
        )
        self.carrier, _ = resolve_or_create_carrier(
            name="DHL Express",
            defaults={
                "country": "Alemania",
                "tracking_url_template": (
                    "https://www.dhl.com/cl-es/home/rastreo.html"
                    "?tracking-id={tracking_number}"
                ),
            },
            user=self.finance,
        )

    def create_shipment(self, key="logistics-shipment-create"):
        today = timezone.localdate()
        return create_purchase_shipment(
            data={
                "order": self.order,
                "carrier": self.carrier,
                "tracking_number": "TRACK-100",
                "origin_country": "Estados Unidos",
                "destination_place": "Santiago, Chile",
                "shipped_date": today,
                "initial_eta": today + timedelta(days=12),
                "current_eta": today + timedelta(days=12),
            },
            idempotency_key=key,
            user=self.finance,
        )

    def test_order_number_and_customs_alert_are_generated(self):
        self.assertRegex(self.order.number, r"^OC-\d{4}-00001$")

        shipment = self.create_shipment()

        self.assertTrue(shipment.customs_review_expected)
        self.assertIn("umbral operativo interno", shipment.customs_review_reason)
        self.assertEqual(shipment.events.count(), 1)
        self.assertIn("TRACK-100", shipment.tracking_url)

        replay = self.create_shipment()
        self.assertEqual(replay.pk, shipment.pk)
        self.assertEqual(ShipmentEvent.objects.count(), 1)

    def test_event_and_charge_are_idempotent_and_update_tracking(self):
        shipment = self.create_shipment()
        new_eta = timezone.localdate() + timedelta(days=15)
        occurred_at = timezone.now()

        event = register_shipment_event(
            shipment=shipment,
            data={
                "event_type": ShipmentEventType.RETENCION,
                "title": "Pedido retenido para revisión",
                "description": "Aduanas solicitó antecedentes adicionales.",
                "occurred_at": occurred_at,
                "new_state": ShipmentStatus.RETENIDO,
                "new_custodian": ShipmentCustodian.ADUANA,
                "updated_eta": new_eta,
                "evidence_reference": "Correo courier 2026-07",
            },
            idempotency_key="logistics-event-retention",
            user=self.finance,
        )
        replay = register_shipment_event(
            shipment=shipment,
            data={
                "event_type": ShipmentEventType.RETENCION,
                "title": "Este texto no debe duplicar el evento",
                "occurred_at": occurred_at,
            },
            idempotency_key="logistics-event-retention",
            user=self.finance,
        )
        shipment.refresh_from_db()
        self.assertEqual(replay.pk, event.pk)
        self.assertEqual(shipment.state, ShipmentStatus.RETENIDO)
        self.assertEqual(shipment.current_custodian, ShipmentCustodian.ADUANA)
        self.assertEqual(shipment.current_eta, new_eta)

        charge = register_shipment_charge(
            shipment=shipment,
            data={
                "charge_type": "DERECHO_ADUANERO",
                "description": "Derechos y gestión aduanera",
                "amount_original": Decimal("100"),
                "currency": "USD",
                "exchange_rate": Decimal("900"),
                "exchange_rate_date": timezone.localdate(),
                "exchange_rate_source": "Fuente de prueba",
                "charged_by": "Agencia de aduanas",
                "reason": "Cobro respaldado por liquidación.",
                "source_reference": "LIQ-100",
                "charge_status": "CONFIRMADO",
            },
            idempotency_key="logistics-charge-customs",
            user=self.finance,
        )
        replay_charge = register_shipment_charge(
            shipment=shipment,
            data={},
            idempotency_key="logistics-charge-customs",
            user=self.finance,
        )
        self.assertEqual(replay_charge.pk, charge.pk)
        self.assertEqual(charge.amount_clp, Decimal("90000"))
        self.assertEqual(ShipmentCharge.objects.count(), 1)


class PurchaseLogisticsPermissionTests(TestCase):
    def setUp(self):
        self.finance = User.objects.create_user(
            username="finanzas_permisos",
            email="finanzas-permisos@example.invalid",
            role=UserRole.FINANZAS_COMERCIAL,
        )
        self.rrhh = User.objects.create_user(
            username="rrhh_logistica",
            email="rrhh-logistica@example.invalid",
            role=UserRole.RRHH,
        )
        self.operator = User.objects.create_user(
            username="operativo_logistica",
            email="operativo-logistica@example.invalid",
            role=UserRole.OPERATIVO,
        )
        self.viewer = User.objects.create_user(
            username="consulta_logistica",
            email="consulta-logistica@example.invalid",
            role=UserRole.CONSULTA,
        )
        supplier = Supplier.objects.create(
            legal_name="Proveedor API Logística",
            tax_id="76.555.444-3",
            country="Chile",
            created_by=self.finance,
            updated_by=self.finance,
        )
        order = create_purchase_order(
            data={
                "number": "OC-LOG-API",
                "supplier": supplier,
                "order_date": timezone.localdate(),
                "currency": "CLP",
                "exchange_rate": Decimal("1"),
                "responsible": self.finance,
            },
            lines=[
                {
                    "description": "Compra con seguimiento",
                    "quantity": 1,
                    "unit_price_original": Decimal("1000"),
                }
            ],
            idempotency_key="logistics-api-order",
            user=self.finance,
        )
        submit_for_review(
            order=order,
            idempotency_key="logistics-api-review",
            user=self.finance,
            reason="Revisión API.",
        )
        self.order = approve_purchase_order(
            order=order,
            idempotency_key="logistics-api-approve",
            user=self.finance,
            reason="Aprobación API.",
        )
        self.client = APIClient()

    def test_rrhh_manages_logistics_operator_updates_and_viewer_reads(self):
        self.client.force_authenticate(self.rrhh)
        carrier_response = self.client.post(
            "/api/purchases/transportistas/resolver/",
            {"name": "Transportista de prueba"},
            format="json",
        )
        self.assertEqual(carrier_response.status_code, 201, carrier_response.data)
        carrier_id = carrier_response.data["carrier"]["id"]

        shipment_response = self.client.post(
            "/api/purchases/envios/",
            {
                "order": self.order.pk,
                "carrier": carrier_id,
                "tracking_number": "API-TRACK-1",
                "destination_place": "Santiago, Chile",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="logistics-api-shipment",
        )
        self.assertEqual(shipment_response.status_code, 201, shipment_response.data)
        shipment_id = shipment_response.data["id"]

        export_response = self.client.get(
            "/api/purchases/envios/export/",
            {"mode": "official", "file_format": "xlsx"},
        )
        self.assertEqual(export_response.status_code, 200)

        self.client.force_authenticate(self.operator)
        denied_create = self.client.post(
            "/api/purchases/envios/",
            {
                "order": self.order.pk,
                "carrier": carrier_id,
                "tracking_number": "API-TRACK-DENIED",
                "destination_place": "Santiago, Chile",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="logistics-api-denied-create",
        )
        self.assertEqual(denied_create.status_code, 403)
        event_response = self.client.post(
            f"/api/purchases/envios/{shipment_id}/eventos/",
            {
                "event_type": "DESPACHO",
                "title": "Pedido despachado",
                "description": "El courier confirmó el retiro.",
                "occurred_at": timezone.now().isoformat(),
                "new_state": "DESPACHADO",
                "new_custodian": "TRANSPORTISTA_INTERNACIONAL",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="logistics-api-event",
        )
        self.assertEqual(event_response.status_code, 201, event_response.data)
        denied_charge = self.client.post(
            f"/api/purchases/envios/{shipment_id}/cobros/",
            {
                "charge_type": "OTRO",
                "description": "Cobro operativo",
                "amount_original": "1000",
                "currency": "CLP",
                "reason": "Prueba de permisos.",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="logistics-api-denied-charge",
        )
        self.assertEqual(denied_charge.status_code, 403)

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get("/api/purchases/envios/")
        self.assertEqual(list_response.status_code, 200)
        denied_event = self.client.post(
            f"/api/purchases/envios/{shipment_id}/eventos/",
            {
                "event_type": "ACTUALIZACION",
                "title": "Intento sin permiso",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="logistics-api-viewer-event",
        )
        self.assertEqual(denied_event.status_code, 403)
