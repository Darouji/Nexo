from django.contrib.contenttypes.models import ContentType
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.accounts.permissions import IsConsultaOrOperativoGlobal, user_has_role

from .models import DocumentFile, DocumentVersion
from .serializers import (
    DocumentFileSerializer,
    DocumentVersionSerializer,
    ReplaceDocumentVersionSerializer,
)


class CanManageDocuments(BasePermission):
    message = "No tiene permisos para gestionar documentos."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.INFORMATICO,
                UserRole.RRHH,
                UserRole.FINANZAS_COMERCIAL,
            ],
        )


class DocumentsPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve", "owner_types"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, CanManageDocuments]

        return [permission() for permission in permission_classes]

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.mark_archived(user=self.request.user)


class DocumentFileViewSet(DocumentsPermissionMixin, viewsets.ModelViewSet):
    queryset = (
        DocumentFile.objects.select_related("owner_content_type", "created_by", "updated_by")
        .prefetch_related("versions", "versions__uploaded_by", "versions__replaced_by")
        .all()
    )
    serializer_class = DocumentFileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if params.get("owner_app"):
            queryset = queryset.filter(owner_content_type__app_label=params["owner_app"])
        if params.get("owner_model"):
            queryset = queryset.filter(owner_content_type__model=params["owner_model"])
        if params.get("owner_object_id"):
            queryset = queryset.filter(owner_object_id=str(params["owner_object_id"]))
        return queryset.distinct()

    @action(detail=False, methods=["get"], url_path="owner-types")
    def owner_types(self, request):
        allowed = (("accounts", "user", "Usuario"), ("collaborators", "collaborator", "Colaborador"))
        output = []
        for app_label, model, label in allowed:
            content_type = ContentType.objects.filter(app_label=app_label, model=model).first()
            if content_type:
                output.append({"id": content_type.pk, "app_label": app_label, "model": model, "label": label})
        return Response(output)

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "title",
        "description",
        "document_type",
        "owner_repr",
        "owner_content_type__app_label",
        "owner_content_type__model",
        "versions__original_filename",
        "versions__file_sha256",
    ]
    ordering_fields = [
        "title",
        "document_type",
        "owner_repr",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"], url_path="replace")
    def replace(self, request, pk=None):
        document = self.get_object()

        serializer = ReplaceDocumentVersionSerializer(
            data=request.data,
            context={
                "request": request,
                "document": document,
            },
        )
        serializer.is_valid(raise_exception=True)
        version = serializer.save()

        output_serializer = DocumentVersionSerializer(
            version,
            context={"request": request},
        )
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class DocumentVersionViewSet(DocumentsPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = DocumentVersion.objects.select_related(
        "document",
        "uploaded_by",
        "replaced_by",
    ).all()
    serializer_class = DocumentVersionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "document__title",
        "document__document_type",
        "original_filename",
        "file_sha256",
        "content_type",
        "replace_reason",
    ]
    ordering_fields = [
        "document__title",
        "version_number",
        "is_active",
        "created_at",
        "size_bytes",
    ]
    ordering = ["document", "-version_number"]