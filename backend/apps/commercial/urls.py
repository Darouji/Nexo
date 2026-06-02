from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AreaClienteViewSet,
    SubAreaClienteViewSet,
    ContactoClienteViewSet,
    CiudadViewSet,
    EmpresaClienteViewSet,
    GrupoEmpresarialViewSet,
    MineraViewSet,
)

router = DefaultRouter()
router.register(r"cities", CiudadViewSet, basename="city")
router.register(r"business-groups", GrupoEmpresarialViewSet, basename="business-group")
router.register(r"mining-companies", MineraViewSet, basename="mining-company")
router.register(r"client-companies", EmpresaClienteViewSet, basename="client-company")
router.register(r"client-areas", AreaClienteViewSet, basename="client-area")
router.register(r"client-subareas", SubAreaClienteViewSet, basename="client-subarea")
router.register(r"client-contacts", ContactoClienteViewSet, basename="client-contact")

urlpatterns = [
    path("", include(router.urls)),
]