from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import DocumentFile, DocumentVersion
from .services import add_document_version, create_document_with_initial_version


def raise_drf_validation_error(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise serializers.ValidationError(error.messages)

    raise serializers.ValidationError(str(error))


class DocumentVersionSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    replaced_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)

    class Meta:
        model = DocumentVersion
        fields = [
            "id",
            "document",
            "version_number",
            "file",
            "file_url",
            "original_filename",
            "file_sha256",
            "content_type",
            "size_bytes",
            "uploaded_by",
            "uploaded_by_name",
            "origin",
            "origin_display",
            "is_active",
            "replaced_at",
            "replaced_by",
            "replaced_by_name",
            "replace_reason",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return ""

        return obj.uploaded_by.get_full_name().strip() or obj.uploaded_by.username

    def get_replaced_by_name(self, obj):
        if not obj.replaced_by:
            return ""

        return obj.replaced_by.get_full_name().strip() or obj.replaced_by.username

    def get_file_url(self, obj):
        if not obj.file:
            return ""

        request = self.context.get("request")
        url = obj.file.url

        if request:
            return request.build_absolute_uri(url)

        return url


class DocumentFileSerializer(serializers.ModelSerializer):
    file = serializers.FileField(
        write_only=True,
        required=False,
        allow_empty_file=False,
    )
    replace_reason = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    owner_content_type = serializers.PrimaryKeyRelatedField(
        queryset=ContentType.objects.all(),
    )
    owner_content_type_label = serializers.SerializerMethodField()
    owner_model = serializers.CharField(
        source="owner_content_type.model",
        read_only=True,
    )
    owner_app = serializers.CharField(
        source="owner_content_type.app_label",
        read_only=True,
    )

    document_type_display = serializers.CharField(
        source="get_document_type_display",
        read_only=True,
    )
    active_version = serializers.SerializerMethodField()
    versions = DocumentVersionSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentFile
        fields = [
            "id",
            "title",
            "document_type",
            "document_type_display",
            "description",
            "owner_content_type",
            "owner_content_type_label",
            "owner_app",
            "owner_model",
            "owner_object_id",
            "owner_repr",
            "file",
            "replace_reason",
            "active_version",
            "versions",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "document_type_display",
            "owner_content_type_label",
            "owner_app",
            "owner_model",
            "owner_repr",
            "active_version",
            "versions",
            "created_at",
            "updated_at",
        ]

    def get_owner_content_type_label(self, obj):
        return f"{obj.owner_content_type.app_label}.{obj.owner_content_type.model}"

    def get_active_version(self, obj):
        active = obj.active_version

        if not active:
            return None

        return DocumentVersionSerializer(
            active,
            context=self.context,
        ).data

    def validate(self, attrs):
        if self.instance is None and not attrs.get("file"):
            raise serializers.ValidationError(
                {"file": "Debe subir un archivo inicial."}
            )

        return attrs

    def create(self, validated_data):
        file = validated_data.pop("file", None)
        validated_data.pop("replace_reason", None)

        request = self.context.get("request")
        user = request.user if request else None

        try:
            return create_document_with_initial_version(
                file=file,
                user=user,
                **validated_data,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

    def update(self, instance, validated_data):
        if "file" in validated_data:
            raise serializers.ValidationError(
                {
                    "file": (
                        "Para reemplazar el archivo use la acción "
                        "POST /api/documents/files/{id}/replace/ con motivo obligatorio."
                    )
                }
            )

        validated_data.pop("replace_reason", None)

        return super().update(instance, validated_data)


class ReplaceDocumentVersionSerializer(serializers.Serializer):
    file = serializers.FileField(allow_empty_file=False)
    reason = serializers.CharField(max_length=500)

    def validate_reason(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo es obligatorio al reemplazar documentos."
            )

        return value

    def save(self, **kwargs):
        document = self.context["document"]
        request = self.context.get("request")
        user = request.user if request else None

        try:
            return add_document_version(
                document=document,
                file=self.validated_data["file"],
                reason=self.validated_data["reason"],
                user=user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)