from rest_framework.routers import DefaultRouter

from .views import CollaboratorViewSet

router = DefaultRouter()
router.register("collaborators", CollaboratorViewSet, basename="collaborator")

urlpatterns = router.urls