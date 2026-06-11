from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsConsultaOrOperativoGlobal

from .search import global_search
from .statistics import get_dashboard_statistics


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "message": "API Serkan V2 funcionando",
            "version": "0.1.0",
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def omnibox_search(request):
    query = request.query_params.get("q", "")
    limit = request.query_params.get("limit")

    payload = global_search(
        user=request.user,
        query=query,
        limit_per_group=limit,
    )

    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsultaOrOperativoGlobal])
def dashboard_statistics(request):
    payload = get_dashboard_statistics(user=request.user)
    return Response(payload)