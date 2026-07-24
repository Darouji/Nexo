from django.apps import AppConfig


class PurchasesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.purchases"
    verbose_name = "Compras"

    def ready(self):
        from . import grid_definitions  # noqa: F401
