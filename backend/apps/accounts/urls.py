from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    UserViewSet,
    create_user_view,
    login_view,
    logout_view,
    me_view,
    session_view,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("me/", me_view, name="me"),
    path("session/", session_view, name="session"),
    path("users/create/", create_user_view, name="create-user"),
    path("", include(router.urls)),
]
