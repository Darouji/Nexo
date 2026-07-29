from django.apps import AppConfig


class CommercialConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.commercial"
    def ready(self):
        from . import grid_definitions  # noqa: F401
