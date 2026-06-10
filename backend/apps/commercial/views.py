from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import (
    IsConsultaOrOperativoGlobal,
    IsOperativoGlobal,
)

from .models import (
    Area,
    Ciudad,
    Contacto,
    ContactSubareaHistory,
    Holding,
    Minera,
    Subarea,
)
from .serializers import (
    AreaSerializer,
    CiudadSerializer,
    ContactoSerializer,
    ContactSubareaHistorySerializer,
    HoldingSerializer,
    MineraSerializer,
    SubareaSerializer,
)


class CommercialPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]

        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.mark_inactive(user=self.request.user)


class CiudadViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Ciudad.objects.all()
    serializer_class = CiudadSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "region"]
    ordering_fields = ["name", "region", "status", "created_at", "updated_at"]
    ordering = ["name"]


class HoldingViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Holding.objects.all()
    serializer_class = HoldingSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "description", "aliases"]
    ordering_fields = ["name", "status", "created_at", "updated_at"]
    ordering = ["name"]


class MineraViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Minera.objects.select_related("holding", "city").all()
    serializer_class = MineraSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "name_normalized",
        "rut",
        "rut_normalized",
        "email",
        "phone",
        "holding__name",
        "holding__name_normalized",
        "city__name",
        "observations",
        "aliases",
    ]
    ordering_fields = ["name", "rut", "status", "created_at", "updated_at"]
    ordering = ["name"]


class AreaViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Area.objects.select_related("minera", "minera__holding").all()
    serializer_class = AreaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "name_normalized",
        "location",
        "description",
        "minera__name",
        "minera__name_normalized",
        "minera__holding__name",
    ]
    ordering_fields = ["name", "minera__name", "status", "created_at", "updated_at"]
    ordering = ["minera__name", "name"]


class SubareaViewSet(CommercialPermissionMixin, viewsets.ModelViewSet):
    queryset = Subarea.objects.select_related(
        "area",
        "area__minera",
        "area__minera__holding",
    ).all()
    serializer_class = SubareaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "name_normalized",
        "description",
        "area__name",
        "area__name_normalized",
        "area__minera__name",
        "area__minera__name_normalized",
        "area__minera__holding__name",
    ]
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
        "city",
        "subarea",
        "subarea__area",
        "subarea__area__minera",
        "subarea__area__minera__holding",
    ).all()
    serializer_class = ContactoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "first_name",
        "last_name",
        "full_name_normalized",
        "position",
        "email",
        "email_normalized",
        "phone",
        "phone_normalized",
        "shift",
        "observations",
        "city__name",
        "subarea__name",
        "subarea__name_normalized",
        "subarea__area__name",
        "subarea__area__name_normalized",
        "subarea__area__minera__name",
        "subarea__area__minera__name_normalized",
        "subarea__area__minera__holding__name",
        "shift_mode",
    ]
    ordering_fields = [
        "first_name",
        "last_name",
        "subarea__area__minera__name",
        "subarea__area__name",
        "subarea__name",
        "city__name",
        "shift_mode",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["last_name", "first_name"]


class ContactSubareaHistoryViewSet(CommercialPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ContactSubareaHistory.objects.select_related(
        "contact",
        "old_subarea",
        "new_subarea",
        "changed_by",
    ).all()
    serializer_class = ContactSubareaHistorySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "contact__first_name",
        "contact__last_name",
        "old_subarea__name",
        "new_subarea__name",
        "reason",
    ]
    ordering_fields = ["created_at", "contact__last_name"]
    ordering = ["-created_at"]