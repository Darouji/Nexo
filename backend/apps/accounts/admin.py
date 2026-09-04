from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = [
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "status",
        "is_active",
        "is_staff",
        "last_login",
    ]
    list_filter = [
        "role",
        "status",
        "is_active",
        "is_staff",
        "is_superuser",
    ]
    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "phone",
        "position",
        "department",
    ]
    ordering = ["username"]

    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Datos internos NEXO",
            {
                "fields": (
                    "role",
                    "status",
                    "phone",
                    "position",
                    "department",
                    "observations",
                    "created_by",
                    "updated_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (
            "Datos internos NEXO",
            {
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "status",
                    "phone",
                    "position",
                    "department",
                )
            },
        ),
    )

    readonly_fields = [
        "created_at",
        "updated_at",
    ]