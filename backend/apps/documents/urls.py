from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DocumentFileViewSet, DocumentVersionViewSet

router = DefaultRouter()
router.register(r"files", DocumentFileViewSet, basename="document-file")
router.register(r"versions", DocumentVersionViewSet, basename="document-version")

urlpatterns = [
    path("", include(router.urls)),
]