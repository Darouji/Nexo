from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VentaViewSet, DetalleVentaViewSet

router = DefaultRouter()
router.register(r'ventas', VentaViewSet, basename='venta')
router.register(r'detalles', DetalleVentaViewSet, basename='detalle')

urlpatterns = [
    path('', include(router.urls)),
]