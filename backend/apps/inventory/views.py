from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsConsultaOrOperativoGlobal,
    IsOperativoGlobal,
)

from .models import Categoria, MovimientoKardex, Producto
from .serializers import (
    CategoriaSerializer,
    InventoryAdjustmentSerializer,
    ManualStockEntrySerializer,
    MovimientoKardexSerializer,
    ProductoSerializer,
)
from .services import register_inventory_adjustment, register_manual_entry


def raise_drf_validation_error(error):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise DRFValidationError(error.messages)

    raise DRFValidationError(str(error))


class InventoryPermissionMixin:
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


class CategoriaViewSet(InventoryPermissionMixin, viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "description"]
    ordering_fields = ["name", "status", "created_at", "updated_at"]
    ordering = ["name"]


class ProductoViewSet(InventoryPermissionMixin, viewsets.ModelViewSet):
    queryset = Producto.objects.select_related("categoria").all()
    serializer_class = ProductoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "modelo",
        "modelo_normalized",
        "detalle",
        "codigo_sap",
        "codigo_sap_normalized",
        "categoria__name",
        "categoria__name_normalized",
    ]
    ordering_fields = [
        "categoria__name",
        "modelo",
        "codigo_sap",
        "stock_actual",
        "stock_critico",
        "en_camino",
        "controla_stock",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["categoria__name", "modelo"]

    @action(detail=True, methods=["post"], url_path="entrada-manual")
    def entrada_manual(self, request, pk=None):
        producto = self.get_object()
        serializer = ManualStockEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movement = register_manual_entry(
                producto=producto,
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        output_serializer = MovimientoKardexSerializer(movement)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="ajuste-inventario")
    def ajuste_inventario(self, request, pk=None):
        producto = self.get_object()
        serializer = InventoryAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movement = register_inventory_adjustment(
                producto=producto,
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        output_serializer = MovimientoKardexSerializer(movement)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class MovimientoKardexViewSet(InventoryPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoKardex.objects.select_related(
        "producto",
        "producto__categoria",
        "operador",
        "reference_content_type",
    ).all()
    serializer_class = MovimientoKardexSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "producto__modelo",
        "producto__modelo_normalized",
        "producto__codigo_sap",
        "producto__codigo_sap_normalized",
        "producto__categoria__name",
        "movement_type",
        "origin",
        "motivo",
        "reference_repr",
    ]
    ordering_fields = [
        "created_at",
        "producto__modelo",
        "movement_type",
        "origin",
        "cantidad",
        "stock_antes",
        "stock_despues",
    ]
    ordering = ["-created_at"]