from django.contrib import admin

from .models import DetalleVenta, Venta, VentaAlert


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    readonly_fields = (
        "producto",
        "cantidad",
        "valor_unitario",
        "valor_total",
        "codigo_sap",
        "controla_stock_snapshot",
        "created_at",
        "updated_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class VentaAlertInline(admin.TabularInline):
    model = VentaAlert
    extra = 0
    readonly_fields = (
        "code",
        "message",
        "severity",
        "is_active",
        "resolved_at",
        "resolved_by",
        "created_at",
        "updated_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "minera",
        "sale_status",
        "fecha_venta",
        "factura_numero",
        "orden_compra",
        "valor_neto",
        "iva",
        "total",
        "stock_descontado",
        "status",
    )
    list_filter = (
        "sale_status",
        "status",
        "stock_descontado",
        "tipo_documento",
        "fecha_venta",
        "minera",
    )
    search_fields = (
        "id",
        "minera__name",
        "area__name",
        "subarea__name",
        "contacto__first_name",
        "contacto__last_name",
        "factura_numero",
        "orden_compra",
        "numero_guia_hes",
        "observations",
    )
    ordering = ("-fecha_venta", "-created_at")
    readonly_fields = (
        "operador",
        "sale_status",
        "valor_neto",
        "iva",
        "total",
        "stock_descontado",
        "concretada_at",
        "concretada_by",
        "anulada_at",
        "anulada_by",
        "anulacion_motivo",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    inlines = [DetalleVentaInline, VentaAlertInline]


@admin.register(DetalleVenta)
class DetalleVentaAdmin(admin.ModelAdmin):
    list_display = (
        "venta",
        "producto",
        "cantidad",
        "valor_unitario",
        "valor_total",
        "codigo_sap",
        "controla_stock_snapshot",
    )
    list_filter = ("controla_stock_snapshot", "producto__categoria")
    search_fields = (
        "venta__id",
        "venta__factura_numero",
        "venta__orden_compra",
        "producto__modelo",
        "producto__codigo_sap",
        "codigo_sap",
    )
    ordering = ("-venta__fecha_venta", "id")
    readonly_fields = (
        "venta",
        "producto",
        "cantidad",
        "valor_unitario",
        "valor_total",
        "codigo_sap",
        "controla_stock_snapshot",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )


@admin.register(VentaAlert)
class VentaAlertAdmin(admin.ModelAdmin):
    list_display = (
        "venta",
        "code",
        "message",
        "severity",
        "is_active",
        "created_at",
    )
    list_filter = ("code", "severity", "is_active", "created_at")
    search_fields = (
        "venta__id",
        "venta__factura_numero",
        "venta__orden_compra",
        "message",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "venta",
        "code",
        "message",
        "severity",
        "is_active",
        "resolved_at",
        "resolved_by",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )