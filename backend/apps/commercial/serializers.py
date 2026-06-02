from rest_framework import serializers

from .models import (
    AreaCliente,
    Ciudad,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
    SubAreaCliente,
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

class GrupoEmpresarialSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrupoEmpresarial
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
    business_group_name = serializers.CharField(
        source="business_group.name",
        read_only=True,
    )

    class Meta:
        model = Minera
        fields = [
            "id",
            "name",
            "business_group",
            "business_group_name",
            "rut",
            "status",
            "observations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "business_group_name", "created_at", "updated_at"]


class EmpresaClienteSerializer(serializers.ModelSerializer):
    mining_company_name = serializers.CharField(
        source="mining_company.name",
        read_only=True,
    )
    business_group_name = serializers.CharField(
        source="mining_company.business_group.name",
        read_only=True,
    )
    city_name = serializers.CharField(
        source="city.name",
        read_only=True,
    )

    class Meta:
        model = EmpresaCliente
        fields = [
            "id",
            "name",
            "rut",
            "mining_company",
            "mining_company_name",
            "city",
            "city_name",
            "business_group_name",
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
            "mining_company_name",
            "city_name",
            "business_group_name",
            "created_at",
            "updated_at",
        ]


class AreaClienteSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
    )

    class Meta:
        model = AreaCliente
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "location",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company_name", "created_at", "updated_at"]

class SubAreaClienteSerializer(serializers.ModelSerializer):
    area_name = serializers.CharField(
        source="area.name",
        read_only=True,
    )
    company = serializers.IntegerField(
        source="area.company.id",
        read_only=True,
    )
    company_name = serializers.CharField(
        source="area.company.name",
        read_only=True,
    )

    class Meta:
        model = SubAreaCliente
        fields = [
            "id",
            "area",
            "area_name",
            "company",
            "company_name",
            "name",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "area_name",
            "company",
            "company_name",
            "created_at",
            "updated_at",
        ]

class ContactoClienteSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(
        source="company.name",
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
        model = ContactoCliente
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "position",
            "company",
            "company_name",
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
            "company_name",
            "area_name",
            "subarea_name",
            "city_name",
            "shift_mode_display",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()