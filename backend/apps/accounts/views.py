import time
from django.contrib.auth import authenticate, get_user_model
from django.core.cache import cache
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.models import BaseStatus

from .permissions import CanManageUsers, IsAuthenticatedAndActive
from .serializers import (
    ChangePasswordSerializer,
    CreateUserSerializer,
    UpdateUserSerializer,
    UserSerializer,
)

User = get_user_model()

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_SECONDS = 15 * 60


def get_request_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR", "unknown")


def get_login_rate_limit_key(request, username):
    ip_address = get_request_ip(request)
    normalized_username = (username or "").strip().lower()[:150]

    return f"serkan-login:{ip_address}:{normalized_username}"


def get_login_rate_limit_status(cache_key):
    data = cache.get(cache_key) or {}
    blocked_until = float(data.get("blocked_until", 0))
    now = time.time()

    if blocked_until > now:
        remaining_seconds = int(blocked_until - now)
        return True, remaining_seconds

    return False, 0


def register_failed_login(cache_key):
    data = cache.get(cache_key) or {}
    attempts = int(data.get("attempts", 0)) + 1

    if attempts >= LOGIN_MAX_ATTEMPTS:
        cache.set(
            cache_key,
            {
                "attempts": attempts,
                "blocked_until": time.time() + LOGIN_LOCK_SECONDS,
            },
            timeout=LOGIN_LOCK_SECONDS,
        )
        return

    cache.set(
        cache_key,
        {
            "attempts": attempts,
            "blocked_until": 0,
        },
        timeout=LOGIN_LOCK_SECONDS,
    )


def clear_failed_login_attempts(cache_key):
    cache.delete(cache_key)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response(
            {"detail": "Debe ingresar usuario y contraseña."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    rate_limit_key = get_login_rate_limit_key(request, username)
    is_blocked, remaining_seconds = get_login_rate_limit_status(rate_limit_key)

    if is_blocked:
        return Response(
            {
                "detail": (
                    "Demasiados intentos fallidos. "
                    f"Intente nuevamente en {remaining_seconds} segundos."
                )
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    user = authenticate(username=username, password=password)

    if user is None:
        register_failed_login(rate_limit_key)

        return Response(
            {"detail": "Credenciales inválidas."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.is_active:
        return Response(
            {"detail": "El usuario está desactivado."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if user.status != BaseStatus.ACTIVO:
        return Response(
            {"detail": "El usuario no se encuentra activo internamente."},
            status=status.HTTP_403_FORBIDDEN,
        )

    clear_failed_login_attempts(rate_limit_key)

    token, _ = Token.objects.get_or_create(user=user)

    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"detail": "Sesión cerrada correctamente."})


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndActive])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticatedAndActive, CanManageUsers])
def create_user_view(request):
    serializer = CreateUserSerializer(
        data=request.data,
        context={"request": request},
    )

    if serializer.is_valid():
        with transaction.atomic():
            user = serializer.save()

        return Response(
            {
                "detail": "Usuario creado correctamente.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("username")
    permission_classes = [IsAuthenticatedAndActive, CanManageUsers]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateUserSerializer

        if self.action in ["update", "partial_update"]:
            return UpdateUserSerializer

        return UserSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by("username")

        role = self.request.query_params.get("role")
        status_param = self.request.query_params.get("status")
        search = self.request.query_params.get("search")

        if role:
            queryset = queryset.filter(role=role)

        if status_param:
            queryset = queryset.filter(status=status_param)

        if search:
            queryset = (
                queryset.filter(username__icontains=search)
                | queryset.filter(email__icontains=search)
                | queryset.filter(first_name__icontains=search)
                | queryset.filter(last_name__icontains=search)
                | queryset.filter(position__icontains=search)
                | queryset.filter(department__icontains=search)
            )

        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()

        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            user = serializer.save()

        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance == request.user:
            return Response(
                {"detail": "No puedes desactivar tu propio usuario."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            instance.deactivate(user=request.user)

        return Response(
            {"detail": "Usuario desactivado correctamente."},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        Token.objects.filter(user=request.user).delete()

        return Response(
            {
                "detail": "Contraseña actualizada correctamente. Debe iniciar sesión nuevamente."
            }
        )