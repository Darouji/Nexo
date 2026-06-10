from rest_framework import serializers
from .models import Venta, DetalleVenta

class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(source="producto.modelo", read_only=True)
    
    class Meta:
        model = DetalleVenta
        fields = "__all__"

class VentaSerializer(serializers.ModelSerializer):
    # Esto anida los detalles dentro de la venta para la "Fila Desplegable" en React
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    minera_name = serializers.CharField(source="minera.name", read_only=True)
    operador_nombre = serializers.CharField(source="operador.first_name", read_only=True)

    class Meta:
        model = Venta
        fields = "__all__"
        read_only_fields = ["operador", "created_at", "updated_at"]