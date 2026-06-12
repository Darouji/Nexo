from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    label = "accounts"

    def ready(self):
        # Importa extensiones OpenAPI para que drf-spectacular detecte
        # correctamente la autenticación por token expirable.
        from . import schema  # noqa: F401
