from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.core.models import BaseStatus

from .models import UserRole

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

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
            "status_display",
            "is_active",
            "is_staff",
            "is_superuser",
            "phone",
            "position",
            "department",
            "observations",
            "last_login",
            "date_joined",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "full_name",
            "role_display",
            "status_display",
            "is_staff",
            "is_superuser",
            "last_login",
            "date_joined",
            "created_at",
            "updated_at",
        ]


class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    position = serializers.CharField(max_length=120, required=False, allow_blank=True)
    department = serializers.CharField(max_length=120, required=False, allow_blank=True)
    observations = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        value = value.strip()

        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese nombre de usuario.")

        return value

    def validate_email(self, value):
        if value in ["", None]:
            return None

        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo.")

        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        creator = getattr(request, "user", None)

        password = attrs.get("password")
        password_confirm = attrs.get("password_confirm")

        if password != password_confirm:
            raise serializers.ValidationError(
                {"password_confirm": "Las contraseñas no coinciden."}
            )

        requested_role = attrs.get("role")

        if requested_role == UserRole.ADMINISTRADOR:
            if creator is None or creator.role != UserRole.ADMINISTRADOR:
                raise serializers.ValidationError(
                    "Solo un Administrador puede crear otro usuario Administrador."
                )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        creator = getattr(request, "user", None)

        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=validated_data.pop("username"),
            email=validated_data.pop("email", None),
            password=password,
            **validated_data,
        )

        if creator and creator.is_authenticated:
            user.created_by = creator
            user.updated_by = creator
            user.save(update_fields=["created_by", "updated_by", "updated_at"])

        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "email",
            "first_name",
            "last_name",
            "role",
            "status",
            "is_active",
            "phone",
            "position",
            "department",
            "observations",
        ]

    def validate_email(self, value):
        if value in ["", None]:
            return None

        value = value.strip().lower()
        user_id = self.instance.id if self.instance else None

        if User.objects.exclude(id=user_id).filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe otro usuario con ese correo.")

        return value

    def validate(self, attrs):
        request = self.context.get("request")
        editor = getattr(request, "user", None)

        requested_role = attrs.get("role")

        if requested_role == UserRole.ADMINISTRADOR:
            if editor is None or editor.role != UserRole.ADMINISTRADOR:
                raise serializers.ValidationError(
                    "Solo un Administrador puede asignar el rol Administrador."
                )

        if self.instance and self.instance == editor:
            if attrs.get("status") in [BaseStatus.INACTIVO, BaseStatus.ANULADO, BaseStatus.ARCHIVADO]:
                raise serializers.ValidationError(
                    "No puedes inactivar, anular o archivar tu propio usuario."
                )

            if attrs.get("is_active") is False:
                raise serializers.ValidationError(
                    "No puedes desactivar tu propio usuario."
                )

        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request")
        editor = getattr(request, "user", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if editor and editor.is_authenticated:
            instance.updated_by = editor

        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")

        return value

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Las contraseñas no coinciden."}
            )

        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        return user