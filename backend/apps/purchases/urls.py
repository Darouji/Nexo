from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .logistics_views import CarrierViewSet, PurchaseShipmentViewSet
from .views import (
    LandedCostViewSet,
    PhysicalReceiptViewSet,
    PurchaseOrderViewSet,
    PurchaseReceiptCommitmentViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("proveedores", SupplierViewSet, basename="purchase-supplier")
router.register("ordenes", PurchaseOrderViewSet, basename="purchase-order")
router.register(
    "compromisos-recepcion",
    PurchaseReceiptCommitmentViewSet,
    basename="purchase-receipt-commitment",
)
router.register(
    "recepciones-fisicas",
    PhysicalReceiptViewSet,
    basename="purchase-physical-receipt",
)
router.register("costos", LandedCostViewSet, basename="purchase-landed-cost")
router.register("transportistas", CarrierViewSet, basename="purchase-carrier")
router.register("envios", PurchaseShipmentViewSet, basename="purchase-shipment")

urlpatterns = [path("", include(router.urls))]
