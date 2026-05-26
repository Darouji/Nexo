from django.urls import path

from .views import create_user_view, login_view, logout_view, me_view

urlpatterns = [
    path("login/", login_view, name="login"),
    path("logout/", logout_view, name="logout"),
    path("me/", me_view, name="me"),
    path("users/create/", create_user_view, name="create-user"),
]