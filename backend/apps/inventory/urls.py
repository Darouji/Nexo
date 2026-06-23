from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategoriaViewSet,
    MovimientoKardexViewSet,
    PendientePorRecibirViewSet,
    ProductoViewSet,
)

router = DefaultRouter()

router.register(r"categorias", CategoriaViewSet, basename="categoria")
router.register(r"productos", ProductoViewSet, basename="producto")
router.register(
    r"pendientes-por-recibir",
    PendientePorRecibirViewSet,
    basename="pendiente-por-recibir",
)
router.register(r"kardex", MovimientoKardexViewSet, basename="kardex")

urlpatterns = [
    path("", include(router.urls)),
]
