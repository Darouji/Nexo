from django.db import transaction
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from .models import (
    Categoria,
    MovimientoKardex,
    PendientePorRecibir,
    Producto,
)
from .services import register_manual_entry


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = [
            "id",
            "name",
            "name_normalized",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "name_normalized",
            "created_at",
            "updated_at",
        ]


class ProductoSerializer(serializers.ModelSerializer):
    categoria_name = serializers.CharField(
        source="categoria.name",
        read_only=True,
    )
    stock = serializers.SerializerMethodField()
    por_recibir = serializers.SerializerMethodField()
    stock_inicial = serializers.IntegerField(
        write_only=True,
        required=False,
        min_value=0,
        default=0,
    )
    motivo_stock_inicial = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=255,
    )
    stock_status = serializers.SerializerMethodField()
    estado_producto = serializers.SerializerMethodField()
    estado_producto_display = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            "id",
            "categoria",
            "categoria_name",
            "modelo",
            "modelo_normalized",
            "detalle",
            "codigo_sap",
            "codigo_sap_normalized",
            "stock",
            "stock_actual",
            "stock_critico",
            "por_recibir",
            "controla_stock",
            "descontinuado",
            "stock_status",
            "estado_producto",
            "estado_producto_display",
            "status",
            "stock_inicial",
            "motivo_stock_inicial",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "categoria_name",
            "modelo_normalized",
            "codigo_sap_normalized",
            "stock",
            "stock_actual",
            "stock_status",
            "por_recibir",
            "estado_producto",
            "estado_producto_display",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        initial_stock = attrs.get("stock_inicial", 0)

        controla_stock = attrs.get(
            "controla_stock",
            self.instance.controla_stock if self.instance else True,
        )

        if self.instance and "stock_inicial" in self.initial_data:
            raise serializers.ValidationError(
                {
                    "stock_inicial": (
                        "El stock inicial solo se puede registrar al crear un producto. "
                        "Para cambios posteriores use Gestionar inventario."
                    )
                }
            )

        if initial_stock > 0 and not controla_stock:
            raise serializers.ValidationError(
                {
                    "stock_inicial": (
                        "Un producto que no maneja inventario no puede tener stock inicial."
                    )
                }
            )

        if initial_stock > 0 and not attrs.get("motivo_stock_inicial", "").strip():
            raise serializers.ValidationError(
                {
                    "motivo_stock_inicial": (
                        "El motivo del stock inicial es obligatorio cuando la cantidad "
                        "es mayor a cero."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        initial_stock = validated_data.pop("stock_inicial", 0)

        initial_stock_reason = validated_data.pop(
            "motivo_stock_inicial",
            "",
        ).strip()

        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        with transaction.atomic():
            product = Producto.objects.create(**validated_data)

            if initial_stock > 0:
                register_manual_entry(
                    producto=product,
                    cantidad=initial_stock,
                    motivo=initial_stock_reason,
                    user=user,
                )

        return product

    @extend_schema_field(OpenApiTypes.INT)
    def get_stock(self, obj):
        return obj.stock_actual

    @extend_schema_field(OpenApiTypes.INT)
    def get_por_recibir(self, obj):
        if hasattr(obj, "por_recibir_total"):
            return obj.por_recibir_total

        return sum(
            pendiente.cantidad_pendiente
            for pendiente in obj.pendientes_por_recibir.filter(
                estado__in=["PENDIENTE", "PARCIAL"]
            )
        )

    @extend_schema_field(OpenApiTypes.STR)
    def get_stock_status(self, obj):
        return obj.stock_status

    @extend_schema_field(OpenApiTypes.STR)
    def get_estado_producto(self, obj):
        return obj.estado_producto

    @extend_schema_field(OpenApiTypes.STR)
    def get_estado_producto_display(self, obj):
        return obj.estado_producto_display


class MovimientoKardexSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.SerializerMethodField()
    producto_categoria = serializers.SerializerMethodField()
    producto_codigo_sap = serializers.SerializerMethodField()
    operador_nombre = serializers.SerializerMethodField()
    movement_type_display = serializers.CharField(
        source="get_movement_type_display",
        read_only=True,
    )
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    reference = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoKardex
        fields = [
            "id",
            "producto",
            "producto_modelo",
            "producto_categoria",
            "producto_codigo_sap",
            "movement_type",
            "movement_type_display",
            "origin",
            "origin_display",
            "operador",
            "operador_nombre",
            "cantidad",
            "stock_antes",
            "stock_despues",
            "motivo",
            "reference_content_type",
            "reference_object_id",
            "reference_repr",
            "reference",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_modelo(self, obj):
        return obj.producto_modelo_snapshot or obj.producto.modelo

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_categoria(self, obj):
        return obj.producto_categoria_snapshot or obj.producto.categoria.name

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_codigo_sap(self, obj):
        return obj.producto_codigo_sap_snapshot or obj.producto.codigo_sap

    @extend_schema_field(OpenApiTypes.STR)
    def get_operador_nombre(self, obj):
        if not obj.operador:
            return ""

        return obj.operador.get_full_name().strip() or obj.operador.username

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_reference(self, obj):
        if not obj.reference_object_id:
            return None

        return {
            "content_type": obj.reference_content_type_id,
            "object_id": obj.reference_object_id,
            "repr": obj.reference_repr,
        }


class ManualStockEntrySerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class InventoryAdjustmentSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField()
    motivo = serializers.CharField(max_length=255)

    def validate_cantidad(self, value):
        if value == 0:
            raise serializers.ValidationError(
                "La cantidad del ajuste no puede ser cero."
            )

        return value

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class CrearPendientePorRecibirSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.IntegerField(min_value=1)
    referencia = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )
    motivo = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        if (
            not attrs.get("motivo", "").strip()
            and not attrs.get("referencia", "").strip()
        ):
            raise serializers.ValidationError(
                {
                    "motivo": (
                        "Debe indicar un motivo o una referencia para registrar "
                        "un pendiente por recibir."
                    )
                }
            )

        return attrs


class OperacionPendientePorRecibirSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class PendientePorRecibirSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(
        source="producto.modelo",
        read_only=True,
    )
    producto_categoria = serializers.CharField(
        source="producto.categoria.name",
        read_only=True,
    )
    producto_codigo_sap = serializers.CharField(
        source="producto.codigo_sap",
        read_only=True,
    )
    cantidad_pendiente = serializers.IntegerField(read_only=True)
    estado_display = serializers.CharField(
        source="get_estado_display",
        read_only=True,
    )
    created_by_nombre = serializers.SerializerMethodField()
    updated_by_nombre = serializers.SerializerMethodField()

    class Meta:
        model = PendientePorRecibir
        fields = [
            "id",
            "producto",
            "producto_modelo",
            "producto_categoria",
            "producto_codigo_sap",
            "cantidad_original",
            "cantidad_recibida",
            "cantidad_cancelada",
            "cantidad_pendiente",
            "estado",
            "estado_display",
            "referencia",
            "motivo",
            "status",
            "created_by",
            "created_by_nombre",
            "updated_by",
            "updated_by_nombre",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_created_by_nombre(self, obj):
        if not obj.created_by:
            return ""

        return obj.created_by.get_full_name().strip() or obj.created_by.username

    @extend_schema_field(OpenApiTypes.STR)
    def get_updated_by_nombre(self, obj):
        if not obj.updated_by:
            return ""

        return obj.updated_by.get_full_name().strip() or obj.updated_by.username
