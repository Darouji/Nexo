from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsConsultaOrOperativoGlobal, IsOperativoGlobal

from .models import (
    Ciudad,
    Holding,
    Minera,
    Area,
    Subarea,
    Contacto,
)
from .serializers import (
    CiudadSerializer,
    HoldingSerializer,
    MineraSerializer,
    AreaSerializer,
    SubareaSerializer,
    ContactoSerializer,
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

class HoldingViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Holding.objects.all()
    serializer_class = HoldingSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "status", "created_at", "updated_at"]
    ordering = ["name"]

class MineraViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Minera.objects.select_related("holding", "city").all()
    serializer_class = MineraSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "rut", "email", "phone", "holding__name", "city__name", "observations"]
    ordering_fields = ["name", "rut", "status", "created_at", "updated_at"]
    ordering = ["name"]

class AreaViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Area.objects.select_related("minera").all()
    serializer_class = AreaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "location", "description", "minera__name"]
    ordering_fields = ["name", "minera__name", "status", "created_at", "updated_at"]
    ordering = ["minera__name", "name"]

class SubareaViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Subarea.objects.select_related("area", "area__minera").all()
    serializer_class = SubareaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "area__name", "area__minera__name"]
    ordering_fields = [
        "name",
        "area__name",
        "area__minera__name",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["area__minera__name", "area__name", "name"]

class ContactoViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Contacto.objects.select_related(
        "minera",
        "city",
        "area",
        "subarea",
    ).all()
    serializer_class = ContactoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "first_name",
        "last_name",
        "position",
        "email",
        "phone",
        "shift",
        "observations",
        "minera__name",
        "city__name",
        "area__name",
        "subarea__name",
        "shift_mode",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "minera__name",
        "area__name",
        "status",
        "created_at",
        "updated_at",
        "subarea__name",
        "city__name",
        "shift_mode",
    ]
    ordering = ["last_name", "first_name"]