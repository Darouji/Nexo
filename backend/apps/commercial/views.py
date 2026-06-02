from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsConsultaOrOperativoGlobal, IsOperativoGlobal

from .models import (
    Ciudad,
    AreaCliente,
    SubAreaCliente,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
)
from .serializers import (
    CiudadSerializer,
    AreaClienteSerializer,
    SubAreaClienteSerializer,
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
    
class CiudadViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Ciudad.objects.all()
    serializer_class = CiudadSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "region"]
    ordering_fields = ["name", "region", "status", "created_at", "updated_at"]
    ordering = ["name"]

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
        "city",
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
        "city__name",
        "address",
        "observations",
        "mining_company__name",
        "mining_company__business_group__name",
    ]
    ordering_fields = ["name", "rut", "city__name", "status", "created_at", "updated_at"]
    ordering = ["name"]


class AreaClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = AreaCliente.objects.select_related("company").all()
    serializer_class = AreaClienteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "location", "description", "company__name"]
    ordering_fields = ["name", "company__name", "status", "created_at", "updated_at"]
    ordering = ["company__name", "name"]


class SubAreaClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = SubAreaCliente.objects.select_related("area", "area__company").all()
    serializer_class = SubAreaClienteSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "area__name", "area__company__name"]
    ordering_fields = [
        "name",
        "area__name",
        "area__company__name",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["area__company__name", "area__name", "name"]

class ContactoClienteViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = ContactoCliente.objects.select_related(
        "company",
        "city",
        "area",
        "subarea",
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
        "city__name",
        "area__name",
        "subarea__name",
        "shift_mode",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "company__name",
        "area__name",
        "status",
        "created_at",
        "updated_at",
        "subarea__name",
        "city__name",
        "shift_mode",
    ]
    ordering = ["last_name", "first_name"]