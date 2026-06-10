from django.contrib import admin

from .models import (
    Area,
    Ciudad,
    Contacto,
    ContactSubareaHistory,
    Holding,
    Minera,
    Subarea,
)


@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "status", "created_at", "updated_at")
    list_filter = ("status", "region")
    search_fields = ("name", "name_normalized", "region")
    ordering = ("name",)


@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "name_normalized", "description")
    ordering = ("name",)


@admin.register(Minera)
class MineraAdmin(admin.ModelAdmin):
    list_display = ("name", "rut", "holding", "city", "email", "phone", "status")
    list_filter = ("status", "city", "holding")
    search_fields = (
        "name",
        "name_normalized",
        "rut",
        "rut_normalized",
        "email",
        "phone",
        "holding__name",
        "city__name",
        "observations",
    )
    ordering = ("name",)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("name", "minera", "location", "status")
    list_filter = ("status", "minera")
    search_fields = ("name", "name_normalized", "location", "description", "minera__name")
    ordering = ("minera__name", "name")


@admin.register(Subarea)
class SubareaAdmin(admin.ModelAdmin):
    list_display = ("name", "area", "get_minera", "status")
    list_filter = ("status", "area", "area__minera")
    search_fields = (
        "name",
        "name_normalized",
        "description",
        "area__name",
        "area__minera__name",
    )
    ordering = ("area__minera__name", "area__name", "name")

    def get_minera(self, obj):
        return obj.area.minera

    get_minera.short_description = "Minera"


@admin.register(Contacto)
class ContactoAdmin(admin.ModelAdmin):
    list_display = (
        "first_name",
        "last_name",
        "get_minera",
        "get_area",
        "subarea",
        "city",
        "position",
        "email",
        "phone",
        "shift_mode",
        "status",
    )
    list_filter = (
        "status",
        "city",
        "subarea",
        "subarea__area",
        "subarea__area__minera",
        "shift_mode",
    )
    search_fields = (
        "first_name",
        "last_name",
        "full_name_normalized",
        "subarea__area__minera__name",
        "subarea__area__name",
        "subarea__name",
        "city__name",
        "position",
        "email",
        "email_normalized",
        "phone",
        "phone_normalized",
        "shift",
        "observations",
    )
    ordering = ("last_name", "first_name")

    def get_minera(self, obj):
        return obj.minera

    def get_area(self, obj):
        return obj.area

    get_minera.short_description = "Minera"
    get_area.short_description = "Área"


@admin.register(ContactSubareaHistory)
class ContactSubareaHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "contact",
        "old_subarea",
        "new_subarea",
        "changed_by",
        "reason",
        "created_at",
    )
    list_filter = ("old_subarea", "new_subarea", "created_at")
    search_fields = (
        "contact__first_name",
        "contact__last_name",
        "old_subarea__name",
        "new_subarea__name",
        "reason",
    )
    ordering = ("-created_at",)