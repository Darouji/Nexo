from rest_framework import serializers

from .models import (
    AreaCliente,
    ContactoCliente,
    EmpresaCliente,
    GrupoEmpresarial,
    Minera,
)


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

    class Meta:
        model = EmpresaCliente
        fields = [
            "id",
            "name",
            "rut",
            "mining_company",
            "mining_company_name",
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


class ContactoClienteSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
    )
    area_name = serializers.CharField(
        source="area.name",
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
            "area",
            "area_name",
            "email",
            "phone",
            "shift",
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
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()