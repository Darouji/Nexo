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
    change_product_lifecycle,
    create_pending_receipt,
    delete_category_safely,
    merge_categories,
    receive_pending_receipt,
    register_manual_entry,
    rename_category,
)


class CategoriaManagementServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="category-admin",
            email="category-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.source_category = Categoria.objects.create(
            name="Categoría origen",
            created_by=self.user,
            updated_by=self.user,
        )

        self.destination_category = Categoria.objects.create(
            name="Categoría destino",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product = Producto.objects.create(
            categoria=self.source_category,
            modelo="Producto asociado a categoría",
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_category_cannot_change_status_manually(self):
        self.source_category.status = BaseStatus.INACTIVO

        with self.assertRaises(ValidationError):
            self.source_category.save()

        self.source_category.refresh_from_db()

        self.assertEqual(
            self.source_category.status,
            BaseStatus.ACTIVO,
        )

    def test_rename_category_creates_field_and_business_audit(self):
        updated_category = rename_category(
            categoria=self.source_category,
            nombre="Categoría origen corregida",
            motivo="Se corrigió el nombre para mejorar la búsqueda.",
            user=self.user,
        )

        self.assertEqual(
            updated_category.name,
            "Categoría origen corregida",
        )
        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(updated_category.pk),
                action=AuditAction.RENOMBRAR,
                field_name="name",
                reason="Se corrigió el nombre para mejorar la búsqueda.",
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(updated_category.pk),
                action=AuditAction.RENOMBRAR,
            ).exists()
        )

    def test_merge_reassigns_products_and_preserves_pending_receipts(self):
        pending_receipt = create_pending_receipt(
            producto=self.product,
            cantidad=4,
            motivo="Orden de compra pendiente.",
            referencia="OC-CATEGORY-MERGE",
            user=self.user,
        )

        source, destination, reassigned_count, is_idempotent = merge_categories(
            categoria_origen=self.source_category,
            categoria_destino=self.destination_category,
            motivo="Se consolidaron categorías duplicadas.",
            user=self.user,
        )

        self.product.refresh_from_db()
        pending_receipt.refresh_from_db()
        source.refresh_from_db()
        destination.refresh_from_db()

        self.assertFalse(is_idempotent)
        self.assertEqual(reassigned_count, 1)
        self.assertEqual(self.product.categoria_id, destination.pk)
        self.assertEqual(pending_receipt.producto_id, self.product.pk)
        self.assertEqual(source.status, BaseStatus.ARCHIVADO)
        self.assertEqual(source.merged_into_id, destination.pk)
        self.assertTrue(source.has_historical_usage)
        self.assertTrue(destination.has_historical_usage)

        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(self.product.pk),
                action=AuditAction.FUSIONAR,
                field_name="categoria",
            ).exists()
        )

        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(source.pk),
                action=AuditAction.FUSIONAR,
                reason="Se consolidaron categorías duplicadas.",
            ).exists()
        )

    def test_merge_is_idempotent_for_same_source_and_destination(self):
        merge_categories(
            categoria_origen=self.source_category,
            categoria_destino=self.destination_category,
            motivo="Primera fusión.",
            user=self.user,
        )

        source, destination, reassigned_count, is_idempotent = merge_categories(
            categoria_origen=self.source_category,
            categoria_destino=self.destination_category,
            motivo="Reintento por pérdida de respuesta.",
            user=self.user,
        )

        self.assertTrue(is_idempotent)
        self.assertEqual(reassigned_count, 0)
        self.assertEqual(source.merged_into_id, destination.pk)

    def test_merge_rejects_duplicate_product_models_in_destination(self):
        Producto.objects.create(
            categoria=self.destination_category,
            modelo=self.product.modelo,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        with self.assertRaises(ValidationError):
            merge_categories(
                categoria_origen=self.source_category,
                categoria_destino=self.destination_category,
                motivo="Intento inválido con modelos duplicados.",
                user=self.user,
            )

        self.product.refresh_from_db()
        self.source_category.refresh_from_db()

        self.assertEqual(self.product.categoria_id, self.source_category.pk)
        self.assertEqual(self.source_category.status, BaseStatus.ACTIVO)

    def test_unused_category_can_be_deleted_safely(self):
        unused_category = Categoria.objects.create(
            name="Categoría temporal sin uso",
            created_by=self.user,
            updated_by=self.user,
        )

        unused_category_id = unused_category.pk

        result = delete_category_safely(
            categoria=unused_category,
            motivo="Categoría creada por error y nunca utilizada.",
            user=self.user,
        )

        self.assertEqual(result["id"], unused_category_id)
        self.assertFalse(Categoria.objects.filter(pk=unused_category_id).exists())

        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(unused_category_id),
                action=AuditAction.ELIMINAR,
            ).exists()
        )

    def test_category_with_historical_use_cannot_be_deleted(self):
        with self.assertRaises(ValidationError):
            delete_category_safely(
                categoria=self.source_category,
                motivo="Intento inválido de borrar una categoría usada.",
                user=self.user,
            )

        self.assertTrue(Categoria.objects.filter(pk=self.source_category.pk).exists())


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
            stock_critico=2,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        register_manual_entry(
            producto=self.producto,
            cantidad=10,
            motivo="Stock inicial para pruebas de pendientes por recibir.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        self.initial_kardex_count = MovimientoKardex.objects.count()

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
        self.assertEqual(
            MovimientoKardex.objects.count(),
            self.initial_kardex_count,
        )
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
        self.assertEqual(
            MovimientoKardex.objects.count(),
            self.initial_kardex_count,
        )
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
        self.assertEqual(
            MovimientoKardex.objects.count(),
            self.initial_kardex_count,
        )

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

        create_audits = list(
            AuditLog.objects.filter(
                model_name="pendienteporrecibir",
                object_id=str(pending_receipt_id),
            )
        )

        self.assertEqual(len(create_audits), 1)
        self.assertEqual(
            create_audits[0].metadata.get("operation"),
            "pending_receipt_create",
        )

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

        movement_id = receive_response.data["movimiento_kardex"]["id"]

        pending_audits = list(
            AuditLog.objects.filter(
                model_name="pendienteporrecibir",
                object_id=str(pending_receipt_id),
            ).order_by("created_at")
        )

        self.assertEqual(len(pending_audits), 2)

        pending_operations = {
            audit.metadata.get("operation") for audit in pending_audits
        }

        self.assertEqual(
            pending_operations,
            {
                "pending_receipt_create",
                "pending_receipt_receive",
            },
        )

        kardex_audits = list(
            AuditLog.objects.filter(
                model_name="movimientokardex",
                object_id=str(movement_id),
            )
        )

        self.assertEqual(len(kardex_audits), 1)
        self.assertEqual(
            kardex_audits[0].metadata.get("operation"),
            "kardex_movement",
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

        lifecycle_audits = list(
            AuditLog.objects.filter(
                action=AuditAction.INACTIVAR,
                model_name="producto",
                object_id=str(lifecycle_product.pk),
                reason=("Producto creado por error y sin movimientos."),
            )
        )

        self.assertEqual(len(lifecycle_audits), 1)
        self.assertEqual(
            lifecycle_audits[0].metadata.get("operation"),
            "product_lifecycle_change",
        )
        self.assertEqual(
            lifecycle_audits[0].metadata.get("lifecycle_action"),
            "INACTIVAR",
        )

    def test_category_rejects_direct_status_change_and_used_category_delete(self):
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
            {
                "motivo": (
                    "Intento inválido de eliminar una categoría que ya tiene productos."
                )
            },
            format="json",
        )

        self.assertEqual(
            delete_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertTrue(Categoria.objects.filter(pk=self.categoria.pk).exists())

    def test_category_rename_merge_and_safe_delete_actions(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        rename_response = client.post(
            f"/api/inventory/categorias/{self.categoria.pk}/renombrar/",
            {
                "name": "Herramientas de torque",
                "motivo": "Se precisó el nombre de la categoría.",
            },
            format="json",
        )

        self.assertEqual(rename_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            rename_response.data["name"],
            "Herramientas de torque",
        )

        destination_category = Categoria.objects.create(
            name="Herramientas industriales",
            created_by=self.admin,
            updated_by=self.admin,
        )

        merge_response = client.post(
            f"/api/inventory/categorias/{self.categoria.pk}/fusionar/",
            {
                "categoria_destino": destination_category.pk,
                "motivo": "Se consolidaron categorías equivalentes.",
            },
            format="json",
        )

        self.assertEqual(merge_response.status_code, status.HTTP_200_OK)
        self.assertEqual(merge_response.data["productos_reasignados"], 1)
        self.assertFalse(merge_response.data["idempotente"])

        self.categoria.refresh_from_db()
        self.producto.refresh_from_db()

        self.assertEqual(self.categoria.status, BaseStatus.ARCHIVADO)
        self.assertEqual(
            self.categoria.merged_into_id,
            destination_category.pk,
        )
        self.assertEqual(
            self.producto.categoria_id,
            destination_category.pk,
        )

        empty_category = Categoria.objects.create(
            name="Categoría temporal API",
            created_by=self.admin,
            updated_by=self.admin,
        )

        delete_response = client.delete(
            f"/api/inventory/categorias/{empty_category.pk}/",
            {"motivo": ("Categoría temporal creada durante una prueba funcional.")},
            format="json",
        )

        self.assertEqual(
            delete_response.status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertFalse(Categoria.objects.filter(pk=empty_category.pk).exists())


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
            created_by=self.user,
            updated_by=self.user,
        )

        register_manual_entry(
            producto=product,
            cantidad=5,
            motivo="Stock inicial para validar cambio de origen.",
            user=self.user,
        )

        product.refresh_from_db()
        product.origen = ProductOrigin.SERVICIO

        with self.assertRaises(ValidationError):
            product.save()

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.COMPRADO)
        self.assertTrue(product.controla_stock)
        self.assertEqual(product.stock_actual, 5)


class ProductCreationAndOriginApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="product-contract-admin",
            email="product-contract-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.category = Categoria.objects.create(
            name="Categoría base de productos",
            created_by=self.admin,
            updated_by=self.admin,
        )

    def test_product_can_create_category_atomically_by_name(self):
        response = self.client.post(
            "/api/inventory/productos/",
            {
                "categoria_nombre": "Accesorios especiales",
                "modelo": "Adaptador industrial X",
                "codigo_sap": "ACC-API-001",
                "origen": ProductOrigin.COMPRADO,
                "controla_stock": True,
                "stock_critico": 1,
                "stock_inicial": 2,
                "motivo_stock_inicial": ("Stock inicial validado durante la creación."),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_category = Categoria.objects.get(name="Accesorios especiales")

        product = Producto.objects.get(pk=response.data["id"])

        self.assertEqual(product.categoria_id, created_category.pk)
        self.assertEqual(product.stock_actual, 2)

        created_category.refresh_from_db()

        self.assertTrue(created_category.has_historical_usage)

        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(created_category.pk),
                action=AuditAction.CREAR,
            ).exists()
        )

    def test_invalid_product_rolls_back_new_category(self):
        Producto.objects.create(
            categoria=self.category,
            modelo="Producto SAP existente",
            codigo_sap="SAP-DUPLICADO",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        response = self.client.post(
            "/api/inventory/productos/",
            {
                "categoria_nombre": "Categoría que debe revertirse",
                "modelo": "Producto inválido",
                "codigo_sap": "SAP-DUPLICADO",
                "origen": ProductOrigin.COMPRADO,
                "controla_stock": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Categoria.objects.filter(name="Categoría que debe revertirse").exists()
        )

    def test_product_creation_requires_origin(self):
        response = self.client.post(
            "/api/inventory/productos/",
            {
                "categoria": self.category.pk,
                "modelo": "Producto sin origen",
                "controla_stock": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            str(response.data["error"]["details"]["origen"][0]),
            "El origen es obligatorio al crear un producto.",
        )

    def test_direct_origin_patch_is_rejected_and_controlled_change_is_audited(self):
        product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto modificable",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        direct_patch = self.client.patch(
            f"/api/inventory/productos/{product.pk}/",
            {
                "origen": ProductOrigin.OTRO,
                "origen_observacion": "Cambio directo inválido.",
            },
            format="json",
        )

        self.assertEqual(
            direct_patch.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        controlled_change = self.client.post(
            f"/api/inventory/productos/{product.pk}/cambiar-origen/",
            {
                "origen": ProductOrigin.OTRO,
                "origen_observacion": "Producto adquirido por canal especial.",
                "motivo": "Se corrigió el registro de adquisición.",
            },
            format="json",
        )

        self.assertEqual(
            controlled_change.status_code,
            status.HTTP_200_OK,
        )

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.OTRO)
        self.assertEqual(
            product.origen_observacion,
            "Producto adquirido por canal especial.",
        )

        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(product.pk),
                action=AuditAction.CAMBIAR_ORIGEN,
            ).exists()
        )

    def test_product_without_stock_can_change_to_service(self):
        product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto convertido a servicio",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        response = self.client.post(
            f"/api/inventory/productos/{product.pk}/cambiar-origen/",
            {
                "origen": ProductOrigin.SERVICIO,
                "motivo": "Se determinó que corresponde a una prestación.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.SERVICIO)
        self.assertFalse(product.controla_stock)
        self.assertEqual(product.stock_critico, 0)

    def test_product_with_stock_cannot_change_to_service(self):
        product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto con inventario físico",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        register_manual_entry(
            producto=product,
            cantidad=3,
            motivo="Stock inicial para validar bloqueo de servicio.",
            user=self.admin,
        )

        response = self.client.post(
            f"/api/inventory/productos/{product.pk}/cambiar-origen/",
            {
                "origen": ProductOrigin.SERVICIO,
                "motivo": "Intento inválido para validar protección.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        product.refresh_from_db()

        self.assertEqual(product.origen, ProductOrigin.COMPRADO)
        self.assertTrue(product.controla_stock)
        self.assertEqual(product.stock_actual, 3)

    def test_direct_category_patch_is_rejected_and_controlled_change_is_audited(self):
        destination_category = Categoria.objects.create(
            name="Categoría destino controlada",
            created_by=self.admin,
            updated_by=self.admin,
        )

        product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto reclasificable",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.admin,
            updated_by=self.admin,
        )

        direct_patch = self.client.patch(
            f"/api/inventory/productos/{product.pk}/",
            {
                "categoria": destination_category.pk,
            },
            format="json",
        )

        self.assertEqual(
            direct_patch.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        controlled_change = self.client.post(
            f"/api/inventory/productos/{product.pk}/cambiar-categoria/",
            {
                "categoria_destino": destination_category.pk,
                "motivo": "Se corrigió la clasificación del producto.",
            },
            format="json",
        )

        self.assertEqual(
            controlled_change.status_code,
            status.HTTP_200_OK,
        )

        product.refresh_from_db()

        self.assertEqual(product.categoria_id, destination_category.pk)

        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(product.pk),
                action=AuditAction.EDITAR,
                field_name="categoria",
                reason="Se corrigió la clasificación del producto.",
            ).exists()
        )

        self.assertTrue(
            AuditLog.objects.filter(
                object_id=str(product.pk),
                action=AuditAction.EDITAR,
                reason="Se corrigió la clasificación del producto.",
            ).exists()
        )


def test_controlled_category_change_rejects_duplicate_model_in_destination(self):
    destination_category = Categoria.objects.create(
        name="Categoría con modelo existente",
        created_by=self.admin,
        updated_by=self.admin,
    )

    Producto.objects.create(
        categoria=destination_category,
        modelo="Producto duplicado por modelo",
        origen=ProductOrigin.COMPRADO,
        controla_stock=True,
        created_by=self.admin,
        updated_by=self.admin,
    )

    product = Producto.objects.create(
        categoria=self.category,
        modelo="Producto duplicado por modelo",
        origen=ProductOrigin.COMPRADO,
        controla_stock=True,
        created_by=self.admin,
        updated_by=self.admin,
    )

    response = self.client.post(
        f"/api/inventory/productos/{product.pk}/cambiar-categoria/",
        {
            "categoria_destino": destination_category.pk,
            "motivo": "Intento de reclasificación con modelo duplicado.",
        },
        format="json",
    )

    self.assertEqual(
        response.status_code,
        status.HTTP_400_BAD_REQUEST,
    )

    product.refresh_from_db()

    self.assertEqual(product.categoria_id, self.category.pk)


class KardexImmutabilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="kardex-immutable-admin",
            email="kardex-immutable-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.category = Categoria.objects.create(
            name="Categoría Kardex inmutable",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto Kardex inmutable",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

        self.movement = register_manual_entry(
            producto=self.product,
            cantidad=5,
            motivo="Stock inicial para validar inmutabilidad.",
            user=self.user,
        )

    def test_service_creates_consistent_kardex_and_updates_stock(self):
        self.product.refresh_from_db()

        self.assertEqual(self.movement.stock_antes, 0)
        self.assertEqual(self.movement.cantidad, 5)
        self.assertEqual(self.movement.stock_despues, 5)
        self.assertEqual(
            self.movement.stock_despues,
            self.movement.stock_antes + self.movement.cantidad,
        )
        self.assertEqual(self.product.stock_actual, 5)

    def test_direct_kardex_creation_is_rejected(self):
        with self.assertRaises(ValidationError):
            MovimientoKardex.objects.create(
                producto=self.product,
                movement_type=KardexMovementType.ENTRADA_MANUAL,
                cantidad=1,
                stock_antes=5,
                stock_despues=6,
                motivo="Intento directo inválido.",
            )

        self.assertEqual(MovimientoKardex.objects.count(), 1)

    def test_existing_kardex_cannot_be_edited(self):
        original_reason = self.movement.motivo

        self.movement.motivo = "Intento de modificar el motivo."

        with self.assertRaises(ValidationError):
            self.movement.save()

        self.movement.refresh_from_db()

        self.assertEqual(
            self.movement.motivo,
            original_reason,
        )

    def test_existing_kardex_cannot_be_deleted(self):
        movement_id = self.movement.pk

        with self.assertRaises(ValidationError):
            self.movement.delete()

        self.assertTrue(MovimientoKardex.objects.filter(pk=movement_id).exists())


class StockWriteGuardTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="stock-guard-admin",
            email="stock-guard-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.category = Categoria.objects.create(
            name="Categoría de protección de stock",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Producto protegido contra edición de stock",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_new_product_cannot_define_stock_directly(self):
        with self.assertRaises(ValidationError):
            Producto.objects.create(
                categoria=self.category,
                modelo="Producto con stock directo inválido",
                origen=ProductOrigin.COMPRADO,
                controla_stock=True,
                stock_actual=1,
                created_by=self.user,
                updated_by=self.user,
            )

        self.assertFalse(
            Producto.objects.filter(
                modelo="Producto con stock directo inválido"
            ).exists()
        )

    def test_existing_product_cannot_change_stock_with_save(self):
        self.product.stock_actual = 7

        with self.assertRaises(ValidationError):
            self.product.save(
                update_fields=[
                    "stock_actual",
                    "updated_at",
                ]
            )

        self.product.refresh_from_db()

        self.assertEqual(self.product.stock_actual, 0)

    def test_queryset_update_cannot_change_stock(self):
        with self.assertRaises(ValidationError):
            Producto.objects.filter(pk=self.product.pk).update(stock_actual=7)

        self.product.refresh_from_db()

        self.assertEqual(self.product.stock_actual, 0)

    def test_kardex_service_remains_authorized_to_change_stock(self):
        movement = register_manual_entry(
            producto=self.product,
            cantidad=7,
            motivo="Ingreso oficial para validar protección de stock.",
            user=self.user,
        )

        self.product.refresh_from_db()

        self.assertEqual(movement.stock_antes, 0)
        self.assertEqual(movement.stock_despues, 7)
        self.assertEqual(self.product.stock_actual, 7)


class InventoryReadFilteringApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="inventory-read-filter-admin",
            email="inventory-read-filter-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.category = Categoria.objects.create(
            name="Categoría histórica",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="Modelo histórico original",
            codigo_sap="HIST-001",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_kardex_search_uses_historical_snapshots(self):
        movement = register_manual_entry(
            producto=self.product,
            cantidad=4,
            motivo="Movimiento para validar búsqueda histórica.",
            user=self.user,
        )

        self.product.refresh_from_db()

        new_category = Categoria.objects.create(
            name="Categoría actual",
            created_by=self.user,
            updated_by=self.user,
        )

        self.product.modelo = "Modelo actual corregido"
        self.product.codigo_sap = "ACTUAL-001"
        self.product.categoria = new_category
        self.product.save()

        response = self.client.get(
            "/api/inventory/kardex/",
            {"search": "Modelo histórico original"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["id"],
            movement.pk,
        )
        self.assertEqual(
            response.data["results"][0]["producto_modelo"],
            "Modelo histórico original",
        )

    def test_kardex_rejects_invalid_movement_type(self):
        response = self.client.get(
            "/api/inventory/kardex/",
            {"movement_type": "TIPO_INEXISTENTE"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn(
            "movement_type",
            response.data["error"]["details"],
        )

    def test_ppr_rejects_invalid_date_range(self):
        response = self.client.get(
            "/api/inventory/pendientes-por-recibir/",
            {
                "fecha_desde": "2026-07-07",
                "fecha_hasta": "2026-07-06",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn(
            "fecha_hasta",
            response.data["error"]["details"],
        )


class ProductCategoryAtomicApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="product-category-atomic-admin",
            email="product-category-atomic-admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.existing_category = Categoria.objects.create(
            name="Repuestos de Motor",
            created_by=self.user,
            updated_by=self.user,
        )

        self.existing_product = Producto.objects.create(
            categoria=self.existing_category,
            modelo="Producto con código ya utilizado",
            codigo_sap="SAP-ATOMIC-001",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            created_by=self.user,
            updated_by=self.user,
        )

    def test_product_creation_reuses_equivalent_category_name(self):
        response = self.client.post(
            "/api/inventory/productos/",
            {
                "categoria_nombre": "repuestos   de motor",
                "modelo": "Filtro de aceite industrial",
                "codigo_sap": "SAP-ATOMIC-002",
                "origen": ProductOrigin.COMPRADO,
                "stock_critico": 2,
                "controla_stock": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Categoria.objects.count(), 1)

        created_product = Producto.objects.get(
            codigo_sap_normalized="sap atomic 002",
        )

        self.assertEqual(
            created_product.categoria_id,
            self.existing_category.pk,
        )

    def test_new_category_is_rolled_back_when_product_creation_fails(self):
        category_name = "Categoría que no debe persistir"

        response = self.client.post(
            "/api/inventory/productos/",
            {
                "categoria_nombre": category_name,
                "modelo": "Producto con código duplicado",
                "codigo_sap": "SAP-ATOMIC-001",
                "origen": ProductOrigin.COMPRADO,
                "stock_critico": 0,
                "controla_stock": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertFalse(
            Categoria.objects.filter(name=category_name).exists(),
        )

        self.assertFalse(
            Producto.objects.filter(
                modelo="Producto con código duplicado",
            ).exists(),
        )

    def test_product_update_rejects_category_reassignment(self):
        destination_category = Categoria.objects.create(
            name="Categoría alternativa",
            created_by=self.user,
            updated_by=self.user,
        )

        for payload in [
            {"categoria": destination_category.pk},
            {"categoria_nombre": "Categoría creada desde edición"},
        ]:
            with self.subTest(payload=payload):
                response = self.client.patch(
                    f"/api/inventory/productos/{self.existing_product.pk}/",
                    payload,
                    format="json",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

                self.assertIn(
                    "categoria",
                    response.data["error"]["details"],
                )

        self.existing_product.refresh_from_db()

        self.assertEqual(
            self.existing_product.categoria_id,
            self.existing_category.pk,
        )

        self.assertFalse(
            Categoria.objects.filter(
                name="Categoría creada desde edición",
            ).exists(),
        )
