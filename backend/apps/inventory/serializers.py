from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from .models import Categoria, KardexMovementType, MovimientoKardex, Producto


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
    categoria_name = serializers.CharField(source="categoria.name", read_only=True)
    stock = serializers.SerializerMethodField()
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
            "en_camino",
            "controla_stock",
            "descontinuado",
            "stock_status",
            "estado_producto",
            "estado_producto_display",
            "status",
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
            "estado_producto",
            "estado_producto_display",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(OpenApiTypes.INT)
    def get_stock(self, obj):
        return obj.stock_actual

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
    producto_modelo = serializers.CharField(source="producto.modelo", read_only=True)
    producto_categoria = serializers.CharField(
        source="producto.categoria.name", read_only=True
    )
    producto_codigo_sap = serializers.CharField(
        source="producto.codigo_sap",
        read_only=True,
    )
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
