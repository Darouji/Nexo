from django.contrib import admin

from .models import (
    Categoria,
    MovimientoKardex,
    PendientePorRecibir,
    Producto,
)


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "name_normalized", "description")
    ordering = ("name",)


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = (
        "modelo",
        "categoria",
        "codigo_sap",
        "stock_actual",
        "stock_critico",
        "controla_stock",
        "descontinuado",
        "status",
    )
    list_filter = (
        "status",
        "descontinuado",
        "categoria",
        "controla_stock",
    )
    search_fields = (
        "modelo",
        "modelo_normalized",
        "detalle",
        "codigo_sap",
        "codigo_sap_normalized",
        "categoria__name",
    )
    ordering = ("categoria__name", "modelo")
    readonly_fields = (
        "stock_actual",
        "modelo_normalized",
        "codigo_sap_normalized",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )


@admin.register(PendientePorRecibir)
class PendientePorRecibirAdmin(admin.ModelAdmin):
    list_display = (
        "producto",
        "cantidad_original",
        "cantidad_recibida",
        "cantidad_cancelada",
        "cantidad_pendiente",
        "estado",
        "referencia",
        "created_by",
        "created_at",
    )
    list_filter = ("estado", "status", "created_at")
    search_fields = (
        "producto__modelo",
        "producto__codigo_sap",
        "producto__categoria__name",
        "referencia",
        "motivo",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "cantidad_recibida",
        "cantidad_cancelada",
        "cantidad_pendiente",
        "estado",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )


@admin.register(MovimientoKardex)
class MovimientoKardexAdmin(admin.ModelAdmin):
    list_display = (
        "producto",
        "movement_type",
        "cantidad",
        "stock_antes",
        "stock_despues",
        "operador",
        "origin",
        "created_at",
    )
    list_filter = ("movement_type", "origin", "status", "created_at")
    search_fields = (
        "producto__modelo",
        "producto__codigo_sap",
        "producto__categoria__name",
        "motivo",
        "reference_repr",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "producto",
        "movement_type",
        "origin",
        "operador",
        "cantidad",
        "stock_antes",
        "stock_despues",
        "motivo",
        "reference_content_type",
        "reference_object_id",
        "reference_repr",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
