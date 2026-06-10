from rest_framework import serializers
from .models import Categoria, Producto, MovimientoKardex

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = "__all__"

class ProductoSerializer(serializers.ModelSerializer):
    categoria_name = serializers.CharField(source="categoria.name", read_only=True)

    class Meta:
        model = Producto
        fields = "__all__"

class MovimientoKardexSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(source="producto.modelo", read_only=True)
    operador_nombre = serializers.CharField(source="operador.first_name", read_only=True)

    class Meta:
        model = MovimientoKardex
        fields = "__all__"