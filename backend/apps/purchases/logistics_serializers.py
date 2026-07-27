from django.db.models import Sum
from rest_framework import serializers

from .logistics_models import (
    Carrier,
    PurchaseShipment,
    ShipmentCharge,
    ShipmentChargeStatus,
    ShipmentEvent,
)
from .models import PurchaseOrder


class CarrierSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Carrier
        fields = [
            "id", "name", "aliases", "country", "website_url",
            "tracking_url_template", "contact_name", "email", "phone",
            "status", "status_display", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        return Carrier.objects.create(
            **validated_data,
            created_by=user,
            updated_by=user,
        )

    def update(self, instance, validated_data):
        request = self.context.get("request")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_by = request.user if request else None
        instance.save()
        return instance


class CarrierResolveSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)


class ShipmentEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(
        source="get_event_type_display",
        read_only=True,
    )
    new_state_display = serializers.CharField(
        source="get_new_state_display",
        read_only=True,
    )
    new_custodian_display = serializers.CharField(
        source="get_new_custodian_display",
        read_only=True,
    )
    responsible_name = serializers.CharField(
        source="responsible.username",
        read_only=True,
    )

    class Meta:
        model = ShipmentEvent
        fields = [
            "id", "event_type", "event_type_display", "title", "description",
            "occurred_at", "new_state", "new_state_display", "new_custodian",
            "new_custodian_display", "updated_eta", "evidence_reference",
            "responsible_name", "created_at",
        ]


class ShipmentEventInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentEvent
        fields = [
            "event_type", "title", "description", "occurred_at",
            "new_state", "new_custodian", "updated_eta", "evidence_reference",
        ]
        extra_kwargs = {
            "new_state": {"required": False, "allow_blank": True},
            "new_custodian": {"required": False, "allow_blank": True},
            "updated_eta": {"required": False, "allow_null": True},
            "description": {"required": False, "allow_blank": True},
            "evidence_reference": {"required": False, "allow_blank": True},
        }


class ShipmentChargeSerializer(serializers.ModelSerializer):
    charge_type_display = serializers.CharField(
        source="get_charge_type_display",
        read_only=True,
    )
    charge_status_display = serializers.CharField(
        source="get_charge_status_display",
        read_only=True,
    )
    responsible_name = serializers.CharField(
        source="responsible.username",
        read_only=True,
    )

    class Meta:
        model = ShipmentCharge
        fields = [
            "id", "charge_type", "charge_type_display", "description",
            "amount_original", "currency", "exchange_rate",
            "exchange_rate_date", "exchange_rate_source", "amount_clp",
            "charged_by", "reason", "source_reference", "charge_status",
            "charge_status_display", "responsible_name", "created_at",
        ]


class ShipmentChargeInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentCharge
        fields = [
            "charge_type", "description", "amount_original", "currency",
            "exchange_rate", "exchange_rate_date", "exchange_rate_source",
            "charged_by", "reason", "source_reference", "charge_status",
        ]
        extra_kwargs = {
            "exchange_rate": {"required": False},
            "exchange_rate_date": {"required": False, "allow_null": True},
            "exchange_rate_source": {"required": False, "allow_blank": True},
            "charged_by": {"required": False, "allow_blank": True},
            "source_reference": {"required": False, "allow_blank": True},
            "charge_status": {"required": False},
        }


class PurchaseShipmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number", read_only=True)
    supplier_name = serializers.CharField(
        source="order.supplier.legal_name",
        read_only=True,
    )
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    transport_mode_display = serializers.CharField(
        source="get_transport_mode_display",
        read_only=True,
    )
    state_display = serializers.CharField(source="get_state_display", read_only=True)
    current_custodian_display = serializers.CharField(
        source="get_current_custodian_display",
        read_only=True,
    )
    responsible_name = serializers.CharField(
        source="responsible.username",
        read_only=True,
    )
    effective_eta = serializers.DateField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True, allow_null=True)
    tracking_url = serializers.URLField(read_only=True, allow_blank=True)
    events = ShipmentEventSerializer(many=True, read_only=True)
    charges = ShipmentChargeSerializer(many=True, read_only=True)
    confirmed_charges_clp = serializers.SerializerMethodField()
    open_charges_clp = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseShipment
        fields = [
            "id", "order", "order_number", "supplier_name", "carrier",
            "carrier_name", "transport_mode", "transport_mode_display",
            "tracking_number", "tracking_url", "origin_country", "origin_place",
            "destination_place", "shipped_date", "initial_eta", "current_eta",
            "effective_eta", "days_remaining", "actual_arrival_date", "state",
            "state_display", "current_custodian", "current_custodian_display",
            "customs_review_expected", "customs_review_reason", "notes",
            "responsible", "responsible_name", "confirmed_charges_clp",
            "open_charges_clp", "events", "charges", "created_at", "updated_at",
        ]
        read_only_fields = [
            "responsible", "created_at", "updated_at",
        ]

    def _sum_charges(self, instance, statuses):
        value = instance.charges.filter(
            charge_status__in=statuses
        ).aggregate(total=Sum("amount_clp"))["total"]
        return value or 0

    def get_confirmed_charges_clp(self, instance):
        return self._sum_charges(instance, [ShipmentChargeStatus.CONFIRMADO])

    def get_open_charges_clp(self, instance):
        return self._sum_charges(
            instance,
            [
                ShipmentChargeStatus.ESTIMADO,
                ShipmentChargeStatus.EN_DISPUTA,
            ],
        )


class PurchaseShipmentInputSerializer(serializers.ModelSerializer):
    order = serializers.PrimaryKeyRelatedField(
        queryset=PurchaseOrder.objects.select_related("supplier").all()
    )
    carrier = serializers.PrimaryKeyRelatedField(
        queryset=Carrier.objects.all()
    )

    class Meta:
        model = PurchaseShipment
        fields = [
            "order", "carrier", "transport_mode", "tracking_number",
            "origin_country", "origin_place", "destination_place",
            "shipped_date", "initial_eta", "current_eta",
            "actual_arrival_date", "state", "current_custodian",
            "customs_review_expected", "customs_review_reason", "notes",
        ]
        extra_kwargs = {
            "tracking_number": {"required": False, "allow_blank": True},
            "origin_country": {"required": False, "allow_blank": True},
            "origin_place": {"required": False, "allow_blank": True},
            "shipped_date": {"required": False, "allow_null": True},
            "initial_eta": {"required": False, "allow_null": True},
            "current_eta": {"required": False, "allow_null": True},
            "actual_arrival_date": {"required": False, "allow_null": True},
            "customs_review_expected": {"required": False},
            "customs_review_reason": {"required": False, "allow_blank": True},
            "notes": {"required": False, "allow_blank": True},
        }
