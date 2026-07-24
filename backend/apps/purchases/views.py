import json
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Prefetch
from apps.inventory.models import PendingReceiptOperation
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.grid_registry import apply_grid_filters
from apps.core.models import AuditAction, AuditLog, AuditOrigin

from .exports import build_export_response, resolve_export_columns
from .grid_definitions import (
    ORDER_GRID_DEFINITION,
    RECEIPT_GRID_DEFINITION,
    SUPPLIER_GRID_DEFINITION,
)

from apps.accounts.access import PurchaseCapability
from apps.accounts.permissions import (
    IsAuthenticatedAndActive,
    HasPurchaseCapability,
)

from .models import (
    LandedCost,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseReceiptCommitment,
    Supplier,
)
from .serializers import (
    AllocateCostRequestSerializer,
    LandedCostInputSerializer,
    LandedCostSerializer,
    OperationRequestSerializer,
    PurchaseOrderOperationSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderWriteSerializer,
    PurchaseReceiptCommitmentSerializer,
    ReceiveCommitmentSerializer,
    SupplierSerializer,
)
from .services import (
    allocate_landed_cost,
    approve_purchase_order,
    cancel_purchase_remainders,
    close_purchase_order,
    issue_purchase_order,
    receive_purchase_commitment,
    register_landed_cost,
    submit_for_review,
)


def _parse_grid_filters(value):
    if value in (None, ""):
        return []
    if len(str(value)) > 10000:
        raise ValidationError({"grid_filters": "La definición de filtros es demasiado extensa."})
    try:
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        raise ValidationError({"grid_filters": "Los filtros no contienen JSON válido."})


def _split_csv(value):
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def _export_grid(view, request, definition, filename, sheet):
    mode = request.query_params.get("mode", "view")
    export_format = request.query_params.get("file_format", "xlsx")
    if mode not in {"view", "official"}:
        raise ValidationError({"mode": "Use view u official."})
    if export_format not in {"xlsx", "csv"}:
        raise ValidationError({"file_format": "Use xlsx o csv."})
    columns = resolve_export_columns(
        definition=definition, mode=mode,
        requested_columns=_split_csv(request.query_params.get("columns")),
    )
    records = list(view.filter_queryset(view.get_queryset())[:5000])
    if not records:
        raise ValidationError({
            "export": "No hay resultados para exportar. Ajuste o elimine los filtros."
        })
    AuditLog.objects.create(
        actor=request.user, action=AuditAction.EXPORTAR, origin=AuditOrigin.API,
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        module="purchases", model_name=definition.model_name,
        object_repr=f"Exportación {definition.key}",
        reason="Exportación de resultados de Compras.",
        metadata={
            "grid_key": definition.key, "mode": mode,
            "format": export_format, "columns": columns,
            "row_count": len(records),
            "request_id": str(getattr(request, "request_id", "") or "")[:100],
        },
    )
    return build_export_response(
        records=records, definition=definition, mode=mode,
        export_format=export_format, columns=columns,
        filename=filename, sheet=sheet,
    )


def _idempotency_key(request):
    key = str(request.headers.get("Idempotency-Key", "") or "").strip()
    if not key:
        raise ValidationError({
            "idempotency_key": "Envíe la cabecera Idempotency-Key para esta operación."
        })
    return key


def _domain_call(function, **kwargs):
    try:
        return function(**kwargs)
    except DjangoValidationError as error:
        if hasattr(error, "message_dict"):
            raise ValidationError(error.message_dict)
        raise ValidationError(error.messages)


class PurchasePermissionMixin:
    purchase_action_capabilities = {}
    purchase_default_write_capability = None
    permission_classes = [
        IsAuthenticated,
        IsAuthenticatedAndActive,
        HasPurchaseCapability,
    ]

    def get_required_purchase_capability(self):
        if self.action == "export":
            if self.request.query_params.get("mode", "view") == "official":
                return PurchaseCapability.EXPORT_OFFICIAL
            return PurchaseCapability.EXPORT_VIEW
        explicit = self.purchase_action_capabilities.get(self.action)
        if explicit:
            return explicit
        if self.request.method in {"GET", "HEAD", "OPTIONS"}:
            return PurchaseCapability.VIEW
        return self.purchase_default_write_capability


class SupplierViewSet(PurchasePermissionMixin, viewsets.ModelViewSet):
    purchase_default_write_capability = PurchaseCapability.MANAGE_SUPPLIERS
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "legal_name", "trade_name", "tax_id", "country", "contact_name", "email", "phone",
    ]
    ordering_fields = ["legal_name", "trade_name", "tax_id", "status", "created_at"]
    ordering = ["legal_name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        statuses = self.request.query_params.get("status")
        if statuses:
            queryset = queryset.filter(status__in=[value for value in statuses.split(",") if value])
        return apply_grid_filters(
            queryset, SUPPLIER_GRID_DEFINITION,
            _parse_grid_filters(self.request.query_params.get("grid_filters")),
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        return _export_grid(
            self, request, SUPPLIER_GRID_DEFINITION,
            "serkan_proveedores", "Proveedores",
        )


    def perform_destroy(self, instance):
        instance.mark_inactive(user=self.request.user)


class PurchaseOrderViewSet(
    PurchasePermissionMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    purchase_default_write_capability = PurchaseCapability.EDIT_DRAFT
    purchase_action_capabilities = {
        "create": PurchaseCapability.CREATE_ORDER,
        "update": PurchaseCapability.EDIT_DRAFT,
        "partial_update": PurchaseCapability.EDIT_DRAFT,
        "submit": PurchaseCapability.SUBMIT_REVIEW,
        "approve": PurchaseCapability.APPROVE_ORDER,
        "issue": PurchaseCapability.ISSUE_ORDER,
        "cancel_remainders": PurchaseCapability.CANCEL_ORDER,
        "close": PurchaseCapability.CLOSE_ORDER,
        "add_cost": PurchaseCapability.MANAGE_COSTS,
        "history": PurchaseCapability.VIEW,
    }
    queryset = (
        PurchaseOrder.objects.select_related("supplier", "responsible")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=PurchaseOrderLine.objects.select_related(
                    "product", "destination_location"
                ),
            ),
            "lines__receipt_commitments__pending_receipt",
            "lines__receipt_commitments__destination_location",
            Prefetch(
                "lines__receipt_commitments__pending_receipt__operations",
                queryset=PendingReceiptOperation.objects.select_related("responsible"),
            ),
        )
        .all()
    )
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "number", "supplier__legal_name", "supplier__trade_name",
        "supplier__tax_id", "lines__product_model_snapshot",
        "lines__product_sap_snapshot",
    ]
    ordering_fields = [
        "number", "order_date", "expected_date", "state", "currency",
        "total_original", "total_clp", "supplier__legal_name", "created_at",
    ]
    ordering = ["-order_date", "-id"]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return PurchaseOrderWriteSerializer
        return PurchaseOrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if params.get("state"):
            queryset = queryset.filter(
                state__in=[value for value in params["state"].split(",") if value]
            )
        if params.get("supplier"):
            queryset = queryset.filter(supplier_id=params["supplier"])
        if params.get("currency"):
            queryset = queryset.filter(
                currency__in=[value for value in params["currency"].split(",") if value]
            )
        queryset = queryset.distinct()
        return apply_grid_filters(
            queryset, ORDER_GRID_DEFINITION,
            _parse_grid_filters(self.request.query_params.get("grid_filters")),
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        return _export_grid(
            self, request, ORDER_GRID_DEFINITION,
            "serkan_ordenes_compra", "Órdenes de compra",
        )


    def _transition(self, request, service):
        serializer = OperationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = _domain_call(
            service,
            order=self.get_object(),
            idempotency_key=_idempotency_key(request),
            user=request.user,
            reason=serializer.validated_data.get("reason", ""),
            request=request,
        )
        return Response(PurchaseOrderSerializer(order).data)

    @action(detail=True, methods=["post"], url_path="enviar-a-revision")
    def submit(self, request, pk=None):
        return self._transition(request, submit_for_review)

    @action(detail=True, methods=["post"], url_path="aprobar")
    def approve(self, request, pk=None):
        return self._transition(request, approve_purchase_order)

    @action(detail=True, methods=["post"], url_path="emitir")
    def issue(self, request, pk=None):
        return self._transition(request, issue_purchase_order)

    @action(detail=True, methods=["post"], url_path="cancelar-remanentes")
    def cancel_remainders(self, request, pk=None):
        return self._transition(request, cancel_purchase_remainders)

    @action(detail=True, methods=["post"], url_path="cerrar")
    def close(self, request, pk=None):
        return self._transition(request, close_purchase_order)

    @action(detail=True, methods=["get"], url_path="historial")
    def history(self, request, pk=None):
        operations = self.get_object().operations.select_related("responsible")
        return Response(PurchaseOrderOperationSerializer(operations, many=True).data)

    @action(detail=True, methods=["post"], url_path="costos")
    def add_cost(self, request, pk=None):
        serializer = LandedCostInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cost = _domain_call(
            register_landed_cost,
            order=self.get_object(),
            data=serializer.validated_data,
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        return Response(LandedCostSerializer(cost).data, status=status.HTTP_201_CREATED)


class PurchaseReceiptCommitmentViewSet(
    PurchasePermissionMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    purchase_action_capabilities = {"receive": PurchaseCapability.RECEIVE_ORDER}
    purchase_default_write_capability = PurchaseCapability.RECEIVE_ORDER
    serializer_class = PurchaseReceiptCommitmentSerializer
    queryset = PurchaseReceiptCommitment.objects.select_related(
        "order_line", "order_line__order", "order_line__order__supplier", "pending_receipt",
        "destination_location",
    ).prefetch_related(
        Prefetch(
            "pending_receipt__operations",
            queryset=PendingReceiptOperation.objects.select_related("responsible"),
        )
    )
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "order_line__order__number", "order_line__product_model_snapshot",
        "order_line__product_sap_snapshot", "destination_location__name",
    ]
    ordering_fields = [
        "created_at", "committed_quantity", "order_line__order__number",
        "destination_location__name",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if params.get("order"):
            queryset = queryset.filter(order_line__order_id=params["order"])
        if params.get("state"):
            queryset = queryset.filter(
                pending_receipt__estado__in=[
                    value for value in params["state"].split(",") if value
                ]
            )
        return apply_grid_filters(
            queryset, RECEIPT_GRID_DEFINITION,
            _parse_grid_filters(self.request.query_params.get("grid_filters")),
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        return _export_grid(
            self, request, RECEIPT_GRID_DEFINITION,
            "serkan_recepciones_compra", "Recepciones",
        )


    @action(detail=True, methods=["post"], url_path="recibir")
    def receive(self, request, pk=None):
        serializer = ReceiveCommitmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order, commitment = _domain_call(
            receive_purchase_commitment,
            commitment=self.get_object(),
            quantity=serializer.validated_data["quantity"],
            reason=serializer.validated_data["reason"],
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        commitment.refresh_from_db()
        return Response({
            "order": PurchaseOrderSerializer(order).data,
            "commitment": PurchaseReceiptCommitmentSerializer(commitment).data,
        })


class LandedCostViewSet(
    PurchasePermissionMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    purchase_action_capabilities = {"allocate": PurchaseCapability.MANAGE_COSTS}
    purchase_default_write_capability = PurchaseCapability.MANAGE_COSTS
    serializer_class = LandedCostSerializer
    queryset = LandedCost.objects.select_related("order").prefetch_related("allocations")

    @action(detail=True, methods=["post"], url_path="asignar")
    def allocate(self, request, pk=None):
        serializer = AllocateCostRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cost = _domain_call(
            allocate_landed_cost,
            landed_cost=self.get_object(),
            allocations=serializer.validated_data["allocations"],
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        return Response(LandedCostSerializer(cost).data)
