from django.contrib import admin

from .models import DocumentFile, DocumentVersion


class DocumentVersionInline(admin.TabularInline):
    model = DocumentVersion
    extra = 0
    readonly_fields = (
        "version_number",
        "file",
        "original_filename",
        "file_sha256",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "origin",
        "is_active",
        "replaced_at",
        "replaced_by",
        "replace_reason",
        "created_at",
        "updated_at",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DocumentFile)
class DocumentFileAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "document_type",
        "owner_repr",
        "status",
        "created_at",
        "updated_at",
    )
    list_filter = ("document_type", "status", "created_at")
    search_fields = (
        "title",
        "description",
        "owner_repr",
        "owner_content_type__app_label",
        "owner_content_type__model",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "owner_repr",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    inlines = [DocumentVersionInline]


@admin.register(DocumentVersion)
class DocumentVersionAdmin(admin.ModelAdmin):
    list_display = (
        "document",
        "version_number",
        "original_filename",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "origin", "content_type", "created_at")
    search_fields = (
        "document__title",
        "original_filename",
        "file_sha256",
        "replace_reason",
    )
    ordering = ("document", "-version_number")
    readonly_fields = (
        "document",
        "version_number",
        "file",
        "original_filename",
        "file_sha256",
        "content_type",
        "size_bytes",
        "uploaded_by",
        "origin",
        "is_active",
        "replaced_at",
        "replaced_by",
        "replace_reason",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )