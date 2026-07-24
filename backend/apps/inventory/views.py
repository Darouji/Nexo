from datetime import datetime, time, timedelta
import json

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import (
    CharField,
    Count,
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.access import InventoryCapability
from apps.accounts.permissions import HasInventoryCapability
from apps.core.models import AuditOrigin, BaseStatus
from apps.core.grid_registry import apply_grid_filters

from .models import (
    ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
    Categoria,
    InventoryLocation,
    InventoryLocationType,
    InventoryTransfer,
    KardexMovementType,
    MovimientoKardex,
    PendientePorRecibir,
    PendientePorRecibirStatus,
    ProductLocationBalance,
    Producto,
    ProductOrigin,
    ProductStockStatus,
)
from .serializers import (
    CategoriaDeleteSerializer,
    CategoriaMergeSerializer,
    CategoriaRenameSerializer,
    CategoriaSerializer,
    CrearPendientePorRecibirSerializer,
    InventoryAdjustmentSerializer,
    InventoryLocationArchiveSerializer,
    InventoryLocationSerializer,
    InventoryTransferCreateSerializer,
    InventoryTransferSerializer,
    ManualStockEntrySerializer,
    MovimientoKardexSerializer,
    OperacionPendientePorRecibirSerializer,
    PendientePorRecibirSerializer,
    ProductLocationBalanceSerializer,
    ProductoCategoriaChangeSerializer,
    ProductoLifecycleActionSerializer,
    ProductoOrigenChangeSerializer,
    ProductoSerializer,
)
from .services import (
    cancel_pending_receipt,
    change_product_category,
    change_product_lifecycle,
    change_product_origin,
    create_pending_receipt,
    delete_category_safely,
    merge_categories,
    receive_pending_receipt,
    register_inventory_adjustment,
    register_manual_entry,
    rename_category,
)
from .location_services import (
    archive_inventory_location,
    transfer_inventory,
)
from .exports import (
    build_product_export_response,
    record_product_export,
    resolve_export_columns,
)
from .grid_definitions import PRODUCT_GRID_DEFINITION


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


def parse_grid_filters_param(value):
    if value in (None, ""):
        return []

    if len(str(value)) > 10000:
        raise DRFValidationError(
            {"grid_filters": "La definición de filtros es demasiado extensa."}
        )

    try:
        parsed = json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        raise DRFValidationError(
            {"grid_filters": "Los filtros no contienen JSON válido."}
        )

    return parsed


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


def parse_date_param(value, param_name):
    if value is None or value == "":
        return None

    parsed_value = parse_date(str(value).strip())

    if parsed_value is None:
        raise DRFValidationError(
            {param_name: ("La fecha no es válida. Use el formato YYYY-MM-DD.")}
        )

    return parsed_value


def apply_created_at_date_range(queryset, params):
    fecha_desde = parse_date_param(
        params.get("fecha_desde"),
        "fecha_desde",
    )
    fecha_hasta = parse_date_param(
        params.get("fecha_hasta"),
        "fecha_hasta",
    )

    if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
        raise DRFValidationError(
            {
                "fecha_hasta": (
                    "La fecha final debe ser igual o posterior a la fecha inicial."
                )
            }
        )

    current_timezone = timezone.get_current_timezone()

    if fecha_desde:
        start_datetime = timezone.make_aware(
            datetime.combine(fecha_desde, time.min),
            current_timezone,
        )
        queryset = queryset.filter(created_at__gte=start_datetime)

    if fecha_hasta:
        end_datetime_exclusive = timezone.make_aware(
            datetime.combine(
                fecha_hasta + timedelta(days=1),
                time.min,
            ),
            current_timezone,
        )
        queryset = queryset.filter(created_at__lt=end_datetime_exclusive)

    return queryset


class InventoryPermissionMixin:
    inventory_action_capabilities = {}
    inventory_default_write_capability = InventoryCapability.MANAGE_PRODUCTS

    def get_required_inventory_capability(self):
        explicit_capability = self.inventory_action_capabilities.get(self.action)

        if explicit_capability:
            return explicit_capability

        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return InventoryCapability.VIEW

        return self.inventory_default_write_capability

    def get_permissions(self):
        permission_classes = [IsAuthenticated, HasInventoryCapability]

        return [permission() for permission in permission_classes]

    def set_audit_instance(self, instance):
        django_request = getattr(
            self.request,
            "_request",
            self.request,
        )
        django_request.audit_instance = instance

    def _skip_activity_audit(self, request=None):
        source_request = request or self.request
        django_request = getattr(
            source_request,
            "_request",
            source_request,
        )
        django_request.skip_activity_audit = True

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
    inventory_default_write_capability = InventoryCapability.MANAGE_CATEGORIES
    queryset = (
        Categoria.objects.select_related(
            "merged_into",
            "merged_by",
        )
        .annotate(
            productos_count=Count(
                "productos",
                filter=Q(productos__status=BaseStatus.ACTIVO),
                distinct=True,
            ),
        )
        .all()
    )

    serializer_class = CategoriaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "description"]
    ordering_fields = ["name", "status", "productos_count", "created_at", "updated_at"]
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
                descripcion=serializer.validated_data.get("description"),
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
    inventory_action_capabilities = {
        "destroy": InventoryCapability.MANAGE_PRODUCT_LIFECYCLE,
        "ciclo_vida": InventoryCapability.MANAGE_PRODUCT_LIFECYCLE,
        "entrada_manual": InventoryCapability.REGISTER_ENTRY,
        "ajuste_inventario": InventoryCapability.ADJUST_STOCK,
    }
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
        "origen",
        "status",
        "created_at",
        "updated_at",
    ]
    ordering = ["categoria__name", "modelo"]

    def get_required_inventory_capability(self):
        if self.action == "export":
            return (
                InventoryCapability.EXPORT_OFFICIAL
                if self.request.query_params.get("mode", "view") == "official"
                else InventoryCapability.EXPORT_VIEW
            )

        return super().get_required_inventory_capability()

    @action(detail=False, methods=["get"], url_path="resumen")
    def resumen(self, request):
        productos_activos = Producto.objects.filter(
            status=BaseStatus.ACTIVO,
            descontinuado=False,
        )

        stock_fisico_total = ProductLocationBalance.objects.aggregate(
            total=Coalesce(
                Sum("quantity"),
                Value(0),
                output_field=IntegerField(),
            ),
        )["total"]

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
                "stock_fisico_total": stock_fisico_total or 0,
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

        product_origins = validate_choice_values(
            split_csv_param(params.get("origen")),
            set(ProductOrigin.values),
            "origen",
        )

        if product_origins:
            queryset = queryset.filter(origen__in=product_origins)

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

        grid_filters = parse_grid_filters_param(params.get("grid_filters"))
        return apply_grid_filters(
            queryset,
            PRODUCT_GRID_DEFINITION,
            grid_filters,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        mode = request.query_params.get("mode", "view")
        export_format = request.query_params.get("file_format", "xlsx")

        if mode not in {"view", "official"}:
            raise DRFValidationError(
                {"mode": "Use view para la vista u official para el esquema oficial."}
            )
        if export_format not in {"xlsx", "csv"}:
            raise DRFValidationError({"file_format": "Use xlsx o csv."})

        requested_columns = split_csv_param(request.query_params.get("columns"))
        columns = resolve_export_columns(
            mode=mode,
            requested_columns=requested_columns,
        )
        queryset = self.filter_queryset(self.get_queryset()).select_related("categoria")
        products = list(queryset[:5000])

        record_product_export(
            request=getattr(request, "_request", request),
            mode=mode,
            export_format=export_format,
            columns=columns,
            row_count=len(products),
        )
        self._skip_activity_audit(request)

        return build_product_export_response(
            queryset=products,
            mode=mode,
            export_format=export_format,
            columns=columns,
        )

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
            updated_product, _ = change_product_lifecycle(
                producto=producto,
                accion=serializer.validated_data["accion"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        return Response(
            ProductoSerializer(
                updated_product,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="cambiar-categoria")
    def cambiar_categoria(self, request, pk=None):
        producto = self.get_object()

        serializer = ProductoCategoriaChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_product = change_product_category(
                producto=producto,
                categoria_destino=serializer.validated_data["categoria_destino"],
                motivo=serializer.validated_data["motivo"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        django_request = getattr(request, "_request", request)
        django_request.skip_activity_audit = True

        return Response(
            ProductoSerializer(
                updated_product,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="cambiar-origen")
    def cambiar_origen(self, request, pk=None):
        producto = self.get_object()

        serializer = ProductoOrigenChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated_product = change_product_origin(
                producto=producto,
                origen=serializer.validated_data["origen"],
                origen_observacion=serializer.validated_data.get(
                    "origen_observacion",
                    "",
                ),
                motivo=serializer.validated_data["motivo"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        django_request = getattr(request, "_request", request)
        django_request.skip_activity_audit = True

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
                location=serializer.validated_data.get("ubicacion"),
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        output_serializer = MovimientoKardexSerializer(movement)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="ajuste-inventario",
    )
    def ajuste_inventario(self, request, pk=None):
        producto = self.get_object()

        serializer = InventoryAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movement = register_inventory_adjustment(
                producto=producto,
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data["motivo"],
                location=serializer.validated_data.get("ubicacion"),
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        output_serializer = MovimientoKardexSerializer(movement)

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class PendientePorRecibirViewSet(
    InventoryPermissionMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    inventory_default_write_capability = (
        InventoryCapability.MANAGE_PENDING_RECEIPTS
    )
    queryset = PendientePorRecibir.objects.select_related(
        "producto",
        "producto__categoria",
        "destination_location",
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
        "producto__modelo_normalized",
        "producto__categoria__name_normalized",
        "producto__codigo_sap_normalized",
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

        return apply_created_at_date_range(queryset, params)

    def create(self, request, *args, **kwargs):
        serializer = CrearPendientePorRecibirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            pending_receipt = create_pending_receipt(
                producto=serializer.validated_data["producto"],
                cantidad=serializer.validated_data["cantidad"],
                motivo=serializer.validated_data.get(
                    "motivo",
                    "",
                ),
                referencia=serializer.validated_data.get(
                    "referencia",
                    "",
                ),
                destination_location=serializer.validated_data.get(
                    "ubicacion_destino"
                ),
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

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
                request=getattr(
                    request,
                    "_request",
                    request,
                ),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

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
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)

        return Response(
            PendientePorRecibirSerializer(updated_pending_receipt).data,
            status=status.HTTP_200_OK,
        )


class InventoryLocationViewSet(
    InventoryPermissionMixin,
    viewsets.ModelViewSet,
):
    inventory_default_write_capability = InventoryCapability.MANAGE_LOCATIONS
    serializer_class = InventoryLocationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "name",
        "name_normalized",
        "city",
        "description",
        "custodian__first_name",
        "custodian__last_name",
    ]
    ordering_fields = [
        "name",
        "location_type",
        "status",
        "total_units",
        "created_at",
        "updated_at",
    ]
    ordering = ["name"]

    def get_queryset(self):
        queryset = (
            InventoryLocation.objects.select_related("custodian")
            .annotate(
                total_units=Coalesce(
                    Sum("product_balances__quantity"),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
            .all()
        )
        params = self.request.query_params

        statuses = validate_choice_values(
            split_csv_param(params.get("status")),
            {choice[0] for choice in BaseStatus.choices},
            "status",
        )
        if statuses:
            queryset = queryset.filter(status__in=statuses)

        location_types = split_csv_param(
            params.get("location_type") or params.get("tipo")
        )
        if location_types:
            validate_choice_values(
                location_types,
                set(InventoryLocationType.values),
                "location_type",
            )
            queryset = queryset.filter(location_type__in=location_types)

        return queryset

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Las ubicaciones no se eliminan. Use la acción controlada "
                    "de archivado."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"], url_path="archivar")
    def archivar(self, request, pk=None):
        serializer = InventoryLocationArchiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            location = archive_inventory_location(
                location=self.get_object(),
                reason=serializer.validated_data["reason"],
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)
        return Response(
            InventoryLocationSerializer(location).data,
            status=status.HTTP_200_OK,
        )


class ProductLocationBalanceViewSet(
    InventoryPermissionMixin,
    viewsets.ReadOnlyModelViewSet,
):
    serializer_class = ProductLocationBalanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "product__modelo",
        "product__codigo_sap",
        "product__categoria__name",
        "location__name",
    ]
    ordering_fields = [
        "product__modelo_normalized",
        "location__name_normalized",
        "quantity",
        "updated_at",
    ]
    ordering = ["product__modelo_normalized", "location__name_normalized"]
    queryset = ProductLocationBalance.objects.select_related(
        "product",
        "product__categoria",
        "location",
    ).all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        product_ids = parse_id_values(
            params.get("product") or params.get("producto"),
            "producto",
        )
        if product_ids:
            queryset = queryset.filter(product_id__in=product_ids)
        location_ids = parse_id_values(
            params.get("location") or params.get("ubicacion"),
            "ubicacion",
        )
        if location_ids:
            queryset = queryset.filter(location_id__in=location_ids)
        positive_only = parse_bool_param(
            params.get("positive_only"),
            "positive_only",
        )
        if positive_only:
            queryset = queryset.filter(quantity__gt=0)
        return queryset


class InventoryTransferViewSet(
    InventoryPermissionMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    inventory_default_write_capability = InventoryCapability.TRANSFER_STOCK
    inventory_action_capabilities = {
        "create": InventoryCapability.TRANSFER_STOCK,
    }
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "product__modelo",
        "product__codigo_sap",
        "product__categoria__name",
        "origin_location__name",
        "destination_location__name",
        "reason",
        "evidence_reference",
        "responsible__username",
        "responsible__first_name",
        "responsible__last_name",
    ]
    ordering_fields = [
        "transferred_at",
        "product__modelo_normalized",
        "origin_location__name_normalized",
        "destination_location__name_normalized",
        "quantity",
    ]
    ordering = ["-transferred_at", "-id"]
    queryset = InventoryTransfer.objects.select_related(
        "product",
        "product__categoria",
        "origin_location",
        "destination_location",
        "responsible",
    ).all()

    def get_serializer_class(self):
        if self.action == "create":
            return InventoryTransferCreateSerializer
        return InventoryTransferSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        product_ids = parse_id_values(
            params.get("product") or params.get("producto"),
            "producto",
        )
        if product_ids:
            queryset = queryset.filter(product_id__in=product_ids)
        location_ids = parse_id_values(
            params.get("location") or params.get("ubicacion"),
            "ubicacion",
        )
        if location_ids:
            queryset = queryset.filter(
                Q(origin_location_id__in=location_ids)
                | Q(destination_location_id__in=location_ids)
            )
        return apply_created_at_date_range(queryset, params)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        idempotency_key = str(
            request.headers.get("Idempotency-Key", "")
        ).strip()

        try:
            transfer, created = transfer_inventory(
                **serializer.validated_data,
                idempotency_key=idempotency_key,
                user=request.user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        self._skip_activity_audit(request)
        output = InventoryTransferSerializer(transfer)
        return Response(
            output.data,
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )


class MovimientoKardexViewSet(InventoryPermissionMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoKardex.objects.select_related(
        "producto",
        "producto__categoria",
        "operador",
        "location",
        "reference_content_type",
    ).all()
    serializer_class = MovimientoKardexSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "producto_modelo_snapshot",
        "producto_categoria_snapshot",
        "producto_codigo_sap_snapshot",
        "producto__modelo",
        "producto__modelo_normalized",
        "producto__codigo_sap",
        "producto__codigo_sap_normalized",
        "producto__categoria__name",
        "movement_type",
        "origin",
        "motivo",
        "reference_repr",
        "location_name_snapshot",
        "location__name",
    ]
    ordering_fields = [
        "created_at",
        "producto_modelo_orden",
        "producto_categoria_orden",
        "producto_codigo_sap_orden",
        "movement_type",
        "origin",
        "cantidad",
        "stock_antes",
        "stock_despues",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .annotate(
                producto_modelo_orden=Coalesce(
                    NullIf(
                        F("producto_modelo_snapshot"),
                        Value(""),
                    ),
                    F("producto__modelo"),
                    output_field=CharField(),
                ),
                producto_categoria_orden=Coalesce(
                    NullIf(
                        F("producto_categoria_snapshot"),
                        Value(""),
                    ),
                    F("producto__categoria__name"),
                    output_field=CharField(),
                ),
                producto_codigo_sap_orden=Coalesce(
                    NullIf(
                        F("producto_codigo_sap_snapshot"),
                        Value(""),
                    ),
                    F("producto__codigo_sap"),
                    output_field=CharField(),
                ),
            )
        )
        params = self.request.query_params

        product_ids = parse_id_values(
            params.get("producto"),
            "producto",
        )

        if product_ids:
            queryset = queryset.filter(producto_id__in=product_ids)

        location_ids = parse_id_values(
            params.get("location") or params.get("ubicacion"),
            "ubicacion",
        )
        if location_ids:
            queryset = queryset.filter(location_id__in=location_ids)

        movement_types = validate_choice_values(
            split_csv_param(params.get("movement_type")),
            {choice[0] for choice in KardexMovementType.choices},
            "movement_type",
        )

        if movement_types:
            queryset = queryset.filter(movement_type__in=movement_types)

        origins = validate_choice_values(
            split_csv_param(params.get("origin")),
            {choice[0] for choice in AuditOrigin.choices},
            "origin",
        )

        if origins:
            queryset = queryset.filter(origin__in=origins)

        statuses = validate_choice_values(
            split_csv_param(params.get("status")),
            {choice[0] for choice in BaseStatus.choices},
            "status",
        )

        if statuses:
            queryset = queryset.filter(status__in=statuses)

        return apply_created_at_date_range(queryset, params)
