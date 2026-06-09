from django.contrib import admin

from .models import (
    Ciudad,
    Holding,
    Minera,
    Area,
    Subarea,
    Contacto,
)

@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "status", "created_at", "updated_at")
    list_filter = ("status", "region")
    search_fields = ("name", "region")
    ordering = ("name",)

@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "description")
    ordering = ("name",)

@admin.register(Minera)
class MineraAdmin(admin.ModelAdmin):
    list_display = ("name", "rut", "holding", "city", "email", "phone", "status")
    list_filter = ("status", "city", "holding")
    search_fields = ("name", "rut", "email", "phone", "holding__name", "city__name", "observations")
    ordering = ("name",)

@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("name", "minera", "location", "status")
    list_filter = ("status", "minera")
    search_fields = ("name", "location", "description", "minera__name")
    ordering = ("minera__name", "name")

@admin.register(Subarea)
class SubareaAdmin(admin.ModelAdmin):
    list_display = ("name", "area", "get_minera", "status")
    list_filter = ("status", "area", "area__minera")
    search_fields = ("name", "description", "area__name", "area__minera__name")
    ordering = ("area__minera__name", "area__name", "name")

    def get_minera(self, obj):
        return obj.area.minera

    get_minera.short_description = "Minera"

@admin.register(Contacto)
class ContactoAdmin(admin.ModelAdmin):
    list_display = (
        "first_name",
        "last_name",
        "minera",
        "city",
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
        "minera",
        "city",
        "area",
        "subarea",
        "shift_mode",
    )
    search_fields = (
        "first_name",
        "last_name",
        "minera__name",
        "city__name",
        "area__name",
        "subarea__name",
        "position",
        "email",
        "phone",
        "shift",
        "observations",
    )
    ordering = ("last_name", "first_name")