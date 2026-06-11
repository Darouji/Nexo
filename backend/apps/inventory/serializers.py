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
            "stock_status",
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
            "created_at",
            "updated_at",
        ]

    def get_stock(self, obj):
        return obj.stock_actual

    def get_stock_status(self, obj):
        if not obj.controla_stock:
            return "NO_CONTROLA_STOCK"

        if obj.is_stock_critical:
            return "STOCK_CRITICO"

        return "OK"


class MovimientoKardexSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(source="producto.modelo", read_only=True)
    producto_categoria = serializers.CharField(source="producto.categoria.name", read_only=True)
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

    def get_operador_nombre(self, obj):
        if not obj.operador:
            return ""

        return obj.operador.get_full_name().strip() or obj.operador.username

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
            raise serializers.ValidationError("La cantidad del ajuste no puede ser cero.")

        return value

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value