from rest_framework import serializers

from .models import AuditLog, RecordChangeLog


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "action_display",
            "origin",
            "origin_display",
            "module",
            "model_name",
            "object_id",
            "object_repr",
            "ip_address",
            "user_agent",
            "reason",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return "Sistema"

        full_name = obj.actor.get_full_name().strip()

        return full_name or obj.actor.username


class RecordChangeLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    changed_by_name = serializers.SerializerMethodField()
    content_type_label = serializers.SerializerMethodField()

    class Meta:
        model = RecordChangeLog
        fields = [
            "id",
            "content_type",
            "content_type_label",
            "object_id",
            "action",
            "action_display",
            "field_name",
            "old_value",
            "new_value",
            "changed_by",
            "changed_by_name",
            "origin",
            "origin_display",
            "reason",
            "created_at",
        ]
        read_only_fields = fields

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return "Sistema"

        full_name = obj.changed_by.get_full_name().strip()

        return full_name or obj.changed_by.username

    def get_content_type_label(self, obj):
        if not obj.content_type:
            return ""

        return f"{obj.content_type.app_label}.{obj.content_type.model}"