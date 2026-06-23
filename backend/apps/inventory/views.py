from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import F, Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import (
    IsConsultaOrOperativoGlobal,
    IsOperativoGlobal,
)
from apps.core.models import BaseStatus

from .models import (
    Categoria,
    MovimientoKardex,
    Producto,
    ProductStockStatus,
)
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


def split_csv_param(value):
    if not value:
        return []

    return [item.strip() for item in str(value).split(",") if item.strip()]


def parse_bool_param(value, param_name):
    if value is None or value == "":
        return None

    normalized_value = str(value).strip().lower()

    if normalized_value in ["1", "true", "yes", "si", "sí"]:
        return True

    if normalized_value in ["0", "false", "no"]:
        return False

    raise DRFValidationError(
        {param_name: "Valor booleano inválido. Use true/false, 1/0 o sí/no."}
    )


def validate_choice_values(values, allowed_values, param_name):
    invalid_values = [value for value in values if value not in allowed_values]

    if invalid_values:
        raise DRFValidationError(
            {
                param_name: (
                    "Valor no permitido. "
                    f"Valores inválidos: {', '.join(invalid_values)}."
                )
            }
        )

    return values


def parse_id_values(value, param_name):
    values = split_csv_param(value)
    ids = []

    for value in values:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            raise DRFValidationError(
                {param_name: "Debe enviar IDs numéricos separados por coma."}
            )

    return ids


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
        "descontinuado",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["categoria__name", "modelo"]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        category_ids = parse_id_values(
            params.get("categoria") or params.get("category"),
            "categoria",
        )
        if category_ids:
            queryset = queryset.filter(categoria_id__in=category_ids)

        product_status_values = validate_choice_values(
            split_csv_param(params.get("status")),
            {
                BaseStatus.ACTIVO,
                BaseStatus.INACTIVO,
                BaseStatus.ARCHIVADO,
                "DESCONTINUADO",
            },
            "status",
        )

        if product_status_values:
            product_status_query = None

            for product_status in product_status_values:
                if product_status == "DESCONTINUADO":
                    condition = Q(
                        descontinuado=True,
                        status=BaseStatus.ACTIVO,
                    )
                else:
                    condition = Q(
                        status=product_status,
                        descontinuado=False,
                    )

                product_status_query = (
                    condition
                    if product_status_query is None
                    else product_status_query | condition
                )

            queryset = queryset.filter(product_status_query)

        controla_stock = parse_bool_param(
            params.get("controla_stock"),
            "controla_stock",
        )
        if controla_stock is not None:
            queryset = queryset.filter(controla_stock=controla_stock)

        stock_status_values = validate_choice_values(
            split_csv_param(params.get("stock_status")),
            {choice[0] for choice in ProductStockStatus.choices},
            "stock_status",
        )

        if stock_status_values:
            stock_status_query = None

            for stock_status in stock_status_values:
                if stock_status == ProductStockStatus.STOCK_CORRECTO:
                    condition = Q(
                        controla_stock=True,
                        stock_actual__gt=F("stock_critico"),
                    )
                elif stock_status == ProductStockStatus.BAJO_MINIMO:
                    condition = Q(
                        controla_stock=True,
                        stock_actual__gt=0,
                        stock_actual__lte=F("stock_critico"),
                    )
                elif stock_status == ProductStockStatus.SIN_STOCK:
                    condition = Q(
                        controla_stock=True,
                        stock_actual=0,
                    )
                else:
                    condition = Q(controla_stock=False)

                stock_status_query = (
                    condition
                    if stock_status_query is None
                    else stock_status_query | condition
                )

            queryset = queryset.filter(stock_status_query)

        stock_critico = parse_bool_param(
            params.get("stock_critico"),
            "stock_critico",
        )
        if stock_critico is True:
            queryset = queryset.filter(
                controla_stock=True,
                stock_actual__lte=F("stock_critico"),
            )
        elif stock_critico is False:
            queryset = queryset.exclude(
                controla_stock=True,
                stock_actual__lte=F("stock_critico"),
            )

        return queryset

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

    def get_queryset(self):
        queryset = super().get_queryset()

        producto_id = self.request.query_params.get("producto")
        movement_type = self.request.query_params.get("movement_type")
        origin = self.request.query_params.get("origin")
        status_param = self.request.query_params.get("status")

        if producto_id:
            if producto_id.isdigit():
                queryset = queryset.filter(producto_id=producto_id)
            else:
                return queryset.none()

        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)

        if origin:
            queryset = queryset.filter(origin=origin)

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset
