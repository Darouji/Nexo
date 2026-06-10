from django.contrib import admin

from .models import Collaborator


@admin.register(Collaborator)
class CollaboratorAdmin(admin.ModelAdmin):
    list_display = [
        "full_name",
        "rut",
        "email",
        "position",
        "department",
        "user",
        "status",
        "updated_at",
    ]
    list_filter = [
        "status",
        "department",
        "position",
        "created_at",
        "updated_at",
    ]
    search_fields = [
        "rut",
        "rut_normalized",
        "first_name",
        "last_name",
        "full_name_normalized",
        "email",
        "email_normalized",
        "phone",
        "position",
        "department",
        "user__username",
        "user__email",
    ]
    ordering = [
        "last_name",
        "first_name",
    ]
    readonly_fields = [
        "rut_normalized",
        "full_name_normalized",
        "email_normalized",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    ]

    fieldsets = [
        (
            "Identificación",
            {
                "fields": [
                    "rut",
                    "rut_normalized",
                    "first_name",
                    "last_name",
                    "full_name_normalized",
                    "email",
                    "email_normalized",
                    "phone",
                ]
            },
        ),
        (
            "Datos internos SERKAN",
            {
                "fields": [
                    "position",
                    "department",
                    "shift",
                    "start_date",
                    "end_date",
                    "status",
                    "observations",
                ]
            },
        ),
        (
            "Usuario vinculado",
            {
                "fields": [
                    "user",
                ]
            },
        ),
        (
            "Trazabilidad",
            {
                "fields": [
                    "created_at",
                    "updated_at",
                    "created_by",
                    "updated_by",
                ]
            },
        ),
    ]

    @admin.display(description="Nombre completo")
    def full_name(self, obj):
        return obj.full_name

    def save_model(self, request, obj, form, change):
        if not change and not obj.created_by:
            obj.created_by = request.user

        obj.updated_by = request.user
        super().save_model(request, obj, form, change)