from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .permissions import IsAdminOrRRHH


from .serializers import CreateUserSerializer, UserSerializer


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
            {"detail": "El usuario está inactivo."},
            status=status.HTTP_403_FORBIDDEN,
        )

    profile = getattr(user, "profile", None)

    if profile is None:
        return Response(
            {"detail": "El usuario no tiene perfil asociado. Contacte al administrador."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not profile.is_active_profile:
        return Response(
            {"detail": "El perfil del usuario está inactivo."},
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
    request.user.auth_token.delete()
    return Response({"detail": "Sesión cerrada correctamente."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminOrRRHH])
def create_user_view(request):
    serializer = CreateUserSerializer(
        data=request.data,
        context={"request": request},
    )

    if serializer.is_valid():
        user = serializer.save()

        return Response(
            {
                "detail": "Usuario creado correctamente.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)