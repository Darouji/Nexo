from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from apps.core.models import BaseStatus
from apps.inventory.models import InventoryLocation, Producto

from .models import DetalleVenta, Venta, VentaAlert
from .services import create_sale_with_details, update_sale_metadata


def raise_drf_validation_error(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise serializers.ValidationError(error.messages)

    raise serializers.ValidationError(str(error))


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(source="producto.modelo", read_only=True)
    producto_categoria = serializers.CharField(
        source="producto.categoria.name", read_only=True
    )
    producto_controla_stock = serializers.BooleanField(
        source="producto.controla_stock",
        read_only=True,
    )

    class Meta:
        model = DetalleVenta
        fields = [
            "id",
            "venta",
            "producto",
            "producto_modelo",
            "producto_categoria",
            "producto_controla_stock",
            "ubicacion_salida",
            "cantidad",
            "valor_unitario",
            "valor_total",
            "codigo_sap",
            "controla_stock_snapshot",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DetalleVentaInputSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    ubicacion_salida = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(), required=False, allow_null=True
    )
    cantidad = serializers.IntegerField(min_value=1)
    valor_unitario = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=0,
    )
    codigo_sap = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )


class VentaAlertSerializer(serializers.ModelSerializer):
    code_display = serializers.CharField(source="get_code_display", read_only=True)
    severity_display = serializers.CharField(
        source="get_severity_display", read_only=True
    )

    class Meta:
        model = VentaAlert
        fields = [
            "id",
            "code",
            "code_display",
            "message",
            "severity",
            "severity_display",
            "is_active",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class VentaSerializer(serializers.ModelSerializer):
    detalles = serializers.SerializerMethodField()
    lineas = DetalleVentaInputSerializer(many=True, write_only=True, required=False)

    alerts = VentaAlertSerializer(many=True, read_only=True)
    validation_summary = serializers.CharField(read_only=True)

    minera_name = serializers.CharField(source="minera.name", read_only=True)
    area_name = serializers.CharField(source="area.name", read_only=True)
    subarea_name = serializers.CharField(source="subarea.name", read_only=True)
    contacto_name = serializers.CharField(source="contacto.full_name", read_only=True)

    operador_nombre = serializers.SerializerMethodField()
    sale_status_display = serializers.CharField(
        source="get_sale_status_display", read_only=True
    )
    tipo_documento_display = serializers.CharField(
        source="get_tipo_documento_display",
        read_only=True,
    )

    class Meta:
        model = Venta
        fields = [
            "id",
            "operador",
            "operador_nombre",
            "sale_status",
            "sale_status_display",
            "fecha_venta",
            "fecha_factura",
            "factura_numero",
            "factura_pdf",
            "orden_compra",
            "minera",
            "minera_name",
            "area",
            "area_name",
            "subarea",
            "subarea_name",
            "contacto",
            "contacto_name",
            "valor_neto",
            "iva",
            "total",
            "tipo_documento",
            "tipo_documento_display",
            "numero_guia_hes",
            "guia_pdf",
            "stock_descontado",
            "concretada_at",
            "concretada_by",
            "anulada_at",
            "anulada_by",
            "anulacion_motivo",
            "observations",
            "detalles",
            "lineas",
            "alerts",
            "validation_summary",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "operador",
            "operador_nombre",
            "sale_status",
            "sale_status_display",
            "valor_neto",
            "iva",
            "total",
            "stock_descontado",
            "concretada_at",
            "concretada_by",
            "anulada_at",
            "anulada_by",
            "anulacion_motivo",
            "detalles",
            "alerts",
            "validation_summary",
            "status",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(DetalleVentaSerializer(many=True))
    def get_detalles(self, obj):
        detalles = obj.detalles.all()
        detalles_activos = [
            detalle for detalle in detalles if detalle.status == BaseStatus.ACTIVO
        ]

        return DetalleVentaSerializer(
            detalles_activos,
            many=True,
            context=self.context,
        ).data

    @extend_schema_field(OpenApiTypes.STR)
    def get_operador_nombre(self, obj):
        if not obj.operador:
            return ""

        return obj.operador.get_full_name().strip() or obj.operador.username

    def validate(self, attrs):
        if self.instance is None and not attrs.get("lineas"):
            raise serializers.ValidationError(
                {"lineas": "La venta debe tener al menos una línea de detalle."}
            )

        return attrs

    def create(self, validated_data):
        details_data = validated_data.pop("lineas", [])
        request = self.context.get("request")
        user = request.user if request else None

        try:
            return create_sale_with_details(
                sale_data=validated_data,
                details_data=details_data,
                user=user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)

    def update(self, instance, validated_data):
        if "lineas" in validated_data:
            raise serializers.ValidationError(
                {
                    "lineas": (
                        "La edición de líneas de venta requiere un flujo diferencial "
                        "de Kardex y se implementará como acción controlada."
                    )
                }
            )

        request = self.context.get("request")
        user = request.user if request else None

        try:
            return update_sale_metadata(
                venta=instance,
                sale_data=validated_data,
                user=user,
            )
        except DjangoValidationError as error:
            raise_drf_validation_error(error)


class AnularVentaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo de anulación es obligatorio.")

        return value


class ActualizarLineasVentaSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500)
    lineas = DetalleVentaInputSerializer(many=True)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo de edición de líneas es obligatorio."
            )

        return value

    def validate_lineas(self, value):
        if not value:
            raise serializers.ValidationError(
                "La venta debe tener al menos una línea de detalle."
            )

        return value
