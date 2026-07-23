from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoriaViewSet,
    InventoryLocationViewSet,
    InventoryTransferViewSet,
    MovimientoKardexViewSet,
    PendientePorRecibirViewSet,
    ProductLocationBalanceViewSet,
    ProductoViewSet,
)

router = DefaultRouter()

router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"productos", ProductoViewSet, basename="producto")
router.register(
    r"ubicaciones",
    InventoryLocationViewSet,
    basename="ubicacion-inventario",
)
router.register(
    r"saldos-por-ubicacion",
    ProductLocationBalanceViewSet,
    basename="saldo-por-ubicacion",
)
router.register(
    r"transferencias",
    InventoryTransferViewSet,
    basename="transferencia-inventario",
)
router.register(
    r"pendientes-por-recibir",
    PendientePorRecibirViewSet,
    basename="pendiente-por-recibir",
)
router.register(r"kardex", MovimientoKardexViewSet, basename="kardex")

urlpatterns = [
    path("", include(router.urls)),
]
