from rest_framework import serializers

from .models import Collaborator


class CollaboratorSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = [
            "id",
            "rut",
            "first_name",
            "last_name",
            "full_name",
            "position",
            "area",
            "email",
            "phone",
            "shift",
            "status",
            "observations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "full_name",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()