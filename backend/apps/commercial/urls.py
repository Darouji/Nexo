from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CiudadViewSet,
    HoldingViewSet,
    MineraViewSet,
    AreaViewSet,
    SubareaViewSet,
    ContactoViewSet,
)

router = DefaultRouter()
router.register(r"cities", CiudadViewSet, basename="city")
router.register(r"holdings", HoldingViewSet, basename="holding")
router.register(r"mineras", MineraViewSet, basename="minera")
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"subareas", SubareaViewSet, basename="subarea")
router.register(r"contactos", ContactoViewSet, basename="contacto")

urlpatterns = [
    path("", include(router.urls)),
]