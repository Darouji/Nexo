from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole

from .models import (
    AuditAction,
    AuditLog,
    ColumnDisplayName,
    GridPreference,
    SavedView,
)


class GridPreferenceApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="grid-user",
            email="grid-user@example.invalid",
            password="test-pass-123",
            role=UserRole.OPERATIVO,
        )
        self.other_user = User.objects.create_user(
            username="grid-other-user",
            email="grid-other-user@example.invalid",
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


class SavedViewApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="saved-view-user",
            email="saved-view-user@example.invalid",
            password="test-pass-123",
            role=UserRole.OPERATIVO,
        )
        self.other_user = User.objects.create_user(
            username="saved-view-other",
            email="saved-view-other@example.invalid",
            password="test-pass-123",
            role=UserRole.CONSULTA,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = "/api/grid/views/inventory.products/"
        self.config = {
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
                    "hidden": False,
                    "pinned": None,
                },
            ],
            "page_size": 50,
            "sort": {"field": "stock_actual", "direction": "asc"},
            "filters": {
                "search": "motor",
                "category": "",
                "status": "ACTIVO",
                "stock_control": "true",
                "stock_status": "BAJO_MINIMO",
                "column_filters": [
                    {
                        "field": "codigo_sap",
                        "operator": "startsWith",
                        "value": "SAP-",
                    }
                ],
            },
        }

    def test_personal_views_are_named_isolated_and_can_be_default(self):
        created = self.client.post(
            self.url,
            {
                "name": "Productos críticos",
                "is_default": True,
                "config": self.config,
            },
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["name"], "Productos críticos")
        self.assertTrue(created.data["is_default"])
        self.assertEqual(created.data["config"]["definition_version"], 1)
        self.assertFalse(
            AuditLog.objects.filter(
                metadata__path="/api/grid/views/inventory.products/"
            ).exists()
        )

        listed = self.client.get(self.url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listed.data), 1)

        self.client.force_authenticate(user=self.other_user)
        other_list = self.client.get(self.url)
        self.assertEqual(other_list.status_code, status.HTTP_200_OK)
        self.assertEqual(other_list.data, [])

    def test_user_cannot_update_or_delete_another_users_view(self):
        view = SavedView.objects.create(
            user=self.other_user,
            module="inventory",
            model_name="producto",
            name="Vista privada ajena",
            config=self.config,
            created_by=self.other_user,
            updated_by=self.other_user,
        )
        detail_url = f"{self.url}{view.pk}/"

        update_response = self.client.put(
            detail_url,
            {
                "name": "Intento de cambio",
                "is_default": False,
                "config": self.config,
            },
            format="json",
        )
        delete_response = self.client.delete(detail_url)

        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(SavedView.objects.filter(pk=view.pk).exists())

    def test_duplicate_name_and_unknown_filters_are_rejected(self):
        payload = {
            "name": "Mi vista",
            "is_default": False,
            "config": self.config,
        }
        self.assertEqual(
            self.client.post(self.url, payload, format="json").status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            self.client.post(self.url, payload, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        invalid_config = {
            **self.config,
            "filters": {
                **self.config["filters"],
                "filtro_no_permitido": "secreto",
            },
        }
        invalid = self.client.post(
            self.url,
            {
                "name": "Vista inválida",
                "is_default": False,
                "config": invalid_config,
            },
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)


class GlobalColumnLabelApiTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="grid-label-manager",
            email="grid-label-manager@example.invalid",
            password="test-pass-123",
            role=UserRole.RRHH,
        )
        self.operative = User.objects.create_user(
            username="grid-label-operative",
            email="grid-label-operative@example.invalid",
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
