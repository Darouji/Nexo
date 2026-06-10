from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsConsultaOrOperativoGlobal, IsOperativoGlobal
from .models import Categoria, Producto, MovimientoKardex
from .serializers import CategoriaSerializer, ProductoSerializer, MovimientoKardexSerializer

class InventoryPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]
        return [permission() for permission in permission_classes]

class CategoriaViewSet(InventoryPermissionMixin, viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]

class ProductoViewSet(InventoryPermissionMixin, viewsets.ModelViewSet):
    queryset = Producto.objects.select_related("categoria").all()
    serializer_class = ProductoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["modelo", "detalle", "categoria__name"]
    ordering = ["categoria__name", "modelo"]

class MovimientoKardexViewSet(InventoryPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoKardex.objects.select_related("producto", "operador").all()
    serializer_class = MovimientoKardexSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["producto__modelo", "motivo"]
    ordering = ["-fecha"]