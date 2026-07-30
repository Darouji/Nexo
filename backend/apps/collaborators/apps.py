from django.apps import AppConfig


class CollaboratorsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.collaborators"

    def ready(self):
        from . import grid_definitions  # noqa: F401