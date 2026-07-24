from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    LandedCostViewSet,
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
router.register("costos", LandedCostViewSet, basename="purchase-landed-cost")

urlpatterns = [path("", include(router.urls))]
