from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Exists, OuterRef, Q
from django.utils.dateparse import parse_date
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import UserRole
from apps.accounts.permissions import (
    CanViewAuditLogs,
    IsConsultaOrOperativoGlobal,
    user_has_role,
)
from apps.core.models import AlertSeverity, BaseStatus, RecordChangeLog
from apps.core.serializers import RecordChangeLogSerializer
from apps.inventory.models import MovimientoKardex
from apps.inventory.serializers import MovimientoKardexSerializer

from .models import DetalleVenta, Venta, VentaAlert, VentaStatus
from .serializers import (
    ActualizarLineasVentaSerializer,
    AnularVentaSerializer,
    DetalleVentaSerializer,
    VentaSerializer,
)
from .services import (
    annul_sale,
    concretar_sale,
    replace_sale_details_with_differential_kardex,
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


def parse_date_param(value, param_name):
    if not value:
        return None

    parsed_value = parse_date(str(value))

    if parsed_value is None:
        raise DRFValidationError(
            {param_name: "Fecha inválida. Use formato YYYY-MM-DD."}
        )

    return parsed_value


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
        elif self.action == "trazabilidad":
            permission_classes = [IsAuthenticated, CanViewAuditLogs]
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

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        active_alerts = VentaAlert.objects.filter(
            venta=OuterRef("pk"),
            is_active=True,
        )
        blocking_alerts = active_alerts.filter(
            severity=AlertSeverity.BLOQUEANTE,
        )

        queryset = queryset.annotate(
            has_active_alerts=Exists(active_alerts),
            has_blocking_alerts=Exists(blocking_alerts),
        )

        sale_status_values = validate_choice_values(
            split_csv_param(params.get("sale_status")),
            {choice[0] for choice in VentaStatus.choices},
            "sale_status",
        )
        if sale_status_values:
            queryset = queryset.filter(sale_status__in=sale_status_values)

        status_values = validate_choice_values(
            split_csv_param(params.get("status")),
            {choice[0] for choice in BaseStatus.choices},
            "status",
        )
        if status_values:
            queryset = queryset.filter(status__in=status_values)

        minera_ids = parse_id_values(params.get("minera"), "minera")
        if minera_ids:
            queryset = queryset.filter(minera_id__in=minera_ids)

        area_ids = parse_id_values(params.get("area"), "area")
        if area_ids:
            queryset = queryset.filter(area_id__in=area_ids)

        subarea_ids = parse_id_values(params.get("subarea"), "subarea")
        if subarea_ids:
            queryset = queryset.filter(subarea_id__in=subarea_ids)

        contacto_ids = parse_id_values(params.get("contacto"), "contacto")
        if contacto_ids:
            queryset = queryset.filter(contacto_id__in=contacto_ids)

        operador_ids = parse_id_values(params.get("operador"), "operador")
        if operador_ids:
            queryset = queryset.filter(operador_id__in=operador_ids)

        fecha_desde = parse_date_param(
            params.get("fecha_desde") or params.get("fecha_venta_desde"),
            "fecha_desde",
        )
        if fecha_desde:
            queryset = queryset.filter(fecha_venta__gte=fecha_desde)

        fecha_hasta = parse_date_param(
            params.get("fecha_hasta") or params.get("fecha_venta_hasta"),
            "fecha_hasta",
        )
        if fecha_hasta:
            queryset = queryset.filter(fecha_venta__lte=fecha_hasta)

        fecha_factura_desde = parse_date_param(
            params.get("fecha_factura_desde"),
            "fecha_factura_desde",
        )
        if fecha_factura_desde:
            queryset = queryset.filter(fecha_factura__gte=fecha_factura_desde)

        fecha_factura_hasta = parse_date_param(
            params.get("fecha_factura_hasta"),
            "fecha_factura_hasta",
        )
        if fecha_factura_hasta:
            queryset = queryset.filter(fecha_factura__lte=fecha_factura_hasta)

        stock_descontado = parse_bool_param(
            params.get("stock_descontado"),
            "stock_descontado",
        )
        if stock_descontado is not None:
            queryset = queryset.filter(stock_descontado=stock_descontado)

        has_alerts = parse_bool_param(params.get("has_alerts"), "has_alerts")
        if has_alerts is True:
            queryset = queryset.filter(has_active_alerts=True)
        elif has_alerts is False:
            queryset = queryset.filter(has_active_alerts=False)

        alert_severity_values = validate_choice_values(
            split_csv_param(params.get("alert_severity")),
            {choice[0] for choice in AlertSeverity.choices},
            "alert_severity",
        )
        if alert_severity_values:
            queryset = queryset.filter(
                alerts__is_active=True,
                alerts__severity__in=alert_severity_values,
            )

        validation_summary = params.get("validation_summary")
        if validation_summary:
            allowed_summaries = {"OK", "CON_ALERTAS", "BLOQUEANTE"}
            validate_choice_values(
                [validation_summary],
                allowed_summaries,
                "validation_summary",
            )

            if validation_summary == "OK":
                queryset = queryset.filter(has_active_alerts=False)
            elif validation_summary == "CON_ALERTAS":
                queryset = queryset.filter(has_active_alerts=True)
            elif validation_summary == "BLOQUEANTE":
                queryset = queryset.filter(has_blocking_alerts=True)

        has_factura = parse_bool_param(params.get("has_factura"), "has_factura")
        factura_filter = Q(factura_numero__gt="") | (
            Q(factura_pdf__isnull=False) & ~Q(factura_pdf="")
        )
        if has_factura is True:
            queryset = queryset.filter(factura_filter)
        elif has_factura is False:
            queryset = queryset.exclude(factura_filter)

        has_guia = parse_bool_param(params.get("has_guia"), "has_guia")
        guia_filter = Q(numero_guia_hes__gt="") | (
            Q(guia_pdf__isnull=False) & ~Q(guia_pdf="")
        )
        if has_guia is True:
            queryset = queryset.filter(guia_filter)
        elif has_guia is False:
            queryset = queryset.exclude(guia_filter)

        return queryset

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        return queryset.distinct()

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

    @action(detail=True, methods=["post"], url_path="actualizar-lineas")
    def actualizar_lineas(self, request, pk=None):
        venta = self.get_object()
        input_serializer = ActualizarLineasVentaSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        try:
            venta = replace_sale_details_with_differential_kardex(
                venta=venta,
                details_data=input_serializer.validated_data["lineas"],
                reason=input_serializer.validated_data["motivo"],
                user=request.user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

        serializer = self.get_serializer(venta)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="trazabilidad")
    def trazabilidad(self, request, pk=None):
        venta = self.get_object()
        venta_content_type = ContentType.objects.get_for_model(
            venta,
            for_concrete_model=False,
        )

        record_changes = (
            RecordChangeLog.objects.select_related(
                "changed_by",
                "content_type",
            )
            .filter(
                content_type=venta_content_type,
                object_id=str(venta.pk),
            )
            .order_by("-created_at")
        )

        kardex_movements = (
            MovimientoKardex.objects.select_related(
                "producto",
                "producto__categoria",
                "operador",
                "reference_content_type",
            )
            .filter(
                reference_content_type=venta_content_type,
                reference_object_id=str(venta.pk),
            )
            .order_by("-created_at")
        )

        return Response(
            {
                "venta": self.get_serializer(venta).data,
                "cambios": RecordChangeLogSerializer(
                    record_changes,
                    many=True,
                    context={"request": request},
                ).data,
                "movimientos_kardex": MovimientoKardexSerializer(
                    kardex_movements,
                    many=True,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )


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
