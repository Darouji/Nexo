from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.commercial.models import Area, Contacto, Minera, Subarea
from apps.core.models import AuditAction, BaseStatus, RecordChangeLog
from apps.inventory.models import (
    Categoria,
    KardexMovementType,
    MovimientoKardex,
    Producto,
)
from apps.sales.models import Venta, VentaAlertCode, VentaStatus
from apps.sales.serializers import VentaSerializer
from apps.sales.services import (
    annul_sale,
    concretar_sale,
    create_sale_with_details,
    replace_sale_details_with_differential_kardex,
)


class SalesServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="admin",
            email="admin@serkan.cl",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )

        self.minera = Minera.objects.create(
            name="Minera Test",
            created_by=self.user,
            updated_by=self.user,
        )
        self.area = Area.objects.create(
            minera=self.minera,
            name="Operaciones",
            created_by=self.user,
            updated_by=self.user,
        )
        self.subarea = Subarea.objects.create(
            area=self.area,
            name="Mantención",
            created_by=self.user,
            updated_by=self.user,
        )
        self.contacto = Contacto.objects.create(
            first_name="Carlos",
            last_name="Pérez",
            email="carlos.perez@example.com",
            phone="+56911111111",
            subarea=self.subarea,
            created_by=self.user,
            updated_by=self.user,
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
            stock_actual=0,
            stock_critico=0,
            controla_stock=False,
            created_by=self.user,
            updated_by=self.user,
        )

    def sale_data(self, **overrides):
        data = {
            "minera": self.minera,
            "area": self.area,
            "subarea": self.subarea,
            "contacto": self.contacto,
            "factura_numero": "F-100",
            "orden_compra": "OC-100",
            "numero_guia_hes": "G-100",
        }
        data.update(overrides)
        return data

    def authenticated_client(self, user=None):
        client = APIClient()
        client.force_authenticate(user=user or self.user)
        return client

    def response_results(self, response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]

        return response.data

    def test_create_sale_discounts_stock_and_creates_kardex_exit(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 3,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        self.producto.refresh_from_db()
        venta.refresh_from_db()

        self.assertEqual(venta.sale_status, VentaStatus.INGRESADA)
        self.assertTrue(venta.stock_descontado)
        self.assertEqual(self.producto.stock_actual, 7)
        self.assertEqual(venta.valor_neto, Decimal("3000.00"))
        self.assertEqual(venta.iva, Decimal("570.00"))
        self.assertEqual(venta.total, Decimal("3570.00"))

        movement = MovimientoKardex.objects.get(
            movement_type=KardexMovementType.SALIDA_VENTA
        )
        self.assertEqual(movement.producto, self.producto)
        self.assertEqual(movement.cantidad, -3)
        self.assertEqual(movement.stock_antes, 10)
        self.assertEqual(movement.stock_despues, 7)
        self.assertEqual(movement.reference_object_id, str(venta.pk))

    def test_create_sale_with_insufficient_stock_fails_without_partial_data(self):
        with self.assertRaises(ValidationError) as context:
            create_sale_with_details(
                sale_data=self.sale_data(),
                details_data=[
                    {
                        "producto": self.producto,
                        "cantidad": 11,
                        "valor_unitario": Decimal("1000.00"),
                    }
                ],
                user=self.user,
            )

        self.producto.refresh_from_db()

        self.assertEqual(Venta.objects.count(), 0)
        self.assertEqual(MovimientoKardex.objects.count(), 0)
        self.assertEqual(self.producto.stock_actual, 10)

        error = context.exception.message_dict
        self.assertEqual(error["code"][0], VentaAlertCode.STOCK_INSUFICIENTE)
        self.assertEqual(int(error["cantidad_solicitada"][0]), 11)
        self.assertEqual(int(error["stock_disponible"][0]), 10)

    def test_create_sale_groups_stock_by_product_before_validating(self):
        with self.assertRaises(ValidationError) as context:
            create_sale_with_details(
                sale_data=self.sale_data(),
                details_data=[
                    {
                        "producto": self.producto,
                        "cantidad": 6,
                        "valor_unitario": Decimal("1000.00"),
                    },
                    {
                        "producto": self.producto,
                        "cantidad": 5,
                        "valor_unitario": Decimal("1000.00"),
                    },
                ],
                user=self.user,
            )

        self.producto.refresh_from_db()

        self.assertEqual(Venta.objects.count(), 0)
        self.assertEqual(MovimientoKardex.objects.count(), 0)
        self.assertEqual(self.producto.stock_actual, 10)

        error = context.exception.message_dict
        self.assertEqual(error["code"][0], VentaAlertCode.STOCK_INSUFICIENTE)
        self.assertEqual(int(error["cantidad_solicitada"][0]), 11)

    def test_non_stock_product_does_not_create_kardex(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.servicio,
                    "cantidad": 1,
                    "valor_unitario": Decimal("5000.00"),
                }
            ],
            user=self.user,
        )

        self.servicio.refresh_from_db()
        venta.refresh_from_db()

        self.assertFalse(venta.stock_descontado)
        self.assertEqual(self.servicio.stock_actual, 0)
        self.assertEqual(MovimientoKardex.objects.count(), 0)

    def test_annul_sale_reverses_stock_and_audits_status_change(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 4,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        annulled_sale = annul_sale(
            venta=venta,
            reason="Error de digitación controlado.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        annulled_sale.refresh_from_db()

        self.assertEqual(annulled_sale.sale_status, VentaStatus.ANULADA)
        self.assertEqual(annulled_sale.status, BaseStatus.ANULADO)
        self.assertFalse(annulled_sale.stock_descontado)
        self.assertEqual(
            annulled_sale.anulacion_motivo,
            "Error de digitación controlado.",
        )
        self.assertEqual(self.producto.stock_actual, 10)

        self.assertEqual(
            MovimientoKardex.objects.filter(
                movement_type=KardexMovementType.SALIDA_VENTA
            ).count(),
            1,
        )
        self.assertEqual(
            MovimientoKardex.objects.filter(
                movement_type=KardexMovementType.REVERSA_ANULACION
            ).count(),
            1,
        )
        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(annulled_sale.pk),
                action=AuditAction.ANULAR,
                field_name="sale_status",
            ).exists()
        )

    def test_concretar_sale_does_not_discount_stock_again(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        concreted_sale = concretar_sale(venta=venta, user=self.user)

        self.producto.refresh_from_db()
        concreted_sale.refresh_from_db()

        self.assertEqual(concreted_sale.sale_status, VentaStatus.CONCRETADA)
        self.assertEqual(self.producto.stock_actual, 8)
        self.assertEqual(MovimientoKardex.objects.count(), 1)
        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(concreted_sale.pk),
                action=AuditAction.CAMBIAR_ESTADO,
                field_name="sale_status",
            ).exists()
        )

    def test_missing_documents_create_specific_alerts(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="",
                numero_guia_hes="",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        alert_codes = set(
            venta.alerts.filter(is_active=True).values_list("code", flat=True)
        )

        self.assertIn(VentaAlertCode.FALTA_FACTURA, alert_codes)
        self.assertIn(VentaAlertCode.FALTA_GUIA, alert_codes)

    def test_duplicate_invoice_creates_blocking_alert(self):
        create_sale_with_details(
            sale_data=self.sale_data(factura_numero="F-DUP"),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        second_sale = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-DUP",
                orden_compra="OC-DUP-2",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        duplicated_invoice_alert = second_sale.alerts.get(
            code=VentaAlertCode.FACTURA_DUPLICADA,
            is_active=True,
        )

        self.assertEqual(
            duplicated_invoice_alert.message,
            "Factura posiblemente duplicada",
        )

    def test_replace_sale_details_with_higher_quantity_creates_negative_difference(
        self,
    ):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        updated_sale = replace_sale_details_with_differential_kardex(
            venta=venta,
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 5,
                    "valor_unitario": Decimal("1200.00"),
                }
            ],
            reason="Corrección de cantidad solicitada por cliente.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        updated_sale.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 5)
        self.assertEqual(updated_sale.valor_neto, Decimal("6000.00"))
        self.assertEqual(updated_sale.iva, Decimal("1140.00"))
        self.assertEqual(updated_sale.total, Decimal("7140.00"))

        self.assertEqual(
            updated_sale.detalles.filter(status=BaseStatus.ACTIVO).count(),
            1,
        )
        self.assertEqual(
            updated_sale.detalles.filter(status=BaseStatus.ARCHIVADO).count(),
            1,
        )

        difference_movement = MovimientoKardex.objects.get(
            movement_type=KardexMovementType.AJUSTE_INVENTARIO
        )
        self.assertEqual(difference_movement.cantidad, -3)
        self.assertEqual(difference_movement.stock_antes, 8)
        self.assertEqual(difference_movement.stock_despues, 5)

        self.assertTrue(
            RecordChangeLog.objects.filter(
                object_id=str(updated_sale.pk),
                action=AuditAction.EDITAR,
                field_name="detalles",
            ).exists()
        )

    def test_replace_sale_details_with_lower_quantity_returns_stock_difference(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 5,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        updated_sale = replace_sale_details_with_differential_kardex(
            venta=venta,
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            reason="Corrección de cantidad por ajuste comercial.",
            user=self.user,
        )

        self.producto.refresh_from_db()
        updated_sale.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 8)
        self.assertEqual(updated_sale.valor_neto, Decimal("2000.00"))

        difference_movement = MovimientoKardex.objects.get(
            movement_type=KardexMovementType.AJUSTE_INVENTARIO
        )
        self.assertEqual(difference_movement.cantidad, 3)
        self.assertEqual(difference_movement.stock_antes, 5)
        self.assertEqual(difference_movement.stock_despues, 8)

    def test_replace_sale_details_with_insufficient_difference_rolls_back(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 8,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        with self.assertRaises(ValidationError) as context:
            replace_sale_details_with_differential_kardex(
                venta=venta,
                details_data=[
                    {
                        "producto": self.producto,
                        "cantidad": 11,
                        "valor_unitario": Decimal("1000.00"),
                    }
                ],
                reason="Intento de aumento sin stock suficiente.",
                user=self.user,
            )

        self.producto.refresh_from_db()
        venta.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 2)
        self.assertEqual(
            venta.detalles.filter(status=BaseStatus.ACTIVO).count(),
            1,
        )
        self.assertEqual(
            venta.detalles.filter(status=BaseStatus.ARCHIVADO).count(),
            0,
        )
        self.assertEqual(
            MovimientoKardex.objects.filter(
                movement_type=KardexMovementType.AJUSTE_INVENTARIO
            ).count(),
            0,
        )

        error = context.exception.message_dict
        self.assertEqual(error["code"][0], VentaAlertCode.STOCK_INSUFICIENTE)
        self.assertEqual(int(error["cantidad_solicitada"][0]), 3)
        self.assertEqual(int(error["stock_disponible"][0]), 2)

    def test_venta_serializer_returns_only_active_details_after_replacement(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        updated_sale = replace_sale_details_with_differential_kardex(
            venta=venta,
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 5,
                    "valor_unitario": Decimal("1200.00"),
                }
            ],
            reason="Corrección de líneas para validar respuesta API.",
            user=self.user,
        )

        updated_sale.refresh_from_db()

        serialized_data = VentaSerializer(updated_sale).data

        self.assertEqual(len(serialized_data["detalles"]), 1)
        self.assertEqual(serialized_data["detalles"][0]["cantidad"], 5)
        self.assertEqual(
            serialized_data["detalles"][0]["status"],
            BaseStatus.ACTIVO,
        )
        self.assertEqual(
            updated_sale.detalles.filter(status=BaseStatus.ARCHIVADO).count(),
            1,
        )

    def test_api_create_sale_discounts_stock_and_returns_active_details(self):
        client = self.authenticated_client()

        response = client.post(
            reverse("venta-list"),
            data={
                "minera": self.minera.pk,
                "area": self.area.pk,
                "subarea": self.subarea.pk,
                "contacto": self.contacto.pk,
                "factura_numero": "F-API-001",
                "orden_compra": "OC-API-001",
                "numero_guia_hes": "G-API-001",
                "lineas": [
                    {
                        "producto": self.producto.pk,
                        "cantidad": 3,
                        "valor_unitario": "1000.00",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.producto.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 7)
        self.assertEqual(response.data["valor_neto"], "3000.00")
        self.assertEqual(response.data["iva"], "570.00")
        self.assertEqual(response.data["total"], "3570.00")
        self.assertEqual(len(response.data["detalles"]), 1)
        self.assertEqual(response.data["detalles"][0]["cantidad"], 3)

    def test_api_update_sale_lines_uses_differential_kardex(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-API-002",
                orden_compra="OC-API-002",
                numero_guia_hes="G-API-002",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.post(
            reverse("venta-actualizar-lineas", args=[venta.pk]),
            data={
                "motivo": "Corrección API de líneas.",
                "lineas": [
                    {
                        "producto": self.producto.pk,
                        "cantidad": 5,
                        "valor_unitario": "1200.00",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.producto.refresh_from_db()
        venta.refresh_from_db()

        self.assertEqual(self.producto.stock_actual, 5)
        self.assertEqual(response.data["valor_neto"], "6000.00")
        self.assertEqual(response.data["iva"], "1140.00")
        self.assertEqual(response.data["total"], "7140.00")
        self.assertEqual(len(response.data["detalles"]), 1)
        self.assertEqual(response.data["detalles"][0]["cantidad"], 5)

        self.assertEqual(
            MovimientoKardex.objects.filter(
                movement_type=KardexMovementType.AJUSTE_INVENTARIO,
            ).count(),
            1,
        )

    def test_api_consulta_user_cannot_update_sale_lines(self):
        consulta_user = User.objects.create_user(
            username="consulta",
            email="consulta@serkan.cl",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )

        venta = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-API-003",
                orden_compra="OC-API-003",
                numero_guia_hes="G-API-003",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client(consulta_user)

        response = client.post(
            reverse("venta-actualizar-lineas", args=[venta.pk]),
            data={
                "motivo": "Intento no autorizado.",
                "lineas": [
                    {
                        "producto": self.producto.pk,
                        "cantidad": 2,
                        "valor_unitario": "1000.00",
                    }
                ],
            },
            format="json",
        )

        self.producto.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.producto.stock_actual, 9)
        self.assertEqual(
            MovimientoKardex.objects.filter(
                movement_type=KardexMovementType.AJUSTE_INVENTARIO,
            ).count(),
            0,
        )

    def test_api_sale_traceability_returns_changes_and_kardex_movements(self):
        venta = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-TRACE-001",
                orden_compra="OC-TRACE-001",
                numero_guia_hes="G-TRACE-001",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        replace_sale_details_with_differential_kardex(
            venta=venta,
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 5,
                    "valor_unitario": Decimal("1200.00"),
                }
            ],
            reason="Corrección para trazabilidad API.",
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.get(reverse("venta-trazabilidad", args=[venta.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("venta", response.data)
        self.assertIn("cambios", response.data)
        self.assertIn("movimientos_kardex", response.data)

        self.assertGreaterEqual(len(response.data["cambios"]), 1)
        self.assertEqual(len(response.data["movimientos_kardex"]), 2)

        change_fields = {change["field_name"] for change in response.data["cambios"]}
        self.assertIn("detalles", change_fields)

    def test_api_consulta_user_cannot_view_sale_traceability(self):
        consulta_user = User.objects.create_user(
            username="consulta_trazabilidad",
            email="consulta.trazabilidad@serkan.cl",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )

        venta = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-TRACE-002",
                orden_compra="OC-TRACE-002",
                numero_guia_hes="G-TRACE-002",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client(consulta_user)

        response = client.get(reverse("venta-trazabilidad", args=[venta.pk]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_list_sales_filters_by_sale_status(self):
        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-FILTER-001",
                orden_compra="OC-FILTER-001",
                numero_guia_hes="G-FILTER-001",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        concreted_sale = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-FILTER-002",
                orden_compra="OC-FILTER-002",
                numero_guia_hes="G-FILTER-002",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )
        concretar_sale(venta=concreted_sale, user=self.user)

        client = self.authenticated_client()

        response = client.get(
            reverse("venta-list"),
            {"sale_status": VentaStatus.CONCRETADA},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result_ids = {result["id"] for result in self.response_results(response)}

        self.assertEqual(result_ids, {concreted_sale.pk})

    def test_api_list_sales_filters_by_blocking_validation_summary(self):
        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-BLOCKING-FILTER",
                orden_compra="OC-BLOCKING-FILTER-001",
                numero_guia_hes="G-BLOCKING-FILTER-001",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        blocked_sale = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-BLOCKING-FILTER",
                orden_compra="OC-BLOCKING-FILTER-002",
                numero_guia_hes="G-BLOCKING-FILTER-002",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.get(
            reverse("venta-list"),
            {"validation_summary": "BLOQUEANTE"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result_ids = {result["id"] for result in self.response_results(response)}

        self.assertEqual(result_ids, {blocked_sale.pk})

    def test_api_list_sales_filters_by_missing_invoice(self):
        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-HAS-INVOICE",
                orden_compra="OC-HAS-INVOICE",
                numero_guia_hes="G-HAS-INVOICE",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        sale_without_invoice = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="",
                orden_compra="OC-WITHOUT-INVOICE",
                numero_guia_hes="G-WITHOUT-INVOICE",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.get(
            reverse("venta-list"),
            {"has_factura": "false"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        result_ids = {result["id"] for result in self.response_results(response)}

        self.assertEqual(result_ids, {sale_without_invoice.pk})

    def test_api_sales_summary_returns_kpis(self):
        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-SUMMARY-001",
                orden_compra="OC-SUMMARY-001",
                numero_guia_hes="G-SUMMARY-001",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="",
                orden_compra="OC-SUMMARY-002",
                numero_guia_hes="",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        annulled_sale = create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-SUMMARY-003",
                orden_compra="OC-SUMMARY-003",
                numero_guia_hes="G-SUMMARY-003",
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )
        annul_sale(
            venta=annulled_sale,
            reason="Anulación para validar resumen.",
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.get(reverse("venta-resumen"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ventas"]["total"], 3)
        self.assertEqual(response.data["ventas"]["vigentes"], 2)
        self.assertEqual(
            response.data["ventas"]["por_estado"][VentaStatus.INGRESADA],
            2,
        )
        self.assertEqual(
            response.data["ventas"]["por_estado"][VentaStatus.ANULADA],
            1,
        )
        self.assertEqual(response.data["montos"]["valor_neto"], "3000.00")
        self.assertEqual(response.data["montos"]["iva"], "570.00")
        self.assertEqual(response.data["montos"]["total"], "3570.00")
        self.assertEqual(response.data["documentos"]["sin_factura"], 1)
        self.assertEqual(response.data["documentos"]["sin_guia"], 1)
        self.assertEqual(response.data["alertas"]["ventas_con_alertas"], 1)

    def test_api_sales_summary_respects_filters(self):
        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-SUMMARY-FILTER-001",
                orden_compra="OC-SUMMARY-FILTER-001",
                numero_guia_hes="G-SUMMARY-FILTER-001",
                fecha_venta=date(2026, 5, 30),
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 1,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        create_sale_with_details(
            sale_data=self.sale_data(
                factura_numero="F-SUMMARY-FILTER-002",
                orden_compra="OC-SUMMARY-FILTER-002",
                numero_guia_hes="G-SUMMARY-FILTER-002",
                fecha_venta=date(2026, 6, 15),
            ),
            details_data=[
                {
                    "producto": self.producto,
                    "cantidad": 2,
                    "valor_unitario": Decimal("1000.00"),
                }
            ],
            user=self.user,
        )

        client = self.authenticated_client()

        response = client.get(
            reverse("venta-resumen"),
            {
                "fecha_desde": "2026-06-01",
                "fecha_hasta": "2026-06-30",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["ventas"]["total"], 1)
        self.assertEqual(response.data["montos"]["valor_neto"], "2000.00")
        self.assertEqual(response.data["montos"]["total"], "2380.00")
