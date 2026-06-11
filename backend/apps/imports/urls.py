from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ImportBatchViewSet, ImportRowViewSet

router = DefaultRouter()
router.register(r"batches", ImportBatchViewSet, basename="import-batch")
router.register(r"rows", ImportRowViewSet, basename="import-row")

urlpatterns = [
    path("", include(router.urls)),
]