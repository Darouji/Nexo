from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.access import PurchaseCapability
from apps.core.grid_registry import apply_grid_filters
from apps.core.models import BaseStatus

from .logistics_grid_definitions import SHIPMENT_GRID_DEFINITION
from .logistics_models import (
    Carrier,
    PurchaseShipment,
    ShipmentChargeStatus,
    ShipmentStatus,
)
from .logistics_serializers import (
    CarrierResolveSerializer,
    CarrierSerializer,
    PurchaseShipmentInputSerializer,
    PurchaseShipmentSerializer,
    ShipmentChargeInputSerializer,
    ShipmentChargeSerializer,
    ShipmentEventInputSerializer,
    ShipmentEventSerializer,
)
from .logistics_services import (
    create_purchase_shipment,
    find_carrier_suggestions,
    register_shipment_charge,
    register_shipment_event,
    resolve_or_create_carrier,
)
from .models import PurchaseOrderStatus
from .views import (
    PurchasePermissionMixin,
    _domain_call,
    _export_grid,
    _idempotency_key,
    _parse_grid_filters,
    _split_csv,
)


class CarrierViewSet(PurchasePermissionMixin, viewsets.ModelViewSet):
    purchase_default_write_capability = PurchaseCapability.MANAGE_CARRIERS
    serializer_class = CarrierSerializer
    queryset = Carrier.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "name_normalized", "aliases", "country"]
    ordering_fields = ["name", "country", "status", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        statuses = _split_csv(self.request.query_params.get("status"))
        if statuses:
            queryset = queryset.filter(status__in=statuses)
        return queryset

    @action(detail=False, methods=["get"], url_path="sugerencias")
    def suggestions(self, request):
        carriers = find_carrier_suggestions(request.query_params.get("search", ""))
        return Response(CarrierSerializer(carriers, many=True).data)

    @action(detail=False, methods=["post"], url_path="resolver")
    def resolve(self, request):
        serializer = CarrierResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        carrier, created = _domain_call(
            resolve_or_create_carrier,
            name=serializer.validated_data["name"],
            user=request.user,
            request=request,
        )
        return Response(
            {
                "carrier": CarrierSerializer(carrier).data,
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def perform_destroy(self, instance):
        instance.mark_inactive(user=self.request.user)


class PurchaseShipmentViewSet(
    PurchasePermissionMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    purchase_default_write_capability = PurchaseCapability.CREATE_SHIPMENT
    purchase_official_export_capability = PurchaseCapability.EXPORT_SHIPMENTS_OFFICIAL
    purchase_action_capabilities = {
        "create": PurchaseCapability.CREATE_SHIPMENT,
        "event": PurchaseCapability.UPDATE_SHIPMENT,
        "charge": PurchaseCapability.MANAGE_SHIPMENT_COSTS,
        "summary": PurchaseCapability.VIEW,
    }
    serializer_class = PurchaseShipmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "order__number",
        "order__supplier__legal_name",
        "carrier__name",
        "tracking_number",
        "origin_country",
        "origin_place",
        "destination_place",
        "responsible__username",
    ]
    ordering_fields = [
        "order__number",
        "carrier__name",
        "tracking_number",
        "state",
        "current_eta",
        "initial_eta",
        "created_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = (
            PurchaseShipment.objects.select_related(
                "order",
                "order__supplier",
                "carrier",
                "responsible",
            )
            .prefetch_related(
                "events",
                "events__responsible",
                "charges",
                "charges__responsible",
            )
        )
        states = _split_csv(self.request.query_params.get("state"))
        if states:
            queryset = queryset.filter(state__in=states)
        carriers = _split_csv(self.request.query_params.get("carrier"))
        if carriers:
            queryset = queryset.filter(carrier_id__in=carriers)
        modes = _split_csv(self.request.query_params.get("transport_mode"))
        if modes:
            queryset = queryset.filter(transport_mode__in=modes)
        customs = self.request.query_params.get("customs_review_expected")
        if customs in {"true", "false"}:
            queryset = queryset.filter(customs_review_expected=customs == "true")
        return apply_grid_filters(
            queryset,
            SHIPMENT_GRID_DEFINITION,
            _parse_grid_filters(self.request.query_params.get("grid_filters")),
        )

    def create(self, request, *args, **kwargs):
        serializer = PurchaseShipmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = _domain_call(
            create_purchase_shipment,
            data=serializer.validated_data,
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        return Response(
            PurchaseShipmentSerializer(shipment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="eventos")
    def event(self, request, pk=None):
        serializer = ShipmentEventInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = _domain_call(
            register_shipment_event,
            shipment=self.get_object(),
            data=serializer.validated_data,
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        return Response(ShipmentEventSerializer(event).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cobros")
    def charge(self, request, pk=None):
        serializer = ShipmentChargeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        charge = _domain_call(
            register_shipment_charge,
            shipment=self.get_object(),
            data=serializer.validated_data,
            idempotency_key=_idempotency_key(request),
            user=request.user,
            request=request,
        )
        return Response(
            ShipmentChargeSerializer(charge).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="resumen")
    def summary(self, request):
        today = timezone.localdate()
        open_states = [
            state
            for state, _ in ShipmentStatus.choices
            if state not in {ShipmentStatus.ENTREGADO, ShipmentStatus.CANCELADO}
        ]
        delayed = (
            PurchaseShipment.objects.annotate(
                eta=Coalesce("current_eta", "initial_eta")
            )
            .filter(state__in=open_states, eta__lt=today)
            .count()
        )
        return Response({
            "orders_in_review": self._orders_in_review(),
            "open_shipments": PurchaseShipment.objects.filter(
                status=BaseStatus.ACTIVO,
                state__in=open_states,
            ).count(),
            "delayed_shipments": delayed,
            "customs_attention": PurchaseShipment.objects.filter(
                status=BaseStatus.ACTIVO,
                state__in=open_states,
                customs_review_expected=True,
            ).count(),
            "charges_in_dispute": self._charges_in_dispute(),
        })

    @staticmethod
    def _orders_in_review():
        from .models import PurchaseOrder

        return PurchaseOrder.objects.filter(
            state=PurchaseOrderStatus.EN_REVISION
        ).count()

    @staticmethod
    def _charges_in_dispute():
        from .logistics_models import ShipmentCharge

        return ShipmentCharge.objects.filter(
            charge_status=ShipmentChargeStatus.EN_DISPUTA
        ).count()

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        return _export_grid(
            self,
            request,
            SHIPMENT_GRID_DEFINITION,
            "serkan_envios_importaciones",
            "Envíos e importaciones",
        )
