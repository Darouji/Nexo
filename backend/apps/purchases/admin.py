from django.contrib import admin

from .models import (
    Carrier,
    CostAllocation,
    LandedCost,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderOperation,
    PurchaseReceiptCommitment,
    PurchaseShipment,
    ShipmentCharge,
    ShipmentEvent,
    Supplier,
)


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0
    readonly_fields = (
        "product_model_snapshot", "product_sap_snapshot",
        "product_category_snapshot", "subtotal_original",
        "tax_total_original", "total_original", "total_clp",
    )


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("legal_name", "trade_name", "tax_id", "status", "updated_at")
    search_fields = ("legal_name", "trade_name", "tax_id", "email")
    list_filter = ("status",)


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = (
        "number", "supplier", "order_date", "currency",
        "state", "total_original", "total_clp",
    )
    search_fields = ("number", "supplier__legal_name", "supplier__tax_id")
    list_filter = ("state", "currency", "cost_quality")
    readonly_fields = (
        "subtotal_original", "tax_total_original", "total_original", "total_clp",
    )
    inlines = (PurchaseOrderLineInline,)


@admin.register(PurchaseReceiptCommitment)
class PurchaseReceiptCommitmentAdmin(admin.ModelAdmin):
    list_display = (
        "order_line", "destination_location", "committed_quantity",
        "pending_receipt",
    )
    readonly_fields = ("order_line", "destination_location", "committed_quantity", "pending_receipt")


@admin.register(PurchaseOrderOperation)
class PurchaseOrderOperationAdmin(admin.ModelAdmin):
    list_display = ("order", "operation_type", "previous_state", "new_state", "responsible", "created_at")
    readonly_fields = (
        "order", "operation_type", "idempotency_key", "previous_state",
        "new_state", "reason", "payload", "responsible", "created_by",
        "updated_by", "created_at", "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(LandedCost)
admin.site.register(CostAllocation)


@admin.register(Carrier)
class CarrierAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "status", "updated_at")
    search_fields = ("name", "country", "aliases")
    list_filter = ("status", "country")


class ReadOnlyLogisticsAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PurchaseShipment)
class PurchaseShipmentAdmin(ReadOnlyLogisticsAdmin):
    list_display = (
        "order", "carrier", "tracking_number", "state",
        "current_custodian", "current_eta",
    )
    search_fields = (
        "order__number", "order__supplier__legal_name",
        "carrier__name", "tracking_number",
    )
    list_filter = ("state", "transport_mode", "current_custodian")


@admin.register(ShipmentEvent)
class ShipmentEventAdmin(ReadOnlyLogisticsAdmin):
    list_display = (
        "shipment", "event_type", "title", "occurred_at", "responsible",
    )
    search_fields = (
        "shipment__order__number", "shipment__tracking_number",
        "title", "description",
    )
    list_filter = ("event_type", "new_state", "new_custodian")


@admin.register(ShipmentCharge)
class ShipmentChargeAdmin(ReadOnlyLogisticsAdmin):
    list_display = (
        "shipment", "charge_type", "amount_original", "currency",
        "amount_clp", "charge_status",
    )
    search_fields = (
        "shipment__order__number", "shipment__tracking_number",
        "description", "source_reference",
    )
    list_filter = ("charge_type", "charge_status", "currency")
