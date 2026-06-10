from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsConsultaOrOperativoGlobal, IsOperativoGlobal
from .models import Venta, DetalleVenta
from .serializers import VentaSerializer, DetalleVentaSerializer

class SalesPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]
        return [permission() for permission in permission_classes]

class VentaViewSet(SalesPermissionMixin, viewsets.ModelViewSet):
    queryset = Venta.objects.select_related(
        "minera", "area", "subarea", "contacto", "operador"
    ).prefetch_related("detalles__producto").all()
    serializer_class = VentaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["minera__name", "orden_compra", "tipo_documento"]
    ordering = ["-fecha_factura"]

    def perform_create(self, serializer):
        # Asigna el usuario que realiza la petición como el operador de la venta
        serializer.save(operador=self.request.user)

class DetalleVentaViewSet(SalesPermissionMixin, viewsets.ModelViewSet):
    queryset = DetalleVenta.objects.select_related("venta", "producto").all()
    serializer_class = DetalleVentaSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["producto__modelo", "codigo_sap"]