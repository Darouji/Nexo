from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.inventory.models import InventoryLocation, PendientePorRecibir, Producto

from .models import (
    CostAllocation,
    LandedCost,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderOperation,
    PurchaseReceiptCommitment,
    Supplier,
)
from .services import create_purchase_order, edit_purchase_order


def _raise_drf(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)
    raise serializers.ValidationError(error.messages)


class SupplierSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id", "legal_name", "trade_name", "tax_id", "country", "contact_name",
            "email", "phone", "payment_terms", "notes", "status",
            "status_display", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        instance = Supplier(**validated_data, created_by=user, updated_by=user)
        try:
            instance.save()
        except DjangoValidationError as error:
            _raise_drf(error)
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_by = request.user if request else None
        try:
            instance.save()
        except DjangoValidationError as error:
            _raise_drf(error)
        return instance


class PurchaseOrderLineInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.select_related("categoria").all(),
        required=False, allow_null=True,
    )
    product_model_snapshot = serializers.CharField(required=False, allow_blank=True)
    product_sap_snapshot = serializers.CharField(required=False, allow_blank=True)
    product_category_snapshot = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1)
    unit_price_original = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0)
    tax_rate = serializers.DecimalField(max_digits=7, decimal_places=4, min_value=0, default=0)
    destination_location = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(), required=False, allow_null=True
    )


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    destination_location_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            "id", "product_id", "controls_inventory_snapshot", "product_model_snapshot", "product_sap_snapshot",
            "product_category_snapshot", "description", "quantity",
            "unit_price_original", "tax_rate", "subtotal_original",
            "tax_total_original", "total_original", "total_clp",
            "destination_location_id",
        ]


class PurchaseReceiptCommitmentSerializer(serializers.ModelSerializer):
    pending_receipt_id = serializers.IntegerField(read_only=True)
    order_line_id = serializers.IntegerField(read_only=True)
    order_id = serializers.IntegerField(source="order_line.order_id", read_only=True)
    order_number = serializers.CharField(source="order_line.order.number", read_only=True)
    product_model = serializers.CharField(source="order_line.product_model_snapshot", read_only=True)
    supplier_name = serializers.CharField(source="order_line.order.supplier.legal_name", read_only=True)
    product_sap = serializers.CharField(source="order_line.product_sap_snapshot", read_only=True)
    product_category = serializers.CharField(source="order_line.product_category_snapshot", read_only=True)
    last_operation_at = serializers.SerializerMethodField()
    last_operation_responsible = serializers.SerializerMethodField()
    destination_location_name = serializers.CharField(source="destination_location.name", read_only=True)
    received_quantity = serializers.IntegerField(read_only=True)
    pending_quantity = serializers.IntegerField(read_only=True)
    state = serializers.CharField(source="pending_receipt.estado", read_only=True)


    def _last_operation(self, instance):
        operations = list(instance.pending_receipt.operations.all())
        return operations[0] if operations else None

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_last_operation_at(self, instance):
        operation = self._last_operation(instance)
        return operation.created_at if operation else None

    @extend_schema_field(serializers.CharField())
    def get_last_operation_responsible(self, instance):
        operation = self._last_operation(instance)
        return operation.responsible.username if operation else ""

    class Meta:
        model = PurchaseReceiptCommitment
        fields = [
            "id", "order_id", "order_number", "order_line_id",
            "pending_receipt_id", "supplier_name", "product_model", "product_sap",
            "product_category", "destination_location",
            "destination_location_name", "committed_quantity",
            "received_quantity", "pending_quantity", "state",
            "last_operation_at", "last_operation_responsible", "created_at",
        ]


class PhysicalReceiptSerializer(serializers.ModelSerializer):
    pending_receipt_id = serializers.IntegerField(source="id", read_only=True)
    order_id = serializers.SerializerMethodField()
    order_number = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()
    origin = serializers.SerializerMethodField()
    origin_display = serializers.SerializerMethodField()
    product_model = serializers.CharField(source="producto.modelo", read_only=True)
    product_sap = serializers.CharField(source="producto.codigo_sap", read_only=True)
    product_category = serializers.CharField(source="producto.categoria.name", read_only=True)
    destination_location_name = serializers.CharField(
        source="destination_location.name", read_only=True
    )
    committed_quantity = serializers.IntegerField(source="cantidad_original", read_only=True)
    received_quantity = serializers.IntegerField(source="cantidad_recibida", read_only=True)
    cancelled_quantity = serializers.IntegerField(source="cantidad_cancelada", read_only=True)
    pending_quantity = serializers.IntegerField(source="cantidad_pendiente", read_only=True)
    state = serializers.CharField(source="estado", read_only=True)
    state_display = serializers.CharField(source="get_estado_display", read_only=True)

    def _commitment(self, instance):
        try:
            return instance.purchase_commitment
        except PurchaseReceiptCommitment.DoesNotExist:
            return None

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_order_id(self, instance):
        commitment = self._commitment(instance)
        return commitment.order_line.order_id if commitment else None

    @extend_schema_field(serializers.CharField())
    def get_order_number(self, instance):
        commitment = self._commitment(instance)
        return commitment.order_line.order.number if commitment else ""

    @extend_schema_field(serializers.CharField())
    def get_supplier_name(self, instance):
        commitment = self._commitment(instance)
        return commitment.order_line.order.supplier.legal_name if commitment else ""

    @extend_schema_field(serializers.CharField())
    def get_origin(self, instance):
        return "PURCHASE_ORDER" if self._commitment(instance) else "MANUAL"

    @extend_schema_field(serializers.CharField())
    def get_origin_display(self, instance):
        return "Orden de compra" if self._commitment(instance) else "Registro manual"

    class Meta:
        model = PendientePorRecibir
        fields = [
            "id", "pending_receipt_id", "order_id", "order_number", "supplier_name",
            "origin", "origin_display", "producto", "product_model", "product_sap",
            "product_category", "destination_location", "destination_location_name",
            "committed_quantity", "received_quantity", "cancelled_quantity",
            "pending_quantity", "state", "state_display", "referencia", "motivo",
            "created_at",
        ]
        read_only_fields = fields

class LandedCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandedCost
        fields = [
            "id", "cost_type", "description", "amount_original", "currency",
            "exchange_rate", "exchange_rate_date", "exchange_rate_source",
            "amount_clp", "quality", "source_reference",
            "created_at",
        ]
        read_only_fields = ["amount_clp", "created_at"]


class CostAllocationSerializer(serializers.ModelSerializer):
    order_line_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CostAllocation
        fields = ["id", "order_line_id", "amount_clp", "quality", "rationale"]


class PurchaseOrderOperationSerializer(serializers.ModelSerializer):
    responsible_name = serializers.CharField(source="responsible.username", read_only=True)

    class Meta:
        model = PurchaseOrderOperation
        fields = [
            "id", "operation_type", "previous_state", "new_state", "reason",
            "payload", "responsible_name", "created_at",
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.SerializerMethodField()
    responsible_name = serializers.CharField(source="responsible.username", read_only=True)
    state_display = serializers.CharField(source="get_state_display", read_only=True)
    currency_display = serializers.CharField(source="get_currency_display", read_only=True)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    receipt_commitments = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "number", "supplier", "supplier_name", "order_date",
            "expected_date", "currency", "currency_display", "exchange_rate",
            "exchange_rate_date", "exchange_rate_source", "state", "state_display",
            "responsible", "responsible_name", "subtotal_original",
            "tax_total_original", "total_original", "total_clp", "cost_quality",
            "notes", "lines", "receipt_commitments", "created_at", "updated_at",
        ]
        read_only_fields = [
            "state", "subtotal_original", "tax_total_original", "total_original",
            "total_clp", "cost_quality", "created_at", "updated_at",
        ]

    @extend_schema_field(serializers.CharField())
    def get_supplier_name(self, instance):
        return str(instance.supplier)

    @extend_schema_field(PurchaseReceiptCommitmentSerializer(many=True))
    def get_receipt_commitments(self, instance):
        commitments = [
            commitment
            for line in instance.lines.all()
            for commitment in line.receipt_commitments.all()
        ]
        return PurchaseReceiptCommitmentSerializer(commitments, many=True).data


class PurchaseOrderWriteSerializer(serializers.ModelSerializer):
    lines = PurchaseOrderLineInputSerializer(many=True, required=False)

    class Meta:
        model = PurchaseOrder
        fields = [
            "number", "supplier", "order_date", "expected_date", "currency",
            "exchange_rate", "exchange_rate_date", "exchange_rate_source",
            "responsible", "notes", "lines",
        ]
        extra_kwargs = {
            "number": {"required": False, "allow_blank": True},
            "responsible": {"required": False},
        }

    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        request = self.context["request"]
        try:
            return create_purchase_order(
                data=validated_data, lines=lines,
                idempotency_key=str(request.headers.get("Idempotency-Key", "")).strip(),
                user=request.user, request=request
            )
        except DjangoValidationError as error:
            _raise_drf(error)

    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        request = self.context["request"]
        try:
            return edit_purchase_order(
                order=instance, data=validated_data, lines=lines,
                user=request.user, request=request,
            )
        except DjangoValidationError as error:
            _raise_drf(error)


class OperationRequestSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class ReceiveCommitmentSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255)


class LandedCostInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandedCost
        fields = [
            "cost_type", "description", "amount_original", "currency",
            "exchange_rate", "exchange_rate_date", "exchange_rate_source",
            "quality", "source_reference",
        ]


class CostAllocationInputSerializer(serializers.Serializer):
    order_line = serializers.PrimaryKeyRelatedField(queryset=PurchaseOrderLine.objects.all())
    amount_clp = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0)
    quality = serializers.ChoiceField(choices=CostAllocation._meta.get_field("quality").choices)
    rationale = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AllocateCostRequestSerializer(serializers.Serializer):
    allocations = CostAllocationInputSerializer(many=True, allow_empty=False)
