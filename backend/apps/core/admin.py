from django.contrib import admin

from .models import (
    AuditLog,
    ColumnDisplayName,
    RecordAlert,
    RecordChangeLog,
    SavedView,
    SmartTag,
)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "actor",
        "action",
        "origin",
        "module",
        "model_name",
        "object_id",
        "ip_address",
    ]
    list_filter = ["action", "origin", "module", "model_name", "created_at"]
    search_fields = ["actor__username", "object_repr", "reason", "object_id"]
    readonly_fields = [
        "actor",
        "action",
        "origin",
        "module",
        "model_name",
        "content_type",
        "object_id",
        "object_repr",
        "ip_address",
        "user_agent",
        "reason",
        "metadata",
        "created_at",
    ]


@admin.register(RecordChangeLog)
class RecordChangeLogAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "changed_by",
        "action",
        "content_type",
        "object_id",
        "field_name",
        "origin",
    ]
    list_filter = ["action", "origin", "content_type", "created_at"]
    search_fields = ["object_id", "field_name", "old_value", "new_value", "reason"]
    readonly_fields = [
        "content_type",
        "object_id",
        "action",
        "field_name",
        "old_value",
        "new_value",
        "changed_by",
        "origin",
        "reason",
        "created_at",
    ]


@admin.register(RecordAlert)
class RecordAlertAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "code",
        "severity",
        "is_active",
        "content_type",
        "object_id",
        "message",
    ]
    list_filter = ["severity", "is_active", "code", "content_type", "created_at"]
    search_fields = ["code", "message", "object_id"]


@admin.register(ColumnDisplayName)
class ColumnDisplayNameAdmin(admin.ModelAdmin):
    list_display = [
        "module",
        "model_name",
        "field_key",
        "visible_name",
        "status",
        "updated_at",
    ]
    list_filter = ["module", "model_name", "status"]
    search_fields = ["module", "model_name", "field_key", "visible_name"]


@admin.register(SmartTag)
class SmartTagAdmin(admin.ModelAdmin):
    list_display = ["name", "color_hex", "status", "updated_at"]
    list_filter = ["status"]
    search_fields = ["name", "description"]


@admin.register(SavedView)
class SavedViewAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "module",
        "model_name",
        "name",
        "is_default",
        "status",
        "updated_at",
    ]
    list_filter = ["module", "model_name", "is_default", "status"]
    search_fields = ["user__username", "module", "model_name", "name"]