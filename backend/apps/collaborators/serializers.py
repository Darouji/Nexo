from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Collaborator, normalize_email, normalize_rut

User = get_user_model()


class CollaboratorUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "status",
            "is_active",
        ]


class CollaboratorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    user_detail = CollaboratorUserSerializer(
        source="user",
        read_only=True,
    )
    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )
    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    created_by_username = serializers.CharField(
        source="created_by.username",
        read_only=True,
    )
    updated_by_username = serializers.CharField(
        source="updated_by.username",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = Collaborator
        fields = [
            "id",
            "user",
            "user_detail",
            "user_username",
            "user_email",
            "rut",
            "rut_normalized",
            "first_name",
            "last_name",
            "full_name",
            "full_name_normalized",
            "email",
            "email_normalized",
            "phone",
            "position",
            "department",
            "shift",
            "start_date",
            "end_date",
            "status",
            "status_display",
            "observations",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
        ]
        read_only_fields = [
            "id",
            "user_detail",
            "user_username",
            "user_email",
            "rut_normalized",
            "full_name",
            "full_name_normalized",
            "email_normalized",
            "status_display",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_username",
            "updated_by",
            "updated_by_username",
        ]

    def validate_rut(self, value):
        if value in ["", None]:
            return None

        normalized = normalize_rut(value)
        instance_id = self.instance.id if self.instance else None

        if (
            Collaborator.objects.exclude(id=instance_id)
            .filter(rut_normalized=normalized)
            .exists()
        ):
            raise serializers.ValidationError("Ya existe un colaborador con ese RUT.")

        return value

    def validate_email(self, value):
        if value in ["", None]:
            return ""

        normalized = normalize_email(value)
        instance_id = self.instance.id if self.instance else None

        if (
            Collaborator.objects.exclude(id=instance_id)
            .filter(email_normalized=normalized)
            .exists()
        ):
            raise serializers.ValidationError("Ya existe un colaborador con ese correo.")

        return normalized

    def validate_user(self, value):
        if value is None:
            return value

        instance_id = self.instance.id if self.instance else None

        if (
            Collaborator.objects.exclude(id=instance_id)
            .filter(user=value)
            .exists()
        ):
            raise serializers.ValidationError(
                "Ese usuario ya está vinculado a otro colaborador."
            )

        return value

    def validate(self, attrs):
        start_date = attrs.get(
            "start_date",
            self.instance.start_date if self.instance else None,
        )
        end_date = attrs.get(
            "end_date",
            self.instance.end_date if self.instance else None,
        )

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {
                    "end_date": "La fecha de salida no puede ser anterior a la fecha de ingreso."
                }
            )

        return attrs