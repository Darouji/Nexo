from django.contrib import admin

from .models import (
    CostAllocation,
    LandedCost,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderOperation,
    PurchaseReceiptCommitment,
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
