from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet, MovimientoKardexViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet, basename='categoria')
router.register(r'productos', ProductoViewSet, basename='producto')
router.register(r'kardex', MovimientoKardexViewSet, basename='kardex')

urlpatterns = [
    path('', include(router.urls)),
]