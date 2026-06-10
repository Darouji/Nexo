from django.contrib.auth import authenticate, get_user_model
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

    user = authenticate(username=username, password=password)

    if user is None:
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