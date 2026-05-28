from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.collaborators.models import Collaborator

from .models import UserProfile, UserRole

class CollaboratorBasicSerializer(serializers.ModelSerializer):
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
            "status",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()
class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    collaborator = CollaboratorBasicSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "collaborator",
            "role",
            "role_display",
            "is_active_profile",
            "phone",
            "position",
            "area",
            "created_at",
            "updated_at",
        ]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "is_active",
            "profile",
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

class CreateUserSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    position = serializers.CharField(max_length=120, required=False, allow_blank=True)
    area = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese nombre de usuario.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        creator_profile = getattr(request.user, "profile", None) if request else None

        requested_role = attrs.get("role")

        if requested_role == UserRole.ADMINISTRADOR:
            if creator_profile is None or creator_profile.role != UserRole.ADMINISTRADOR:
                raise serializers.ValidationError(
                    "Solo un Administrador puede crear otro usuario Administrador."
                )

        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role")
        phone = validated_data.pop("phone", "")
        position = validated_data.pop("position", "")
        area = validated_data.pop("area", "")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            username=validated_data.get("username"),
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            password=password,
        )

        collaborator = Collaborator.objects.create(
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            email=validated_data.get("email", ""),
            phone=phone,
            position=position,
            area=area,
        )

        profile = user.profile
        profile.role = role
        profile.phone = phone
        profile.position = position
        profile.area = area
        profile.collaborator = collaborator
        profile.is_active_profile = True
        profile.save()

        return user