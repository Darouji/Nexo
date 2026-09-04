from django.core.exceptions import ValidationError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.core.models import AuditAction, AuditLog

from .location_services import (
    archive_inventory_location,
    transfer_inventory,
)
from .models import (
    Categoria,
    InventoryLocation,
    InventoryLocationType,
    InventoryTransfer,
    ProductLocationBalance,
    Producto,
    ProductOrigin,
)
from .services import register_manual_entry


class InventoryLocationMigrationTests(TransactionTestCase):
    migrate_from = [
        ("inventory", "0006_category_merge_product_origin"),
    ]
    migrate_to = [
        ("inventory", "0007_inventory_locations_and_custody"),
    ]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps

        Categoria = old_apps.get_model("inventory", "Categoria")
        Producto = old_apps.get_model("inventory", "Producto")
        PendientePorRecibir = old_apps.get_model(
            "inventory",
            "PendientePorRecibir",
        )

        category = Categoria.objects.create(
            name="Categoría histórica",
            name_normalized="categoria historica",
        )
        self.product_id = Producto.objects.create(
            categoria_id=category.pk,
            modelo="Producto anterior a ubicaciones",
            modelo_normalized="producto anterior a ubicaciones",
            controla_stock=True,
            stock_actual=7,
        ).pk
        self.pending_id = PendientePorRecibir.objects.create(
            producto_id=self.product_id,
            cantidad_original=3,
            motivo="Pendiente histórico",
        ).pk

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.apps = executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(
            [("inventory", "0007_inventory_locations_and_custody")]
        )
        super().tearDown()

    def test_existing_stock_and_pending_are_assigned_without_inventing_warehouse(
        self,
    ):
        InventoryLocation = self.apps.get_model(
            "inventory",
            "InventoryLocation",
        )
        ProductLocationBalance = self.apps.get_model(
            "inventory",
            "ProductLocationBalance",
        )
        PendientePorRecibir = self.apps.get_model(
            "inventory",
            "PendientePorRecibir",
        )

        location = InventoryLocation.objects.get(is_regularization=True)
        balance = ProductLocationBalance.objects.get(
            product_id=self.product_id,
            location_id=location.pk,
        )
        pending = PendientePorRecibir.objects.get(pk=self.pending_id)

        self.assertEqual(location.name, "Stock histórico por regularizar")
        self.assertEqual(location.location_type, "OTRO")
        self.assertEqual(balance.quantity, 7)
        self.assertEqual(pending.destination_location_id, location.pk)


class InventoryLocationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="location-admin",
            email="location-admin@example.invalid",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )
        self.category = Categoria.objects.create(
            name="Categoría con ubicación",
            created_by=self.user,
            updated_by=self.user,
        )
        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Alternador de prueba",
            codigo_sap="ALT-LOC-01",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )
        self.warehouse = InventoryLocation.objects.create(
            name="Bodega central",
            location_type=InventoryLocationType.BODEGA,
            city="Santiago",
            created_by=self.user,
            updated_by=self.user,
        )
        self.transit = InventoryLocation.objects.create(
            name="Vehículo de reparto",
            location_type=InventoryLocationType.TRANSITO,
            created_by=self.user,
            updated_by=self.user,
        )
        self.site = InventoryLocation.objects.create(
            name="Faena norte",
            location_type=InventoryLocationType.CLIENTE_FAENA,
            city="Antofagasta",
            created_by=self.user,
            updated_by=self.user,
        )
        self.movement = register_manual_entry(
            producto=self.product,
            cantidad=10,
            motivo="Stock inicial localizado.",
            location=self.warehouse,
            user=self.user,
        )

    def test_kardex_updates_total_and_location_in_same_operation(self):
        self.product.refresh_from_db()
        balance = ProductLocationBalance.objects.get(
            product=self.product,
            location=self.warehouse,
        )

        self.assertEqual(self.product.stock_actual, 10)
        self.assertEqual(balance.quantity, 10)
        self.assertEqual(self.movement.location, self.warehouse)
        self.assertEqual(
            self.movement.location_name_snapshot,
            "Bodega central",
        )

    def test_transfer_moves_location_balance_without_changing_total(self):
        transfer, created = transfer_inventory(
            product=self.product,
            origin_location=self.warehouse,
            destination_location=self.transit,
            quantity=4,
            reason="Despacho interno autorizado.",
            idempotency_key="transfer-service-001",
            user=self.user,
        )

        self.product.refresh_from_db()
        origin_balance = ProductLocationBalance.objects.get(
            product=self.product,
            location=self.warehouse,
        )
        destination_balance = ProductLocationBalance.objects.get(
            product=self.product,
            location=self.transit,
        )

        self.assertTrue(created)
        self.assertEqual(transfer.quantity, 4)
        self.assertEqual(origin_balance.quantity, 6)
        self.assertEqual(destination_balance.quantity, 4)
        self.assertEqual(self.product.stock_actual, 10)
        self.assertEqual(self.product.kardex.count(), 1)

        audit = AuditLog.objects.get(
            metadata__operation="inventory_transfer"
        )
        self.assertEqual(audit.action, AuditAction.TRASLADAR)
        self.assertEqual(
            audit.metadata["origin_location_name"],
            "Bodega central",
        )
        self.assertEqual(
            audit.metadata["destination_location_name"],
            "Vehículo de reparto",
        )

    def test_idempotent_retry_does_not_move_stock_twice(self):
        first_transfer, first_created = transfer_inventory(
            product=self.product,
            origin_location=self.warehouse,
            destination_location=self.transit,
            quantity=2,
            reason="Reintento de red controlado.",
            idempotency_key="transfer-retry-001",
            user=self.user,
        )
        repeated_transfer, repeated_created = transfer_inventory(
            product=self.product,
            origin_location=self.warehouse,
            destination_location=self.transit,
            quantity=2,
            reason="Reintento de red controlado.",
            idempotency_key="transfer-retry-001",
            user=self.user,
        )

        self.assertTrue(first_created)
        self.assertFalse(repeated_created)
        self.assertEqual(first_transfer.pk, repeated_transfer.pk)
        self.assertEqual(InventoryTransfer.objects.count(), 1)
        self.assertEqual(
            ProductLocationBalance.objects.get(
                product=self.product,
                location=self.warehouse,
            ).quantity,
            8,
        )

    def test_sensitive_transfer_requires_evidence_and_is_atomic(self):
        with self.assertRaises(ValidationError):
            transfer_inventory(
                product=self.product,
                origin_location=self.warehouse,
                destination_location=self.site,
                quantity=3,
                reason="Entrega temporal a faena.",
                evidence_reference="",
                idempotency_key="transfer-sensitive-001",
                user=self.user,
            )

        self.assertEqual(InventoryTransfer.objects.count(), 0)
        self.assertEqual(
            ProductLocationBalance.objects.get(
                product=self.product,
                location=self.warehouse,
            ).quantity,
            10,
        )
        self.assertFalse(
            ProductLocationBalance.objects.filter(
                product=self.product,
                location=self.site,
            ).exists()
        )

    def test_location_balance_cannot_be_changed_directly(self):
        balance = ProductLocationBalance.objects.get(
            product=self.product,
            location=self.warehouse,
        )
        balance.quantity = 99

        with self.assertRaises(ValidationError):
            balance.save()

        balance.refresh_from_db()
        self.assertEqual(balance.quantity, 10)

    def test_location_with_stock_cannot_be_archived(self):
        with self.assertRaises(ValidationError):
            archive_inventory_location(
                location=self.warehouse,
                reason="Intento con stock físico.",
                user=self.user,
            )

        self.warehouse.refresh_from_db()
        self.assertEqual(self.warehouse.status, "ACTIVO")


class InventoryLocationApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="location-api-admin",
            email="location-api-admin@example.invalid",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )
        self.reader = User.objects.create_user(
            username="location-api-reader",
            email="location-api-reader@example.invalid",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )
        self.category = Categoria.objects.create(name="Categoría API")
        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Motor con ubicación API",
            codigo_sap="MOT-LOC-01",
            controla_stock=True,
        )
        self.origin = InventoryLocation.objects.create(
            name="Bodega API",
            location_type=InventoryLocationType.BODEGA,
        )
        self.destination = InventoryLocation.objects.create(
            name="Tránsito API",
            location_type=InventoryLocationType.TRANSITO,
        )
        register_manual_entry(
            producto=self.product,
            cantidad=5,
            motivo="Preparación de prueba API.",
            location=self.origin,
            user=self.admin,
        )

    def test_inventory_summary_reports_total_physical_stock(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        initial_response = client.get("/api/inventory/productos/resumen/")

        self.assertEqual(initial_response.status_code, status.HTTP_200_OK)
        self.assertEqual(initial_response.data["stock_fisico_total"], 5)

        transfer_inventory(
            product=self.product,
            origin_location=self.origin,
            destination_location=self.destination,
            quantity=2,
            reason="Comprobar que una transferencia no altera el total.",
            user=self.admin,
            idempotency_key="summary-transfer-001",
        )

        transferred_response = client.get("/api/inventory/productos/resumen/")

        self.assertEqual(transferred_response.status_code, status.HTTP_200_OK)
        self.assertEqual(transferred_response.data["stock_fisico_total"], 5)

    def test_admin_can_transfer_and_retry_returns_same_record(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        payload = {
            "product": self.product.pk,
            "origin_location": self.origin.pk,
            "destination_location": self.destination.pk,
            "quantity": 2,
            "reason": "Traslado API autorizado.",
            "evidence_reference": "",
        }

        first_response = client.post(
            "/api/inventory/transferencias/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-transfer-001",
        )
        retry_response = client.post(
            "/api/inventory/transferencias/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-transfer-001",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(retry_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data["id"], retry_response.data["id"])
        self.assertEqual(InventoryTransfer.objects.count(), 1)

    def test_read_only_user_cannot_create_transfer(self):
        client = APIClient()
        client.force_authenticate(user=self.reader)

        response = client.post(
            "/api/inventory/transferencias/",
            {
                "product": self.product.pk,
                "origin_location": self.origin.pk,
                "destination_location": self.destination.pk,
                "quantity": 1,
                "reason": "Intento sin permiso.",
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="api-transfer-forbidden-001",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(InventoryTransfer.objects.count(), 0)

    def test_inventory_adjustment_rejects_location_without_product_stock(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        response = client.post(
            f"/api/inventory/productos/{self.product.pk}/ajuste-inventario/",
            {
                "cantidad": 1,
                "motivo": "Intento de ajuste en ubicación incorrecta.",
                "ubicacion": self.destination.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ubicacion", response.data["error"]["details"])
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_actual, 5)
        self.assertFalse(
            ProductLocationBalance.objects.filter(
                product=self.product,
                location=self.destination,
            ).exists()
        )
