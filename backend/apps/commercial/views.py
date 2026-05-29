from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsConsultaOrOperativoGlobal, IsOperativoGlobal

from .models import (
    AreaCliente,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
)
from .serializers import (
    AreaClienteSerializer,
    ContactoClienteSerializer,
    EmpresaClienteSerializer,
    GrupoEmpresarialSerializer,
    MineraSerializer,
)


class CommercialPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]

        return [permission() for permission in permission_classes]


class GrupoEmpresarialViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = GrupoEmpresarial.objects.all()
    serializer_class = GrupoEmpresarialSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "status", "created_at", "updated_at"]
    ordering = ["name"]


class MineraViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Minera.objects.select_related("business_group").all()
    serializer_class = MineraSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "rut", "observations", "business_group__name"]
    ordering_fields = ["name", "rut", "status", "created_at", "updated_at"]
    ordering = ["name"]


class EmpresaClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = EmpresaCliente.objects.select_related(
        "mining_company",
        "mining_company__business_group",
    ).all()
    serializer_class = EmpresaClienteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "rut",
        "email",
        "phone",
        "address",
        "observations",
        "mining_company__name",
        "mining_company__business_group__name",
    ]
    ordering_fields = ["name", "rut", "status", "created_at", "updated_at"]
    ordering = ["name"]


class AreaClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = AreaCliente.objects.select_related("company").all()
    serializer_class = AreaClienteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "location", "description", "company__name"]
    ordering_fields = ["name", "company__name", "status", "created_at", "updated_at"]
    ordering = ["company__name", "name"]


class ContactoClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = ContactoCliente.objects.select_related(
        "company",
        "area",
    ).all()
    serializer_class = ContactoClienteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "first_name",
        "last_name",
        "position",
        "email",
        "phone",
        "shift",
        "observations",
        "company__name",
        "area__name",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "company__name",
        "area__name",
        "contact_type",
        "alliance_level",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["last_name", "first_name"]