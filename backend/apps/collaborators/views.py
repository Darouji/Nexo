from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import (
    IsConsultaOrOperativoGlobal,
    IsOperativoGlobal,
)

from .models import Collaborator
from .serializers import CollaboratorSerializer


class CollaboratorPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]

        return [permission() for permission in permission_classes]


class CollaboratorViewSet(CollaboratorPermissionMixin, viewsets.ModelViewSet):
    serializer_class = CollaboratorSerializer

    def get_queryset(self):
        queryset = (
            Collaborator.objects.select_related(
                "user",
                "created_by",
                "updated_by",
            )
            .all()
            .order_by("last_name", "first_name")
        )

        status_param = self.request.query_params.get("status")
        department = self.request.query_params.get("department")
        position = self.request.query_params.get("position")
        linked_user = self.request.query_params.get("linked_user")
        search = self.request.query_params.get("search")

        if status_param:
            queryset = queryset.filter(status=status_param)

        if department:
            queryset = queryset.filter(department__icontains=department)

        if position:
            queryset = queryset.filter(position__icontains=position)

        if linked_user == "true":
            queryset = queryset.filter(user__isnull=False)

        if linked_user == "false":
            queryset = queryset.filter(user__isnull=True)

        if search:
            queryset = queryset.filter(
                Q(rut__icontains=search)
                | Q(rut_normalized__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(full_name_normalized__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(position__icontains=search)
                | Q(department__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        with transaction.atomic():
            serializer.save(
                created_by=self.request.user,
                updated_by=self.request.user,
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        with transaction.atomic():
            instance.mark_inactive(user=request.user)

        from rest_framework.response import Response

        return Response(
            {"detail": "Colaborador inactivado correctamente."}
        )