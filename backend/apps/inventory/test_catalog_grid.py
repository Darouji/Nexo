import csv
from io import StringIO

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.core.models import AuditAction, AuditLog

from .models import Categoria, Producto, ProductOrigin


class CatalogGridApiTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="catalog-grid-manager",
            email="catalog-grid-manager@example.invalid",
            password="test-pass-123",
            role=UserRole.ADMINISTRADOR,
        )
        self.reader = User.objects.create_user(
            username="catalog-grid-reader",
            email="catalog-grid-reader@example.invalid",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )
        self.category = Categoria.objects.create(
            name="Sensores",
            created_by=self.manager,
            updated_by=self.manager,
        )
        self.product = Producto.objects.create(
            categoria=self.category,
            modelo="=MODELO-PELIGROSO",
            codigo_sap="SAP-GRID-001",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            stock_critico=3,
            created_by=self.manager,
            updated_by=self.manager,
        )
        Producto.objects.create(
            categoria=self.category,
            modelo="Gateway seguro",
            codigo_sap="SAP-GRID-002",
            origen=ProductOrigin.COMPRADO,
            controla_stock=True,
            stock_critico=8,
            created_by=self.manager,
            updated_by=self.manager,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.reader)

    def test_typed_grid_filter_is_applied_before_pagination(self):
        response = self.client.get(
            "/api/inventory/productos/",
            {
                "grid_filters": (
                    '[{"field":"stock_critico","operator":"greaterThan",'
                    '"value":5}]'
                ),
                "page_size": 1,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["codigo_sap"], "SAP-GRID-002")

    def test_unknown_grid_filter_is_rejected(self):
        response = self.client.get(
            "/api/inventory/productos/",
            {
                "grid_filters": (
                    '[{"field":"campo_privado","operator":"contains",'
                    '"value":"x"}]'
                )
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("grid_filters", response.data["error"]["details"])

    def test_view_export_neutralizes_formulas_and_is_audited(self):
        response = self.client.get(
            "/api/inventory/productos/export/",
            {
                "mode": "view",
                "file_format": "csv",
                "columns": "modelo,codigo_sap",
                "search": "PELIGROSO",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = list(csv.reader(StringIO(response.content.decode("utf-8-sig"))))
        self.assertEqual(rows[1][0], "'=MODELO-PELIGROSO")
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.reader,
                action=AuditAction.EXPORTAR,
                metadata__mode="view",
                metadata__row_count=1,
            ).exists()
        )

    def test_export_rejects_empty_filtered_results(self):
        response = self.client.get(
            "/api/inventory/productos/export/",
            {"mode": "view", "file_format": "xlsx", "search": "SIN-RESULTADOS"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No hay resultados para exportar", str(response.data))
        self.assertFalse(
            AuditLog.objects.filter(
                actor=self.reader,
                action=AuditAction.EXPORTAR,
            ).exists()
        )

    def test_official_export_requires_management_role(self):
        response = self.client.get(
            "/api/inventory/productos/export/",
            {"mode": "official", "file_format": "xlsx"},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.manager)
        allowed = self.client.get(
            "/api/inventory/productos/export/",
            {"mode": "official", "file_format": "xlsx"},
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertGreater(len(allowed.content), 100)
