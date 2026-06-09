from rest_framework import serializers

from .models import (
    Ciudad,
    Holding,
    Minera,
    Area,
    Subarea,
    Contacto,
)

class CiudadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciudad
        fields = [
            "id",
            "name",
            "region",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

class HoldingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Holding
        fields = [
            "id",
            "name",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

class MineraSerializer(serializers.ModelSerializer):
    holding_name = serializers.CharField(
        source="holding.name",
        read_only=True,
    )
    city_name = serializers.CharField(
        source="city.name",
        read_only=True,
    )

    class Meta:
        model = Minera
        fields = [
            "id",
            "name",
            "rut",
            "holding",
            "holding_name",
            "city",
            "city_name",
            "email",
            "phone",
            "address",
            "status",
            "observations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", 
            "holding_name", 
            "city_name", 
            "created_at", 
            "updated_at"
        ]

class AreaSerializer(serializers.ModelSerializer):
    minera_name = serializers.CharField(
        source="minera.name",
        read_only=True,
    )

    class Meta:
        model = Area
        fields = [
            "id",
            "minera",
            "minera_name",
            "name",
            "location",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "minera_name", "created_at", "updated_at"]

class SubareaSerializer(serializers.ModelSerializer):
    area_name = serializers.CharField(
        source="area.name",
        read_only=True,
    )
    minera = serializers.IntegerField(
        source="area.minera.id",
        read_only=True,
    )
    minera_name = serializers.CharField(
        source="area.minera.name",
        read_only=True,
    )

    class Meta:
        model = Subarea
        fields = [
            "id",
            "area",
            "area_name",
            "minera",
            "minera_name",
            "name",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "area_name",
            "minera",
            "minera_name",
            "created_at",
            "updated_at",
        ]

class ContactoSerializer(serializers.ModelSerializer):
    minera_name = serializers.CharField(
        source="minera.name",
        read_only=True,
    )
    area_name = serializers.CharField(
        source="area.name",
        read_only=True,
    )
    subarea_name = serializers.CharField(
        source="subarea.name",
        read_only=True,
    )
    city_name = serializers.CharField(
        source="city.name",
        read_only=True,
    )
    shift_mode_display = serializers.CharField(
        source="get_shift_mode_display",
        read_only=True,
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Contacto
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "position",
            "minera",
            "minera_name",
            "city",
            "city_name",
            "area",
            "area_name",
            "subarea",
            "subarea_name",
            "email",
            "phone",
            "shift",
            "active_days",
            "rest_days",
            "active_cycle_start_date",
            "shift_mode",
            "shift_mode_display",
            "status",
            "observations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "full_name",
            "minera_name",
            "area_name",
            "subarea_name",
            "city_name",
            "shift_mode_display",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()