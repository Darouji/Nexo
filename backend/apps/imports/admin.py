from django.contrib import admin

from .models import ImportBatch, ImportRow


class ImportRowInline(admin.TabularInline):
    model = ImportRow
    extra = 0
    readonly_fields = (
        "row_number",
        "row_status",
        "raw_data",
        "normalized_data",
        "messages",
        "imported_content_type",
        "imported_object_id",
        "imported_repr",
        "created_at",
        "updated_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "target",
        "batch_status",
        "original_filename",
        "total_rows",
        "valid_rows",
        "error_rows",
        "duplicate_rows",
        "review_rows",
        "imported_rows",
        "created_at",
    )
    list_filter = ("target", "batch_status", "created_at", "processed_at")
    search_fields = ("original_filename", "file_sha256", "notes")
    ordering = ("-created_at",)
    readonly_fields = (
        "original_filename",
        "file_sha256",
        "content_type",
        "size_bytes",
        "batch_status",
        "total_rows",
        "valid_rows",
        "error_rows",
        "duplicate_rows",
        "review_rows",
        "imported_rows",
        "omitted_rows",
        "processed_by",
        "processed_at",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    inlines = [ImportRowInline]


@admin.register(ImportRow)
class ImportRowAdmin(admin.ModelAdmin):
    list_display = (
        "batch",
        "row_number",
        "row_status",
        "imported_repr",
        "created_at",
    )
    list_filter = ("row_status", "batch__target", "batch__batch_status")
    search_fields = (
        "batch__original_filename",
        "raw_data",
        "normalized_data",
        "messages",
        "imported_repr",
    )
    ordering = ("batch", "row_number")
    readonly_fields = (
        "batch",
        "row_number",
        "row_status",
        "raw_data",
        "normalized_data",
        "messages",
        "imported_content_type",
        "imported_object_id",
        "imported_repr",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )