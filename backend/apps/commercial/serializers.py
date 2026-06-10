from rest_framework import serializers

from .models import (
    Area,
    Ciudad,
    Contacto,
    ContactSubareaHistory,
    Holding,
    Minera,
    Subarea,
)


class CiudadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ciudad
        fields = [
            "id",
            "name",
            "name_normalized",
            "region",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "name_normalized", "created_at", "updated_at"]


class HoldingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Holding
        fields = [
            "id",
            "name",
            "name_normalized",
            "aliases",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "name_normalized", "created_at", "updated_at"]


class MineraSerializer(serializers.ModelSerializer):
    holding_name = serializers.CharField(source="holding.name", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)

    class Meta:
        model = Minera
        fields = [
            "id",
            "name",
            "name_normalized",
            "rut",
            "rut_normalized",
            "holding",
            "holding_name",
            "city",
            "city_name",
            "aliases",
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
            "name_normalized",
            "rut_normalized",
            "holding_name",
            "city_name",
            "created_at",
            "updated_at",
        ]


class AreaSerializer(serializers.ModelSerializer):
    minera_name = serializers.CharField(source="minera.name", read_only=True)
    holding = serializers.IntegerField(source="minera.holding.id", read_only=True)
    holding_name = serializers.CharField(source="minera.holding.name", read_only=True)

    class Meta:
        model = Area
        fields = [
            "id",
            "minera",
            "minera_name",
            "holding",
            "holding_name",
            "name",
            "name_normalized",
            "location",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "minera_name",
            "holding",
            "holding_name",
            "name_normalized",
            "created_at",
            "updated_at",
        ]


class SubareaSerializer(serializers.ModelSerializer):
    area_name = serializers.CharField(source="area.name", read_only=True)
    minera = serializers.IntegerField(source="area.minera.id", read_only=True)
    minera_name = serializers.CharField(source="area.minera.name", read_only=True)
    holding = serializers.IntegerField(source="area.minera.holding.id", read_only=True)
    holding_name = serializers.CharField(source="area.minera.holding.name", read_only=True)

    class Meta:
        model = Subarea
        fields = [
            "id",
            "area",
            "area_name",
            "minera",
            "minera_name",
            "holding",
            "holding_name",
            "name",
            "name_normalized",
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
            "holding",
            "holding_name",
            "name_normalized",
            "created_at",
            "updated_at",
        ]


class ContactoSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    holding = serializers.IntegerField(source="subarea.area.minera.holding.id", read_only=True)
    holding_name = serializers.CharField(source="subarea.area.minera.holding.name", read_only=True)

    minera = serializers.IntegerField(source="subarea.area.minera.id", read_only=True)
    minera_name = serializers.CharField(source="subarea.area.minera.name", read_only=True)

    area = serializers.IntegerField(source="subarea.area.id", read_only=True)
    area_name = serializers.CharField(source="subarea.area.name", read_only=True)

    subarea_name = serializers.CharField(source="subarea.name", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)
    shift_mode_display = serializers.CharField(source="get_shift_mode_display", read_only=True)

    class Meta:
        model = Contacto
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "full_name_normalized",
            "position",
            "holding",
            "holding_name",
            "minera",
            "minera_name",
            "area",
            "area_name",
            "subarea",
            "subarea_name",
            "city",
            "city_name",
            "email",
            "email_normalized",
            "phone",
            "phone_normalized",
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
            "full_name_normalized",
            "holding",
            "holding_name",
            "minera",
            "minera_name",
            "area",
            "area_name",
            "subarea_name",
            "city_name",
            "email_normalized",
            "phone_normalized",
            "shift_mode_display",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return obj.full_name


class ContactSubareaHistorySerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source="contact.full_name", read_only=True)
    old_subarea_name = serializers.CharField(source="old_subarea.name", read_only=True)
    new_subarea_name = serializers.CharField(source="new_subarea.name", read_only=True)
    changed_by_name = serializers.CharField(source="changed_by.get_full_name", read_only=True)

    class Meta:
        model = ContactSubareaHistory
        fields = [
            "id",
            "contact",
            "contact_name",
            "old_subarea",
            "old_subarea_name",
            "new_subarea",
            "new_subarea_name",
            "changed_by",
            "changed_by_name",
            "reason",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "contact_name",
            "old_subarea_name",
            "new_subarea_name",
            "changed_by",
            "changed_by_name",
            "created_at",
            "updated_at",
        ]