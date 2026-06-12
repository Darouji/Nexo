import time
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiResponse,
    OpenApiTypes,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.exceptions import api_error_response
from apps.core.models import AuditAction, AuditLog, AuditOrigin, BaseStatus

from .access import build_access_payload, build_token_status
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


def build_login_response_payload(*, token, user):
    """
    Construye una respuesta de login útil para el frontend.

    El token sigue usando el formato:
        Authorization: Token <token>

    Pero ahora el frontend también sabe cuándo expira.
    """

    expire_hours = getattr(settings, "DRF_TOKEN_EXPIRE_HOURS", 12)
    expires_at = None
    expires_in_seconds = None

    if expire_hours and expire_hours > 0:
        expires_at = token.created + timedelta(hours=expire_hours)
        expires_in_seconds = max(
            0,
            int((expires_at - timezone.now()).total_seconds()),
        )

    return {
        "token": token.key,
        "token_type": "Token",
        "token_created_at": token.created,
        "token_expires_at": expires_at,
        "token_expires_in_seconds": expires_in_seconds,
        "token_expire_hours": expire_hours,
        "user": UserSerializer(user).data,
        "access": build_access_payload(user),
    }


def create_auth_audit_log(
    *,
    request,
    action,
    user=None,
    username="",
    success=True,
    reason="",
    extra_metadata=None,
):
    """
    Registra eventos de autenticación sin romper el flujo principal.

    Importante:
    - Si falla la auditoría, nunca debe fallar el login/logout.
    - El actor solo se asigna cuando hay usuario real autenticado.
    - Los intentos fallidos quedan sin actor, pero con username en metadata.
    """

    try:
        ip_address = get_request_ip(request)

        if ip_address == "unknown":
            ip_address = None

        metadata = {
            "success": success,
            "username": username,
            "path": request.path,
            "method": request.method,
            "request_id": getattr(request, "request_id", ""),
        }

        if extra_metadata:
            metadata.update(extra_metadata)

        AuditLog.objects.create(
            actor=user if user and getattr(user, "is_authenticated", False) else None,
            action=action,
            origin=AuditOrigin.API,
            module="auth",
            model_name="User",
            object_id=str(user.pk) if user else "",
            object_repr=str(user) if user else username,
            ip_address=ip_address,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            reason=reason,
            metadata=metadata,
        )

    except Exception:
        # La auditoría nunca debe impedir iniciar o cerrar sesión.
        pass


@extend_schema(
    tags=["Auth"],
    summary="Iniciar sesión",
    description=(
        "Autentica un usuario interno activo de SERKAN V2. "
        "Si las credenciales son válidas, rota el token anterior, crea un token nuevo, "
        "registra auditoría de login y devuelve datos de usuario, permisos visuales, "
        "menú disponible y expiración del token."
    ),
    request=inline_serializer(
        name="LoginRequest",
        fields={
            "username": serializers.CharField(),
            "password": serializers.CharField(write_only=True),
        },
    ),
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiResponse(description="Credenciales faltantes o inválidas."),
        403: OpenApiResponse(
            description="Usuario desactivado o no activo internamente."
        ),
        429: OpenApiResponse(
            description="Login bloqueado temporalmente por rate limit."
        ),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        create_auth_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            username=username,
            success=False,
            reason="Intento de login sin usuario o contraseña.",
            extra_metadata={"failure_type": "missing_credentials"},
        )

        return api_error_response(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            code="missing_credentials",
            message="Debe ingresar usuario y contraseña.",
        )

    rate_limit_key = get_login_rate_limit_key(request, username)
    is_blocked, remaining_seconds = get_login_rate_limit_status(rate_limit_key)

    if is_blocked:
        create_auth_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            username=username,
            success=False,
            reason="Login bloqueado temporalmente por demasiados intentos fallidos.",
            extra_metadata={
                "failure_type": "rate_limited",
                "remaining_seconds": remaining_seconds,
            },
        )

        message = (
            "Demasiados intentos fallidos. "
            f"Intente nuevamente en {remaining_seconds} segundos."
        )

        return api_error_response(
            request=request,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="login_rate_limited",
            message=message,
            details={
                "detail": message,
                "remaining_seconds": remaining_seconds,
            },
        )

    user = authenticate(username=username, password=password)

    if user is None:
        register_failed_login(rate_limit_key)

        create_auth_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            username=username,
            success=False,
            reason="Credenciales inválidas.",
            extra_metadata={"failure_type": "invalid_credentials"},
        )

        return api_error_response(
            request=request,
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_credentials",
            message="Credenciales inválidas.",
        )

    if not user.is_active:
        create_auth_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            user=user,
            username=username,
            success=False,
            reason="Usuario Django desactivado.",
            extra_metadata={"failure_type": "django_user_inactive"},
        )

        return api_error_response(
            request=request,
            status_code=status.HTTP_403_FORBIDDEN,
            code="django_user_inactive",
            message="El usuario está desactivado.",
        )

    if user.status != BaseStatus.ACTIVO:
        create_auth_audit_log(
            request=request,
            action=AuditAction.LOGIN,
            user=user,
            username=username,
            success=False,
            reason="Usuario interno no activo.",
            extra_metadata={"failure_type": "internal_user_inactive"},
        )

        return api_error_response(
            request=request,
            status_code=status.HTTP_403_FORBIDDEN,
            code="internal_user_inactive",
            message="El usuario no se encuentra activo internamente.",
        )

    clear_failed_login_attempts(rate_limit_key)

    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)

    update_last_login(None, user)

    create_auth_audit_log(
        request=request,
        action=AuditAction.LOGIN,
        user=user,
        username=username,
        success=True,
        reason="Inicio de sesión correcto.",
    )

    return Response(build_login_response_payload(token=token, user=user))


@extend_schema(
    tags=["Auth"],
    summary="Cerrar sesión",
    description=(
        "Cierra la sesión del usuario autenticado, registra auditoría de logout "
        "y elimina el token actual para impedir su reutilización."
    ),
    request=None,
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="Token ausente, inválido o expirado."),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    create_auth_audit_log(
        request=request,
        action=AuditAction.LOGOUT,
        user=request.user,
        username=request.user.username,
        success=True,
        reason="Cierre de sesión correcto.",
    )

    Token.objects.filter(user=request.user).delete()

    return Response({"detail": "Sesión cerrada correctamente."})


@extend_schema(
    tags=["Auth"],
    summary="Usuario actual",
    description="Devuelve los datos del usuario autenticado y activo.",
    responses={
        200: UserSerializer,
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Usuario no activo."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticatedAndActive])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@extend_schema(
    tags=["Auth"],
    summary="Sesión actual para React",
    description=(
        "Devuelve la sesión actual preparada para frontend. "
        "React debe usar este endpoint para restaurar sesión, construir menú, "
        "leer permisos visuales por módulo y conocer expiración del token. "
        "El backend sigue siendo la fuente real de permisos."
    ),
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiResponse(description="Token ausente, inválido o expirado."),
        403: OpenApiResponse(description="Usuario no activo."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticatedAndActive])
def session_view(request):
    """
    Devuelve la sesión actual preparada para frontend.

    React puede usar este endpoint para:
    - restaurar sesión al recargar la página
    - construir menú según rol
    - conocer permisos visuales
    - conocer expiración del token
    """

    return Response(
        {
            "user": UserSerializer(request.user).data,
            "access": build_access_payload(request.user),
            "session": build_token_status(getattr(request, "auth", None)),
        }
    )


@extend_schema(
    tags=["Accounts"],
    summary="Crear usuario interno",
    description=(
        "Crea una cuenta interna de SERKAN V2. "
        "No crea colaborador interno ni contacto externo. "
        "Solo roles autorizados pueden gestionar usuarios."
    ),
    request=CreateUserSerializer,
    responses={
        201: OpenApiTypes.OBJECT,
        400: OpenApiResponse(description="Error de validación."),
        401: OpenApiResponse(description="No autenticado."),
        403: OpenApiResponse(description="Sin permisos para gestionar usuarios."),
    },
)
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
            return api_error_response(
                request=request,
                status_code=status.HTTP_400_BAD_REQUEST,
                code="cannot_deactivate_self",
                message="No puedes desactivar tu propio usuario.",
            )

        with transaction.atomic():
            instance.deactivate(user=request.user)
            Token.objects.filter(user=instance).delete()

        return Response(
            {
                "detail": "Usuario desactivado correctamente.",
                "user": UserSerializer(instance).data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Accounts"],
        summary="Cambiar contraseña propia",
        description=(
            "Permite al usuario autenticado cambiar su propia contraseña. "
            "Después del cambio se eliminan sus tokens activos y debe iniciar sesión nuevamente."
        ),
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiTypes.OBJECT,
            400: OpenApiResponse(description="Error de validación."),
            401: OpenApiResponse(description="No autenticado."),
            403: OpenApiResponse(description="Usuario no activo."),
        },
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
