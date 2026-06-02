from django.contrib import admin

from .models import (
    AreaCliente,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
)


@admin.register(GrupoEmpresarial)
class GrupoEmpresarialAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "description")
    ordering = ("name",)


@admin.register(Minera)
class MineraAdmin(admin.ModelAdmin):
    list_display = ("name", "business_group", "rut", "status", "created_at", "updated_at")
    list_filter = ("status", "business_group")
    search_fields = ("name", "rut", "observations", "business_group__name")
    ordering = ("name",)


@admin.register(EmpresaCliente)
class EmpresaClienteAdmin(admin.ModelAdmin):
    list_display = ("name", "rut", "mining_company", "email", "phone", "status")
    list_filter = ("status", "mining_company", "mining_company__business_group")
    search_fields = (
        "name",
        "rut",
        "email",
        "phone",
        "address",
        "observations",
        "mining_company__name",
        "mining_company__business_group__name",
    )
    ordering = ("name",)


@admin.register(AreaCliente)
class AreaClienteAdmin(admin.ModelAdmin):
    list_display = ("name", "company", "location", "status")
    list_filter = ("status", "company")
    search_fields = ("name", "location", "description", "company__name")
    ordering = ("company__name", "name")


@admin.register(ContactoCliente)
class ContactoClienteAdmin(admin.ModelAdmin):
    list_display = (
        "first_name",
        "last_name",
        "company",
        "area",
        "position",
        "email",
        "phone",
        "status",
    )
    list_filter = (
        "status",
        "company",
        "area",
    )
    search_fields = (
        "first_name",
        "last_name",
        "position",
        "email",
        "phone",
        "shift",
        "observations",
        "company__name",
        "area__name",
    )
    ordering = ("last_name", "first_name")