from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole

from .models import AuditAction, AuditLog, ColumnDisplayName, GridPreference


class GridPreferenceApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="grid-user",
            email="grid-user@serkan.cl",
            password="test-pass-123",
            role=UserRole.OPERATIVO,
        )
        self.other_user = User.objects.create_user(
            username="grid-other-user",
            email="grid-other-user@serkan.cl",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_preference_is_isolated_by_user_and_uses_optimistic_revision(self):
        payload = {
            "revision": 0,
            "definition_version": 1,
            "config": {
                "columns": [
                    {
                        "field_key": "modelo",
                        "width": 320,
                        "hidden": False,
                        "pinned": "left",
                    },
                    {
                        "field_key": "codigo_sap",
                        "width": 150,
                        "hidden": True,
                        "pinned": None,
                    },
                ],
                "page_size": 50,
            },
        }

        created = self.client.put(
            "/api/grid/preferences/inventory.products/",
            payload,
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_200_OK)
        self.assertEqual(created.data["revision"], 1)
        self.assertEqual(created.data["config"]["page_size"], 50)

        conflict = self.client.put(
            "/api/grid/preferences/inventory.products/",
            payload,
            format="json",
        )
        self.assertEqual(conflict.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(conflict.data["error"]["code"], "grid_preference_conflict")

        self.client.force_authenticate(user=self.other_user)
        other_response = self.client.get(
            "/api/grid/preferences/inventory.products/"
        )
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.data["revision"], 0)

    def test_definition_change_migrates_known_columns_and_restores_required_one(self):
        preference = GridPreference.objects.create(
            user=self.user,
            grid_key="inventory.products",
            definition_version=0,
            revision=2,
            config={
                "columns": [
                    {
                        "field_key": "columna_eliminada",
                        "width": 200,
                        "hidden": False,
                        "pinned": None,
                    },
                    {
                        "field_key": "modelo",
                        "width": 280,
                        "hidden": True,
                        "pinned": None,
                    },
                ],
                "page_size": 25,
            },
        )

        response = self.client.get("/api/grid/preferences/inventory.products/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["definition_version"], 1)
        self.assertEqual(response.data["revision"], 3)
        self.assertEqual(
            response.data["config"]["columns"],
            [
                {
                    "field_key": "modelo",
                    "width": 280,
                    "hidden": False,
                    "pinned": None,
                }
            ],
        )

        preference.refresh_from_db()
        self.assertEqual(preference.definition_version, 1)


class GlobalColumnLabelApiTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="grid-label-manager",
            email="grid-label-manager@serkan.cl",
            password="test-pass-123",
            role=UserRole.RRHH,
        )
        self.operative = User.objects.create_user(
            username="grid-label-operative",
            email="grid-label-operative@serkan.cl",
            password="test-pass-123",
            role=UserRole.OPERATIVO,
        )
        self.client = APIClient()

    def test_management_role_renames_globally_without_changing_technical_key(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.put(
            "/api/grid/labels/inventory.products/modelo/",
            {
                "visible_name": "Equipo / Modelo",
                "reason": "Nombre acordado para toda la empresa.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["field_key"], "modelo")
        self.assertEqual(response.data["scope"], "organization")

        override = ColumnDisplayName.objects.get(field_key="modelo")
        self.assertEqual(override.visible_name, "Equipo / Modelo")
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditAction.RENOMBRAR,
                actor=self.manager,
                metadata__field_key="modelo",
                metadata__scope="organization",
            ).exists()
        )

        self.client.force_authenticate(user=self.operative)
        definition = self.client.get(
            "/api/grid/definitions/inventory.products/"
        )
        model_column = next(
            column
            for column in definition.data["columns"]
            if column["field_key"] == "modelo"
        )
        self.assertEqual(model_column["visible_name"], "Equipo / Modelo")
        self.assertEqual(model_column["system_label"], "Producto / Modelo")
        self.assertFalse(definition.data["permissions"]["can_rename_global"])

    def test_operative_cannot_rename_global_label(self):
        self.client.force_authenticate(user=self.operative)
        response = self.client.put(
            "/api/grid/labels/inventory.products/modelo/",
            {
                "visible_name": "Nombre no autorizado",
                "reason": "Intento que debe ser rechazado.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(ColumnDisplayName.objects.exists())
