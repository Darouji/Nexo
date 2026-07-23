from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.access import has_management_access
from apps.accounts.permissions import (
    CanManageGlobalGridLabels,
    IsAuthenticatedAndActive,
)

from .exceptions import api_error_response
from .grid_registry import get_grid_definition
from .grid_serializers import (
    GlobalColumnLabelResponseSerializer,
    GlobalColumnLabelWriteSerializer,
    GridDefinitionResponseSerializer,
    GridPreferenceResponseSerializer,
    GridPreferenceWriteSerializer,
    SavedViewResponseSerializer,
    SavedViewWriteSerializer,
)
from .grid_services import (
    create_saved_view,
    list_saved_views,
    rename_global_column,
    save_grid_preference,
    serialize_grid_definition,
    serialize_grid_preference,
    serialize_saved_view,
    update_saved_view,
)
from .models import BaseStatus, GridPreference, SavedView


def skip_personal_preference_audit(request):
    """Evita que ajustes visuales personales contaminen la auditoría de negocio."""

    django_request = getattr(request, "_request", request)
    django_request.skip_activity_audit = True


class GridDefinitionView(APIView):
    permission_classes = [IsAuthenticated, IsAuthenticatedAndActive]

    @extend_schema(
        tags=["Grid"],
        summary="Definición pública y segura de una grilla",
        responses=GridDefinitionResponseSerializer,
    )
    def get(self, request, grid_key):
        definition = get_grid_definition(grid_key)
        can_manage = has_management_access(request.user)

        return Response(
            serialize_grid_definition(
                definition,
                can_rename_global=can_manage,
                can_export_official=can_manage,
            )
        )


class GridPreferenceView(APIView):
    permission_classes = [IsAuthenticated, IsAuthenticatedAndActive]

    @extend_schema(
        tags=["Grid"],
        summary="Preferencia visual de la grilla actual",
        responses=GridPreferenceResponseSerializer,
    )
    def get(self, request, grid_key):
        definition = get_grid_definition(grid_key)

        with transaction.atomic():
            preference = (
                GridPreference.objects.select_for_update()
                .filter(user=request.user, grid_key=definition.key)
                .first()
            )
            payload = serialize_grid_preference(preference, definition)

        return Response(payload)

    @extend_schema(
        tags=["Grid"],
        summary="Guardar preferencia visual de la grilla",
        request=GridPreferenceWriteSerializer,
        responses=GridPreferenceResponseSerializer,
    )
    def put(self, request, grid_key):
        definition = get_grid_definition(grid_key)
        serializer = GridPreferenceWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data["definition_version"] > definition.version:
            raise ValidationError(
                {"definition_version": "La versión enviada no es reconocida."}
            )

        try:
            preference = save_grid_preference(
                user=request.user,
                definition=definition,
                revision=serializer.validated_data["revision"],
                config=serializer.validated_data["config"],
            )
        except ValidationError as error:
            if "revision" in error.detail:
                return api_error_response(
                    request=request,
                    status_code=status.HTTP_409_CONFLICT,
                    code="grid_preference_conflict",
                    message=(
                        "La preferencia cambió en otra sesión. Recargue la grilla."
                    ),
                    details=error.detail,
                )
            raise

        skip_personal_preference_audit(request)
        return Response(serialize_grid_preference(preference, definition))

    @extend_schema(
        tags=["Grid"],
        summary="Restablecer preferencia visual",
        request=None,
        responses={204: None},
    )
    def delete(self, request, grid_key):
        definition = get_grid_definition(grid_key)
        GridPreference.objects.filter(
            user=request.user,
            grid_key=definition.key,
        ).delete()
        skip_personal_preference_audit(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SavedViewCollectionView(APIView):
    permission_classes = [IsAuthenticated, IsAuthenticatedAndActive]

    @extend_schema(
        tags=["Grid"],
        summary="Listar vistas personales nombradas",
        responses=SavedViewResponseSerializer(many=True),
    )
    def get(self, request, grid_key):
        definition = get_grid_definition(grid_key)
        views = list_saved_views(user=request.user, definition=definition)
        return Response(
            [serialize_saved_view(view, definition) for view in views]
        )

    @extend_schema(
        tags=["Grid"],
        summary="Guardar una vista personal con nombre",
        request=SavedViewWriteSerializer,
        responses={201: SavedViewResponseSerializer},
    )
    def post(self, request, grid_key):
        definition = get_grid_definition(grid_key)
        serializer = SavedViewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        view = create_saved_view(
            user=request.user,
            definition=definition,
            **serializer.validated_data,
        )
        skip_personal_preference_audit(request)
        return Response(
            serialize_saved_view(view, definition),
            status=status.HTTP_201_CREATED,
        )


class SavedViewDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAuthenticatedAndActive]

    def get_owned_view(self, request, definition, view_id):
        return get_object_or_404(
            SavedView,
            pk=view_id,
            user=request.user,
            module=definition.module,
            model_name=definition.model_name,
            status=BaseStatus.ACTIVO,
        )

    @extend_schema(
        tags=["Grid"],
        summary="Actualizar una vista personal",
        request=SavedViewWriteSerializer,
        responses=SavedViewResponseSerializer,
    )
    def put(self, request, grid_key, view_id):
        definition = get_grid_definition(grid_key)
        view = self.get_owned_view(request, definition, view_id)
        serializer = SavedViewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_view = update_saved_view(
            view=view,
            user=request.user,
            definition=definition,
            **serializer.validated_data,
        )
        skip_personal_preference_audit(request)
        return Response(serialize_saved_view(updated_view, definition))

    @extend_schema(
        tags=["Grid"],
        summary="Eliminar una vista personal",
        request=None,
        responses={204: None},
    )
    def delete(self, request, grid_key, view_id):
        definition = get_grid_definition(grid_key)
        view = self.get_owned_view(request, definition, view_id)
        view.delete()
        skip_personal_preference_audit(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GlobalColumnLabelView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsAuthenticatedAndActive,
        CanManageGlobalGridLabels,
    ]

    @extend_schema(
        tags=["Grid"],
        summary="Renombrar una columna para toda SERKAN",
        request=GlobalColumnLabelWriteSerializer,
        responses=GlobalColumnLabelResponseSerializer,
    )
    def put(self, request, grid_key, field_key):
        definition = get_grid_definition(grid_key)
        serializer = GlobalColumnLabelWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        override = rename_global_column(
            definition=definition,
            field_key=field_key,
            visible_name=serializer.validated_data["visible_name"],
            reason=serializer.validated_data["reason"],
            user=request.user,
            request=getattr(request, "_request", request),
        )

        return Response(
            {
                "grid_key": definition.key,
                "field_key": field_key,
                "system_label": definition.column_map[field_key].system_label,
                "visible_name": override.visible_name,
                "scope": "organization",
            }
        )
