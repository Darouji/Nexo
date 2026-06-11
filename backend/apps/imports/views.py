from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.accounts.permissions import IsConsultaOrOperativoGlobal, user_has_role

from .models import ImportBatch, ImportRow
from .serializers import (
    ImportBatchSerializer,
    ImportRowSerializer,
    PrevalidateImportBatchSerializer,
    ProcessImportBatchSerializer,
)


class CanManageImports(BasePermission):
    message = "No tiene permisos para gestionar importaciones."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.INFORMATICO,
                UserRole.FINANZAS_COMERCIAL,
            ],
        )


class ImportsPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, CanManageImports]

        return [permission() for permission in permission_classes]

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.mark_archived(user=self.request.user)


class ImportBatchViewSet(ImportsPermissionMixin, viewsets.ModelViewSet):
    queryset = (
        ImportBatch.objects.select_related(
            "created_by",
            "updated_by",
            "processed_by",
        )
        .prefetch_related("rows")
        .all()
    )
    serializer_class = ImportBatchSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "target",
        "batch_status",
        "original_filename",
        "file_sha256",
        "notes",
        "rows__raw_data",
        "rows__normalized_data",
        "rows__messages",
    ]
    ordering_fields = [
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
        "processed_at",
    ]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"], url_path="prevalidate")
    def prevalidate(self, request, pk=None):
        batch = self.get_object()

        serializer = PrevalidateImportBatchSerializer(
            data=request.data,
            context={
                "request": request,
                "batch": batch,
            },
        )
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()

        output_serializer = self.get_serializer(batch)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="process")
    def process(self, request, pk=None):
        batch = self.get_object()

        serializer = ProcessImportBatchSerializer(
            data=request.data,
            context={
                "request": request,
                "batch": batch,
            },
        )
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()

        output_serializer = self.get_serializer(batch)
        return Response(output_serializer.data, status=status.HTTP_200_OK)


class ImportRowViewSet(ImportsPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ImportRow.objects.select_related(
        "batch",
        "imported_content_type",
    ).all()
    serializer_class = ImportRowSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "batch__original_filename",
        "row_status",
        "raw_data",
        "normalized_data",
        "messages",
        "imported_repr",
    ]
    ordering_fields = [
        "batch",
        "row_number",
        "row_status",
        "created_at",
        "updated_at",
    ]
    ordering = ["batch", "row_number"]