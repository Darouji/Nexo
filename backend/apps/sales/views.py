from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.accounts.permissions import IsConsultaOrOperativoGlobal, user_has_role

from .models import DetalleVenta, Venta
from .serializers import AnularVentaSerializer, DetalleVentaSerializer, VentaSerializer
from .services import annul_sale, concretar_sale


def raise_drf_validation_error(error):
    if hasattr(error, "message_dict"):
        raise DRFValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise DRFValidationError(error.messages)

    raise DRFValidationError(str(error))


class CanManageSales(BasePermission):
    message = "No tiene permisos para gestionar ventas."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.FINANZAS_COMERCIAL,
                UserRole.OPERATIVO,
            ],
        )


class CanAnnulSales(BasePermission):
    message = "Solo Administrador o Finanzas/Comercial pueden anular ventas."

    def has_permission(self, request, view):
        return user_has_role(
            request.user,
            [
                UserRole.ADMINISTRADOR,
                UserRole.FINANZAS_COMERCIAL,
            ],
        )


class SalesPermissionMixin:
    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        elif self.action == "anular":
            permission_classes = [IsAuthenticated, CanAnnulSales]
        else:
            permission_classes = [IsAuthenticated, CanManageSales]

        return [permission() for permission in permission_classes]

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        raise PermissionDenied(
            "Las ventas no se eliminan. Use la acción de anulación con motivo obligatorio."
        )


class VentaViewSet(SalesPermissionMixin, viewsets.ModelViewSet):
    queryset = (
        Venta.objects.select_related(
            "minera",
            "area",
            "subarea",
            "contacto",
            "operador",
            "concretada_by",
            "anulada_by",
        )
        .prefetch_related(
            "detalles__producto",
            "detalles__producto__categoria",
            "alerts",
        )
        .all()
    )
    serializer_class = VentaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "minera__name",
        "area__name",
        "subarea__name",
        "contacto__first_name",
        "contacto__last_name",
        "factura_numero",
        "orden_compra",
        "numero_guia_hes",
        "tipo_documento",
        "sale_status",
        "observations",
        "detalles__producto__modelo",
        "detalles__producto__codigo_sap",
    ]
    ordering_fields = [
        "fecha_venta",
        "fecha_factura",
        "sale_status",
        "minera__name",
        "valor_neto",
        "iva",
        "total",
        "created_at",
        "updated_at",
    ]
    ordering = ["-fecha_venta", "-created_at"]

    @action(detail=True, methods=["post"], url_path="concretar")
    def concretar(self, request, pk=None):
        venta = self.get_object()

        try:
            venta = concretar_sale(venta=venta, user=request.user)
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        serializer = self.get_serializer(venta)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="anular")
    def anular(self, request, pk=None):
        venta = self.get_object()
        input_serializer = AnularVentaSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            venta = annul_sale(
                venta=venta,
                reason=input_serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        serializer = self.get_serializer(venta)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DetalleVentaViewSet(SalesPermissionMixin, viewsets.ReadOnlyModelViewSet):
    """
    Los detalles son de solo lectura desde este endpoint.

    Regla:
    - Una venta debe crearse con sus líneas dentro de una transacción.
    - Crear detalles sueltos permitiría saltarse el descuento automático de Kardex.
    """

    queryset = DetalleVenta.objects.select_related(
        "venta",
        "producto",
        "producto__categoria",
    ).all()
    serializer_class = DetalleVentaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "producto__modelo",
        "producto__codigo_sap",
        "codigo_sap",
        "venta__factura_numero",
        "venta__orden_compra",
    ]
    ordering_fields = [
        "venta__fecha_venta",
        "producto__modelo",
        "cantidad",
        "valor_unitario",
        "valor_total",
        "created_at",
    ]
    ordering = ["-venta__fecha_venta", "id"]