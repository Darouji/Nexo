from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.core.models import AuditAction, AuditLog, BaseStatus

User = get_user_model()


class AuthSessionAndSecurityTests(APITestCase):
    def setUp(self):
        self.admin_password = "StrongPass123!"

        self.admin = User.objects.create_superuser(
            username="Admin",
            email="admin@example.invalid",
            password=self.admin_password,
            role=UserRole.ADMINISTRADOR,
            status=BaseStatus.ACTIVO,
        )

        self.operativo = User.objects.create_user(
            username="Operativo",
            email="operativo@example.invalid",
            password="StrongPass123!",
            role=UserRole.OPERATIVO,
            status=BaseStatus.ACTIVO,
        )

    def authenticate_as(self, user):
        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        return token

    def test_public_health_check_is_available_without_token(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertIn("X-Request-ID", response)

    def test_request_id_can_be_sent_by_client(self):
        request_id = "nexo-test-request-id"

        response = self.client.get(
            "/api/health/",
            HTTP_X_REQUEST_ID=request_id,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["X-Request-ID"], request_id)

    def test_login_success_returns_token_user_access_and_expiration(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Admin",
                "password": self.admin_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn("token", response.data)
        self.assertEqual(response.data["token_type"], "Token")
        self.assertIn("token_created_at", response.data)
        self.assertIn("token_expires_at", response.data)
        self.assertIn("token_expires_in_seconds", response.data)

        self.assertEqual(response.data["user"]["username"], "Admin")
        self.assertEqual(response.data["user"]["role"], UserRole.ADMINISTRADOR)

        self.assertEqual(response.data["access"]["role"], UserRole.ADMINISTRADOR)
        self.assertTrue(response.data["access"]["is_management_role"])
        self.assertTrue(response.data["access"]["is_audit_role"])
        self.assertTrue(
            response.data["access"]["capabilities"]["inventory.manage_products"]
        )
        self.assertTrue(
            response.data["access"]["capabilities"]["inventory.export_official"]
        )
        self.assertTrue(
            response.data["access"]["capabilities"]["purchases.approve_order"]
        )
        self.assertTrue(
            response.data["access"]["capabilities"]["purchases.export_official"]
        )
        self.assertTrue(
            response.data["access"]["permissions"]["compras"]["can_view"]
        )
        self.assertTrue(
            any(
                item["module"] == "compras"
                for item in response.data["access"]["menu"]
            )
        )
        self.assertIn("permissions", response.data["access"])
        self.assertIn("menu", response.data["access"])

        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action=AuditAction.LOGIN,
                metadata__success=True,
            ).exists()
        )

    def test_login_missing_credentials_returns_uniform_error(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Admin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["success"], False)
        self.assertEqual(response.data["error"]["code"], "missing_credentials")
        self.assertIn("request_id", response.data)
        self.assertIn("X-Request-ID", response)

    def test_login_invalid_credentials_returns_uniform_error(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Admin",
                "password": "wrong-password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["success"], False)
        self.assertEqual(response.data["error"]["code"], "invalid_credentials")
        self.assertIn("request_id", response.data)

        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditAction.LOGIN,
                metadata__success=False,
                metadata__failure_type="invalid_credentials",
            ).exists()
        )

    def test_session_requires_authentication(self):
        response = self.client.get("/api/auth/session/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["success"], False)
        self.assertIn("request_id", response.data)

    def test_session_returns_current_user_access_menu_and_token_status(self):
        token = self.authenticate_as(self.admin)

        response = self.client.get("/api/auth/session/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(response.data["user"]["username"], "Admin")
        self.assertEqual(response.data["access"]["role"], UserRole.ADMINISTRADOR)
        self.assertIn("permissions", response.data["access"])
        self.assertIn("menu", response.data["access"])

        self.assertTrue(response.data["session"]["authenticated"])
        self.assertEqual(
            response.data["session"]["token_expire_hours"],
            settings.DRF_TOKEN_EXPIRE_HOURS,
        )
        self.assertIsNotNone(response.data["session"]["token_created_at"])
        self.assertIsNotNone(response.data["session"]["token_expires_at"])
        self.assertGreaterEqual(response.data["session"]["token_expires_in_seconds"], 0)

        self.assertTrue(Token.objects.filter(key=token.key).exists())

    def test_operational_user_can_receive_purchases_but_not_approve_or_export_official(self):
        self.authenticate_as(self.operativo)

        response = self.client.get("/api/auth/session/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        capabilities = response.data["access"]["capabilities"]
        purchase_permission = response.data["access"]["permissions"]["compras"]

        self.assertTrue(capabilities["purchases.view"])
        self.assertTrue(capabilities["purchases.receive_order"])
        self.assertFalse(capabilities["purchases.approve_order"])
        self.assertFalse(capabilities["purchases.export_official"])
        self.assertTrue(purchase_permission["can_view"])
        self.assertFalse(purchase_permission["can_create"])
        self.assertTrue(purchase_permission["can_update"])

    def test_expired_token_is_rejected_and_deleted(self):
        token = self.authenticate_as(self.admin)

        expired_created_at = timezone.now() - timedelta(
            hours=settings.DRF_TOKEN_EXPIRE_HOURS + 1
        )

        Token.objects.filter(pk=token.pk).update(created=expired_created_at)

        response = self.client.get("/api/auth/session/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["success"], False)
        self.assertFalse(Token.objects.filter(pk=token.pk).exists())

    def test_logout_deletes_current_token(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {
                "username": "Admin",
                "password": self.admin_password,
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        token_key = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token_key}")

        logout_response = self.client.post("/api/auth/logout/")

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(key=token_key).exists())

        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.admin,
                action=AuditAction.LOGOUT,
                metadata__success=True,
            ).exists()
        )

    def test_full_health_check_requires_audit_role(self):
        self.authenticate_as(self.operativo)

        response = self.client.get("/api/health/full/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["success"], False)

    def test_full_health_check_allows_admin(self):
        self.authenticate_as(self.admin)

        response = self.client.get("/api/health/full/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertIn("checks", response.data)
        self.assertIn("api", response.data["checks"])
        self.assertIn("database", response.data["checks"])
        self.assertIn("settings", response.data["checks"])

    def test_delete_user_deactivates_without_hard_delete(self):
        target = User.objects.create_user(
            username="UsuarioTemporal",
            email="temporal@example.invalid",
            password="StrongPass123!",
            role=UserRole.CONSULTA,
            status=BaseStatus.ACTIVO,
        )
        target_token = Token.objects.create(user=target)

        self.authenticate_as(self.admin)

        response = self.client.delete(f"/api/auth/users/{target.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        target.refresh_from_db()
        self.assertFalse(target.is_active)
        self.assertEqual(target.status, BaseStatus.INACTIVO)
        self.assertFalse(Token.objects.filter(pk=target_token.pk).exists())

        self.assertTrue(User.objects.filter(pk=target.pk).exists())

    def test_user_cannot_deactivate_itself(self):
        self.authenticate_as(self.admin)

        response = self.client.delete(f"/api/auth/users/{self.admin.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["success"], False)
        self.assertEqual(response.data["error"]["code"], "cannot_deactivate_self")

        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        self.assertEqual(self.admin.status, BaseStatus.ACTIVO)
