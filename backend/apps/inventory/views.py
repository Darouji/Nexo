from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import (
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from rest_framework import filters, mixins, status, viewsets
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
    ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
    Categoria,
    MovimientoKardex,
    PendientePorRecibir,
    PendientePorRecibirStatus,
    Producto,
    ProductStockStatus,
)
from .serializers import (
    CategoriaDeleteSerializer,
    CategoriaMergeSerializer,
    CategoriaRenameSerializer,
    CategoriaSerializer,
    CrearPendientePorRecibirSerializer,
    InventoryAdjustmentSerializer,
    ManualStockEntrySerializer,
    MovimientoKardexSerializer,
    OperacionPendientePorRecibirSerializer,
    PendientePorRecibirSerializer,
    ProductoLifecycleActionSerializer,
    ProductoSerializer,
)
from .services import (
    cancel_pending_receipt,
    change_product_lifecycle,
    create_pending_receipt,
    delete_category_safely,
    merge_categories,
    receive_pending_receipt,
    register_inventory_adjustment,
    register_manual_entry,
    rename_category,
)


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
        if self.action in ["list", "retrieve", "resumen"]:
            permission_classes = [IsAuthenticated, IsConsultaOrOperativoGlobal]
        else:
            permission_classes = [IsAuthenticated, IsOperativoGlobal]

        return [permission() for permission in permission_classes]

    def set_audit_instance(self, instance):
        django_request = getattr(self.request, "_request", self.request)
        django_request.audit_instance = instance

    def perform_create(self, serializer):
        instance = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        self.set_audit_instance(instance)
        return instance

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        self.set_audit_instance(instance)
        return instance

    def perform_destroy(self, instance):
        instance.mark_inactive(user=self.request.user)


class CategoriaViewSet(InventoryPermissionMixin, viewsets.ModelViewSet):
    queryset = Categoria.objects.select_related(
        "merged_into",
        "merged_by",
    ).all()

    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "description"]
    ordering_fields = ["name", "status", "created_at", "updated_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()

        available = parse_bool_param(
            self.request.query_params.get("available"),
            "available",
        )

        if available is True:
            queryset = queryset.filter(
                status=BaseStatus.ACTIVO,
                merged_into__isnull=True,
            )
        elif available is False:
            queryset = queryset.exclude(
                status=BaseStatus.ACTIVO,
                merged_into__isnull=True,
            )

        return queryset

    def _skip_activity_audit(self, request):
        django_request = getattr(request, "_request", request)
        django_request.skip_activity_audit = True

    def destroy(self, request, *args, **kwargs):
        categoria = self.get_object()

        serializer = CategoriaDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            delete_category_safely(
                categoria=categoria,
                motivo=serializer.validated_data["motivo"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="renombrar")
    def renombrar(self, request, pk=None):
        categoria = self.get_object()

        serializer = CategoriaRenameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_category = rename_category(
                categoria=categoria,
                nombre=serializer.validated_data["name"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        return Response(
            CategoriaSerializer(
                updated_category,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="fusionar")
    def fusionar(self, request, pk=None):
        categoria_origen = self.get_object()

        serializer = CategoriaMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            source, destination, reassigned_product_count, is_idempotent = (
                merge_categories(
                    categoria_origen=categoria_origen,
                    categoria_destino=serializer.validated_data["categoria_destino"],
                    motivo=serializer.validated_data["motivo"],
                    user=request.user,
                    request=getattr(request, "_request", request),
                )
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        return Response(
            {
                "categoria_origen": CategoriaSerializer(
                    source,
                    context={"request": request},
                ).data,
                "categoria_destino": CategoriaSerializer(
                    destination,
                    context={"request": request},
                ).data,
                "productos_reasignados": reassigned_product_count,
                "idempotente": is_idempotent,
            },
            status=status.HTTP_200_OK,
        )


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
        "por_recibir_total",
        "controla_stock",
        "descontinuado",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["categoria__name", "modelo"]

    @action(detail=False, methods=["get"], url_path="resumen")
    def resumen(self, request):
        productos_activos = Producto.objects.filter(
            status=BaseStatus.ACTIVO,
            descontinuado=False,
        )

        bajo_minimo = productos_activos.filter(
            controla_stock=True,
            stock_actual__gt=0,
            stock_actual__lte=F("stock_critico"),
        ).count()

        pendiente_expression = ExpressionWrapper(
            F("cantidad_original") - F("cantidad_recibida") - F("cantidad_cancelada"),
            output_field=IntegerField(),
        )

        por_recibir = PendientePorRecibir.objects.filter(
            estado__in=ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
        ).aggregate(
            total=Coalesce(
                Sum(pendiente_expression),
                Value(0),
                output_field=IntegerField(),
            ),
        )["total"]

        return Response(
            {
                "productos_activos": productos_activos.count(),
                "bajo_minimo": bajo_minimo,
                "por_recibir": por_recibir or 0,
            },
            status=status.HTTP_200_OK,
        )

    def get_queryset(self):
        pending_quantity_expression = ExpressionWrapper(
            F("pendientes_por_recibir__cantidad_original")
            - F("pendientes_por_recibir__cantidad_recibida")
            - F("pendientes_por_recibir__cantidad_cancelada"),
            output_field=IntegerField(),
        )

        queryset = (
            super()
            .get_queryset()
            .annotate(
                por_recibir_total=Coalesce(
                    Sum(
                        pending_quantity_expression,
                        filter=Q(
                            pendientes_por_recibir__estado__in=(
                                ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS
                            )
                        ),
                    ),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
        )
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

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Los productos no se inactivan mediante DELETE. "
                    "Use la acción controlada de ciclo de vida."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"], url_path="ciclo-vida")
    def ciclo_vida(self, request, pk=None):
        producto = self.get_object()

        serializer = ProductoLifecycleActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_product, audit_action = change_product_lifecycle(
                producto=producto,
                accion=serializer.validated_data["accion"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        django_request = getattr(request, "_request", request)

        django_request.user = request.user
        django_request.audit_action = audit_action
        django_request.audit_reason = serializer.validated_data["motivo"]
        django_request.audit_instance = updated_product
        django_request.audit_metadata = {
            "lifecycle_action": serializer.validated_data["accion"],
        }

        return Response(
            ProductoSerializer(
                updated_product,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

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


class PendientePorRecibirViewSet(
    InventoryPermissionMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = PendientePorRecibir.objects.select_related(
        "producto",
        "producto__categoria",
        "created_by",
        "updated_by",
    ).all()

    serializer_class = PendientePorRecibirSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]

    search_fields = [
        "producto__modelo",
        "producto__codigo_sap",
        "producto__categoria__name",
        "referencia",
        "motivo",
    ]

    ordering_fields = [
        "created_at",
        "updated_at",
        "cantidad_original",
        "cantidad_recibida",
        "cantidad_cancelada",
        "estado",
    ]

    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        product_ids = parse_id_values(
            params.get("producto"),
            "producto",
        )

        if product_ids:
            queryset = queryset.filter(producto_id__in=product_ids)

        receipt_statuses = validate_choice_values(
            split_csv_param(params.get("estado")),
            {choice[0] for choice in PendientePorRecibirStatus.choices},
            "estado",
        )

        if receipt_statuses:
            queryset = queryset.filter(estado__in=receipt_statuses)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CrearPendientePorRecibirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pending_receipt = create_pending_receipt(
                producto=serializer.validated_data["producto"],
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data.get("motivo", ""),
                referencia=serializer.validated_data.get("referencia", ""),
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        output_serializer = PendientePorRecibirSerializer(pending_receipt)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="recibir")
    def recibir(self, request, pk=None):
        pending_receipt = self.get_object()

        serializer = OperacionPendientePorRecibirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_pending_receipt, movement = receive_pending_receipt(
                pending_receipt=pending_receipt,
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        return Response(
            {
                "pendiente": PendientePorRecibirSerializer(
                    updated_pending_receipt
                ).data,
                "movimiento_kardex": MovimientoKardexSerializer(movement).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="cancelar")
    def cancelar(self, request, pk=None):
        pending_receipt = self.get_object()

        serializer = OperacionPendientePorRecibirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_pending_receipt = cancel_pending_receipt(
                pending_receipt=pending_receipt,
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        return Response(
            PendientePorRecibirSerializer(updated_pending_receipt).data,
            status=status.HTTP_200_OK,
        )


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
