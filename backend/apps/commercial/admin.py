from django.contrib import admin

from .models import (
    Ciudad,
    AreaCliente,
    SubAreaCliente,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
)

@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "status", "created_at", "updated_at")
    list_filter = ("status", "region")
    search_fields = ("name", "region")
    ordering = ("name",)

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
    list_display = ("name", "rut", "city", "mining_company", "email", "phone", "status")
    list_filter = ("status", "city", "mining_company", "mining_company__business_group")
    search_fields = (
        "name",
        "rut",
        "email",
        "phone",
        "city__name",
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

@admin.register(SubAreaCliente)
class SubAreaClienteAdmin(admin.ModelAdmin):
    list_display = ("name", "area", "get_company", "status")
    list_filter = ("status", "area", "area__company")
    search_fields = ("name", "description", "area__name", "area__company__name")
    ordering = ("area__company__name", "area__name", "name")

    def get_company(self, obj):
        return obj.area.company

    get_company.short_description = "Empresa"


@admin.register(ContactoCliente)
class ContactoClienteAdmin(admin.ModelAdmin):
    list_display = (
        "city",
        "first_name",
        "last_name",
        "company",
        "area",
        "subarea",
        "position",
        "email",
        "phone",
        "shift_mode",
        "status",
    )
    list_filter = (
        "status",
        "company",
        "city",
        "area",
        "subarea",
        "shift_mode",
    )
    search_fields = (
        "city__name",
        "first_name",
        "last_name",
        "position",
        "email",
        "phone",
        "shift",
        "observations",
        "company__name",
        "area__name",
        "subarea__name",
    )
    ordering = ("last_name", "first_name")