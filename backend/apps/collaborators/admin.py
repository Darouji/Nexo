from django.contrib import admin

from .models import Collaborator


@admin.register(Collaborator)
class CollaboratorAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "rut",
        "position",
        "area",
        "email",
        "phone",
        "status",
        "updated_at",
    ]
    list_filter = [
        "status",
        "area",
        "position",
    ]
    search_fields = [
        "rut",
        "first_name",
        "last_name",
        "email",
        "phone",
        "position",
        "area",
    ]
    ordering = [
        "last_name",
        "first_name",
    ]
    readonly_fields = [
        "created_at",
        "updated_at",
    ]

    @admin.display(description="Nombre completo")
    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()