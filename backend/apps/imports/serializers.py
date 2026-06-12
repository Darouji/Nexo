from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from .models import (
    ImportBatch,
    ImportBatchStatus,
    ImportRow,
    calculate_file_sha256,
)
from .services import prevalidate_import_batch, process_import_batch


def raise_drf_validation_error(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise serializers.ValidationError(error.messages)

    raise serializers.ValidationError(str(error))


class ImportRowSerializer(serializers.ModelSerializer):
    row_status_display = serializers.CharField(
        source="get_row_status_display", read_only=True
    )
    imported_object = serializers.SerializerMethodField()

    class Meta:
        model = ImportRow
        fields = [
            "id",
            "batch",
            "row_number",
            "row_status",
            "row_status_display",
            "raw_data",
            "normalized_data",
            "messages",
            "imported_content_type",
            "imported_object_id",
            "imported_repr",
            "imported_object",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_imported_object(self, obj):
        if not obj.imported_object_id:
            return None

        return {
            "content_type": obj.imported_content_type_id,
            "object_id": obj.imported_object_id,
            "repr": obj.imported_repr,
        }


class ImportBatchSerializer(serializers.ModelSerializer):
    target_display = serializers.CharField(source="get_target_display", read_only=True)
    batch_status_display = serializers.CharField(
        source="get_batch_status_display",
        read_only=True,
    )
    processed_by_name = serializers.SerializerMethodField()
    rows_preview = serializers.SerializerMethodField()

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "target",
            "target_display",
            "file",
            "original_filename",
            "file_sha256",
            "content_type",
            "size_bytes",
            "batch_status",
            "batch_status_display",
            "total_rows",
            "valid_rows",
            "error_rows",
            "duplicate_rows",
            "review_rows",
            "imported_rows",
            "omitted_rows",
            "processed_by",
            "processed_by_name",
            "processed_at",
            "notes",
            "rows_preview",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "original_filename",
            "file_sha256",
            "content_type",
            "size_bytes",
            "batch_status",
            "batch_status_display",
            "total_rows",
            "valid_rows",
            "error_rows",
            "duplicate_rows",
            "review_rows",
            "imported_rows",
            "omitted_rows",
            "processed_by",
            "processed_by_name",
            "processed_at",
            "rows_preview",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        if self.instance is not None:
            return attrs

        target = attrs.get("target")
        file = attrs.get("file")

        if target and file:
            file_sha256 = calculate_file_sha256(file)

            existing_batch = (
                ImportBatch.objects.filter(
                    target=target,
                    file_sha256=file_sha256,
                )
                .exclude(batch_status=ImportBatchStatus.CANCELADO)
                .order_by("-created_at")
                .first()
            )

            if existing_batch:
                raise serializers.ValidationError(
                    {
                        "file": (
                            "Este archivo ya fue cargado anteriormente "
                            f"en la importación #{existing_batch.pk} "
                            f"con estado {existing_batch.get_batch_status_display()}."
                        )
                    }
                )

            attrs["_calculated_file_sha256"] = file_sha256

        return attrs

    @extend_schema_field(OpenApiTypes.STR)
    def get_processed_by_name(self, obj):
        if not obj.processed_by:
            return ""

        return obj.processed_by.get_full_name().strip() or obj.processed_by.username

    @extend_schema_field(ImportRowSerializer(many=True))
    def get_rows_preview(self, obj):
        rows = obj.rows.order_by("row_number")[:10]

        return ImportRowSerializer(rows, many=True).data

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        calculated_file_sha256 = validated_data.pop("_calculated_file_sha256", "")

        batch = ImportBatch(
            created_by=user,
            updated_by=user,
            **validated_data,
        )

        if calculated_file_sha256:
            batch.file_sha256 = calculated_file_sha256

        batch.save()

        return batch


class EmptyImportActionSerializer(serializers.Serializer):
    pass


class PrevalidateImportBatchSerializer(EmptyImportActionSerializer):
    def save(self, **kwargs):
        batch = self.context["batch"]
        request = self.context.get("request")
        user = request.user if request else None

        try:
            return prevalidate_import_batch(batch=batch, user=user)
        except DjangoValidationError as error:
            raise_drf_validation_error(error)


class ProcessImportBatchSerializer(EmptyImportActionSerializer):
    def save(self, **kwargs):
        batch = self.context["batch"]
        request = self.context.get("request")
        user = request.user if request else None

        try:
            return process_import_batch(batch=batch, user=user)
        except DjangoValidationError as error:
            raise_drf_validation_error(error)
