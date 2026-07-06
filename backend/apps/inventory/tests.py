from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.core.models import AuditAction, AuditLog, BaseStatus, RecordChangeLog

from .models import (
    Categoria,
    KardexMovementType,
    MovimientoKardex,
    PendientePorRecibir,
    PendientePorRecibirStatus,
    Producto,
    ProductOrigin,
)
from .serializers import MovimientoKardexSerializer
from .services import (
    cancel_pending_receipt,
    change_category_lifecycle,
    change_product_lifecycle,
    create_pending_receipt,
    receive_pending_receipt,
)


class CategoriaIntegrityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="category-admin",
            email="category-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.active_category = Categoria.objects.create(
            name="Categoría operativa",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product = Producto.objects.create(
            categoria=self.active_category,
            modelo="Producto asociado a categoría",
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        self.inactive_category = Categoria.objects.create(
            name="Categoría inactiva",
            status=BaseStatus.INACTIVO,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_category_with_operational_products_cannot_be_inactivated(self):
        self.active_category.status = BaseStatus.INACTIVO

        with self.assertRaises(ValidationError):
            self.active_category.save()

        self.active_category.refresh_from_db()

        self.assertEqual(
            self.active_category.status,
            BaseStatus.ACTIVO,
        )

    def test_product_cannot_be_created_or_reassigned_to_inactive_category(self):
        with self.assertRaises(ValidationError):
            Producto.objects.create(
                categoria=self.inactive_category,
                modelo="Producto inválido en categoría inactiva",
                controla_stock=True,
                created_by=self.user,
                updated_by=self.user,
            )

        self.product.categoria = self.inactive_category

        with self.assertRaises(ValidationError):
            self.product.save()

        self.product.refresh_from_db()

        self.assertEqual(
            self.product.categoria_id,
            self.active_category.pk,
        )

    def test_category_lifecycle_changes_status_and_creates_audit(self):
        empty_category = Categoria.objects.create(
            name="Categoría sin productos",
            created_by=self.user,
            updated_by=self.user,
        )

        change_category_lifecycle(
            categoria=empty_category,
            accion="INACTIVAR",
            motivo="La categoría ya no se utilizará operativamente.",
            user=self.user,
        )

        empty_category.refresh_from_db()

        self.assertEqual(
            empty_category.status,
            BaseStatus.INACTIVO,
        )

        change_category_lifecycle(
            categoria=empty_category,
            accion="ARCHIVAR",
            motivo="La categoría quedó solo como referencia histórica.",
            user=self.user,
        )

        empty_category.refresh_from_db()

        self.assertEqual(
            empty_category.status,
            BaseStatus.ARCHIVADO,
        )

        change_category_lifecycle(
            categoria=empty_category,
            accion="REACTIVAR",
            motivo="La categoría vuelve a estar disponible.",
            user=self.user,
        )

        empty_category.refresh_from_db()

        self.assertEqual(
            empty_category.status,
            BaseStatus.ACTIVO,
        )

        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(empty_category.pk),
                action=AuditAction.INACTIVAR,
                field_name="status",
                reason="La categoría ya no se utilizará operativamente.",
            ).exists()
        )

    def test_category_lifecycle_cannot_inactivate_with_operational_products(self):
        with self.assertRaises(ValidationError):
            change_category_lifecycle(
                categoria=self.active_category,
                accion="INACTIVAR",
                motivo="Intento inválido con productos operativos.",
                user=self.user,
            )

        self.active_category.refresh_from_db()

        self.assertEqual(
            self.active_category.status,
            BaseStatus.ACTIVO,
        )


class PendientePorRecibirServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="inventory-admin",
            email="inventory-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.categoria = Categoria.objects.create(
            name="Sensores",
            created_by=self.user,
            updated_by=self.user,
        )

        self.producto = Producto.objects.create(
            categoria=self.categoria,
            modelo="Sensor Industrial A",
            codigo_sap="SAP-001",
            stock_actual=10,
            stock_critico=2,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        self.servicio = Producto.objects.create(
            categoria=self.categoria,
            modelo="Servicio de instalación",
            controla_stock=False,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_create_pending_receipt_does_not_change_stock_or_create_kardex(self):
        pending_receipt = create_pending_receipt(
            producto=self.producto,
            cantidad=8,
            motivo="OC-100 pendiente de llegada física.",
            referencia="OC-100",
            user=self.user,
        )

        self.producto.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 10)
        self.assertEqual(MovimientoKardex.objects.count(), 0)
        self.assertEqual(pending_receipt.cantidad_original, 8)
        self.assertEqual(pending_receipt.cantidad_pendiente, 8)
        self.assertEqual(
            pending_receipt.estado,
            PendientePorRecibirStatus.PENDIENTE,
        )

    def test_receive_partial_pending_updates_stock_and_creates_kardex(self):
        pending_receipt = create_pending_receipt(
            producto=self.producto,
            cantidad=8,
            motivo="Compra en tránsito.",
            referencia="OC-101",
            user=self.user,
        )

        updated_pending_receipt, movement = receive_pending_receipt(
            pending_receipt=pending_receipt,
            cantidad=3,
            motivo="Recepción física parcial de OC-101.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        updated_pending_receipt.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 13)
        self.assertEqual(updated_pending_receipt.cantidad_recibida, 3)
        self.assertEqual(updated_pending_receipt.cantidad_cancelada, 0)
        self.assertEqual(updated_pending_receipt.cantidad_pendiente, 5)
        self.assertEqual(
            updated_pending_receipt.estado,
            PendientePorRecibirStatus.PARCIAL,
        )
        self.assertEqual(
            movement.movement_type,
            KardexMovementType.ENTRADA_RECEPCION,
        )
        self.assertEqual(movement.cantidad, 3)
        self.assertEqual(movement.stock_antes, 10)
        self.assertEqual(movement.stock_despues, 13)
        self.assertEqual(
            movement.reference_object_id,
            str(pending_receipt.pk),
        )
        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(pending_receipt.pk),
                field_name="cantidad_recibida",
            ).exists()
        )

    def test_kardex_preserves_product_snapshot_after_product_edit(self):
        pending_receipt = create_pending_receipt(
            producto=self.producto,
            cantidad=4,
            motivo="Compra para validar trazabilidad histórica.",
            referencia="OC-SNAPSHOT-001",
            user=self.user,
        )

        _, movement = receive_pending_receipt(
            pending_receipt=pending_receipt,
            cantidad=2,
            motivo="Recepción física para prueba de snapshot.",
            user=self.user,
        )

        original_modelo = self.producto.modelo
        original_categoria = self.categoria.name
        original_codigo_sap = self.producto.codigo_sap

        self.producto.refresh_from_db()

        nueva_categoria = Categoria.objects.create(
            name="Sensores corregidos",
            created_by=self.user,
            updated_by=self.user,
        )

        self.producto.modelo = "Sensor Industrial A - Corregido"
        self.producto.categoria = nueva_categoria
        self.producto.codigo_sap = "SAP-001-REV"
        self.producto.save()

        movement_data = MovimientoKardexSerializer(
            MovimientoKardex.objects.select_related(
                "producto",
                "producto__categoria",
            ).get(pk=movement.pk)
        ).data

        self.assertEqual(movement_data["producto_modelo"], original_modelo)
        self.assertEqual(movement_data["producto_categoria"], original_categoria)
        self.assertEqual(
            movement_data["producto_codigo_sap"],
            original_codigo_sap,
        )

    def test_cancel_pending_does_not_change_stock_or_create_kardex(self):
        pending_receipt = create_pending_receipt(
            producto=self.producto,
            cantidad=8,
            motivo="Compra en tránsito.",
            referencia="OC-102",
            user=self.user,
        )

        updated_pending_receipt = cancel_pending_receipt(
            pending_receipt=pending_receipt,
            cantidad=8,
            motivo="Proveedor canceló la orden de compra.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        updated_pending_receipt.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 10)
        self.assertEqual(MovimientoKardex.objects.count(), 0)
        self.assertEqual(updated_pending_receipt.cantidad_cancelada, 8)
        self.assertEqual(updated_pending_receipt.cantidad_pendiente, 0)
        self.assertEqual(
            updated_pending_receipt.estado,
            PendientePorRecibirStatus.CANCELADA,
        )
        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(pending_receipt.pk),
                field_name="cantidad_cancelada",
            ).exists()
        )

    def test_quantity_cannot_exceed_pending_units(self):
        pending_receipt = create_pending_receipt(
            producto=self.producto,
            cantidad=5,
            motivo="Compra en tránsito.",
            user=self.user,
        )

        with self.assertRaises(ValidationError):
            receive_pending_receipt(
                pending_receipt=pending_receipt,
                cantidad=6,
                motivo="Intento inválido.",
                user=self.user,
            )

        pending_receipt.refresh_from_db()
        self.producto.refresh_from_db()

        self.assertEqual(pending_receipt.cantidad_recibida, 0)
        self.assertEqual(pending_receipt.cantidad_pendiente, 5)
        self.assertEqual(self.producto.stock_actual, 10)
        self.assertEqual(MovimientoKardex.objects.count(), 0)

    def test_non_stock_product_cannot_have_pending_receipt(self):
        with self.assertRaises(ValidationError):
            create_pending_receipt(
                producto=self.servicio,
                cantidad=2,
                motivo="No corresponde para servicios.",
                user=self.user,
            )

        self.assertEqual(PendientePorRecibir.objects.count(), 0)

    def test_inactive_or_discontinued_product_cannot_have_pending_receipt(self):
        inactive_product = Producto.objects.create(
            categoria=self.categoria,
            modelo="Producto inactivo de prueba",
            controla_stock=True,
            status=BaseStatus.INACTIVO,
            created_by=self.user,
            updated_by=self.user,
        )

        discontinued_product = Producto.objects.create(
            categoria=self.categoria,
            modelo="Producto descontinuado de prueba",
            controla_stock=True,
            descontinuado=True,
            created_by=self.user,
            updated_by=self.user,
        )

        for producto in [inactive_product, discontinued_product]:
            with self.subTest(producto=producto.modelo):
                with self.assertRaises(ValidationError):
                    create_pending_receipt(
                        producto=producto,
                        cantidad=2,
                        motivo="Prueba de protección backend.",
                        user=self.user,
                    )

        self.assertEqual(PendientePorRecibir.objects.count(), 0)

    def test_product_with_open_pending_receipt_cannot_be_inactivated(self):
        create_pending_receipt(
            producto=self.producto,
            cantidad=3,
            motivo="Compra en tránsito.",
            user=self.user,
        )

        with self.assertRaises(ValidationError):
            self.producto.mark_inactive(user=self.user)

    def test_product_lifecycle_controls_operational_state(self):
        producto = Producto.objects.create(
            categoria=self.categoria,
            modelo="Producto ciclo de vida",
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        change_product_lifecycle(
            producto=producto,
            accion="DESCONTINUAR",
            motivo="El modelo fue reemplazado por una versión nueva.",
            user=self.user,
        )

        producto.refresh_from_db()

        self.assertEqual(producto.status, BaseStatus.ACTIVO)
        self.assertTrue(producto.descontinuado)

        with self.assertRaises(ValidationError):
            create_pending_receipt(
                producto=producto,
                cantidad=2,
                motivo="No debe permitir nueva reposición.",
                user=self.user,
            )

        change_product_lifecycle(
            producto=producto,
            accion="REANUDAR",
            motivo="Se autorizó continuar usando el modelo.",
            user=self.user,
        )

        producto.refresh_from_db()
        self.assertFalse(producto.descontinuado)

        change_product_lifecycle(
            producto=producto,
            accion="INACTIVAR",
            motivo="Producto sin uso ni stock físico.",
            user=self.user,
        )

        producto.refresh_from_db()
        self.assertEqual(producto.status, BaseStatus.INACTIVO)

        change_product_lifecycle(
            producto=producto,
            accion="ARCHIVAR",
            motivo="Catálogo histórico sin uso operativo.",
            user=self.user,
        )

        producto.refresh_from_db()
        self.assertEqual(producto.status, BaseStatus.ARCHIVADO)

        change_product_lifecycle(
            producto=producto,
            accion="REACTIVAR",
            motivo="El producto volvió a estar disponible.",
            user=self.user,
        )

        producto.refresh_from_db()
        self.assertEqual(producto.status, BaseStatus.ACTIVO)

        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(producto.pk),
                action=AuditAction.INACTIVAR,
                field_name="status",
                reason="Producto sin uso ni stock físico.",
            ).exists()
        )

    def test_product_with_stock_cannot_be_inactivated(self):
        with self.assertRaises(ValidationError):
            change_product_lifecycle(
                producto=self.producto,
                accion="INACTIVAR",
                motivo="Intento inválido con stock disponible.",
                user=self.user,
            )

        self.producto.refresh_from_db()
        self.assertEqual(self.producto.status, BaseStatus.ACTIVO)


class PendientePorRecibirApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="inventory-api-admin",
            email="inventory-api-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.consulta = User.objects.create_user(
            username="inventory-api-consulta",
            email="inventory-api-consulta@serkan.cl",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )

        self.categoria = Categoria.objects.create(
            name="Herramientas",
            created_by=self.admin,
            updated_by=self.admin,
        )

        self.producto = Producto.objects.create(
            categoria=self.categoria,
            modelo="Llave de torque",
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

    def test_operational_user_can_create_and_receive_pending_receipt(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        create_response = client.post(
            "/api/inventory/pendientes-por-recibir/",
            {
                "producto": self.producto.pk,
                "cantidad": 4,
                "motivo": "OC-200 en tránsito.",
                "referencia": "OC-200",
            },
            format="json",
        )

        self.assertEqual(
            create_response.status_code,
            status.HTTP_201_CREATED,
        )

        pending_receipt_id = create_response.data["id"]

        receive_response = client.post(
            (f"/api/inventory/pendientes-por-recibir/{pending_receipt_id}/recibir/"),
            {
                "cantidad": 4,
                "motivo": "Recepción física total de OC-200.",
            },
            format="json",
        )

        self.assertEqual(
            receive_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            receive_response.data["pendiente"]["estado"],
            "RECIBIDA",
        )
        self.assertEqual(
            receive_response.data["movimiento_kardex"]["movement_type"],
            KardexMovementType.ENTRADA_RECEPCION,
        )

    def test_consulta_user_cannot_create_pending_receipt(self):
        client = APIClient()
        client.force_authenticate(user=self.consulta)

        response = client.post(
            "/api/inventory/pendientes-por-recibir/",
            {
                "producto": self.producto.pk,
                "cantidad": 4,
                "motivo": "Debe ser bloqueado.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_lifecycle_endpoint_audits_reason_and_blocks_direct_status_patch(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        lifecycle_product = Producto.objects.create(
            categoria=self.categoria,
            modelo="Producto API ciclo de vida",
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        direct_patch_response = client.patch(
            f"/api/inventory/productos/{lifecycle_product.pk}/",
            {"status": "INACTIVO"},
            format="json",
        )

        self.assertEqual(
            direct_patch_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        response = client.post(
            f"/api/inventory/productos/{lifecycle_product.pk}/ciclo-vida/",
            {
                "accion": "INACTIVAR",
                "motivo": "Producto creado por error y sin movimientos.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BaseStatus.INACTIVO)

        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditAction.INACTIVAR,
                object_id=str(lifecycle_product.pk),
                reason="Producto creado por error y sin movimientos.",
            ).exists()
        )

    def test_category_rejects_direct_status_change_and_delete(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        patch_response = client.patch(
            f"/api/inventory/categorias/{self.categoria.pk}/",
            {"status": BaseStatus.INACTIVO},
            format="json",
        )

        self.assertEqual(
            patch_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        delete_response = client.delete(
            f"/api/inventory/categorias/{self.categoria.pk}/",
        )

        self.assertEqual(
            delete_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

        self.categoria.refresh_from_db()

        self.assertEqual(
            self.categoria.status,
            BaseStatus.ACTIVO,
        )

    def test_category_lifecycle_endpoint_updates_status_and_audits_reason(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        empty_category = Categoria.objects.create(
            name="Categoría API sin productos",
            created_by=self.admin,
            updated_by=self.admin,
        )

        response = client.post(
            f"/api/inventory/categorias/{empty_category.pk}/ciclo-vida/",
            {
                "accion": "INACTIVAR",
                "motivo": "La categoría quedó sin uso operativo.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], BaseStatus.INACTIVO)

        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditAction.INACTIVAR,
                object_id=str(empty_category.pk),
                reason="La categoría quedó sin uso operativo.",
            ).exists()
        )


class ProductOriginAndCategoryHistoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="inventory-origin-admin",
            email="inventory-origin-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.category = Categoria.objects.create(
            name="Categoría de origen",
            created_by=self.user,
            updated_by=self.user,
        )

    def test_product_marks_category_as_historical_on_first_use(self):
        self.assertFalse(self.category.has_historical_usage)

        Producto.objects.create(
            categoria=self.category,
            modelo="Producto con uso histórico",
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        self.category.refresh_from_db()

        self.assertTrue(self.category.has_historical_usage)

    def test_service_product_forces_non_stock_configuration(self):
        product = Producto.objects.create(
            categoria=self.category,
            modelo="Servicio de inspección",
            origen=ProductOrigin.SERVICIO,
            controla_stock=True,
            stock_critico=10,
            created_by=self.user,
            updated_by=self.user,
        )

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.SERVICIO)
        self.assertFalse(product.controla_stock)
        self.assertEqual(product.stock_critico, 0)
        self.assertEqual(product.stock_actual, 0)

    def test_other_origin_requires_observation(self):
        with self.assertRaises(ValidationError):
            Producto.objects.create(
                categoria=self.category,
                modelo="Producto de origen especial",
                origen=ProductOrigin.OTRO,
                origen_observacion="",
                controla_stock=True,
                created_by=self.user,
                updated_by=self.user,
            )

    def test_product_with_stock_cannot_be_converted_to_service(self):
        product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto con stock",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            stock_actual=5,
            created_by=self.user,
            updated_by=self.user,
        )

        product.origen = ProductOrigin.SERVICIO

        with self.assertRaises(ValidationError):
            product.save()

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.COMPRADO)
        self.assertTrue(product.controla_stock)
        self.assertEqual(product.stock_actual, 5)
