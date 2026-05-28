from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsOperativoGlobal

from .models import Collaborator
from .serializers import CollaboratorSerializer


class CollaboratorViewSet(viewsets.ModelViewSet):
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [IsAuthenticated, IsOperativoGlobal]

    def get_queryset(self):
        queryset = Collaborator.objects.all().order_by("last_name", "first_name")

        status = self.request.query_params.get("status")
        area = self.request.query_params.get("area")
        search = self.request.query_params.get("search")

        if status:
            queryset = queryset.filter(status=status)

        if area:
            queryset = queryset.filter(area__icontains=area)

        if search:
            queryset = queryset.filter(
                rut__icontains=search
            ) | queryset.filter(
                first_name__icontains=search
            ) | queryset.filter(
                last_name__icontains=search
            ) | queryset.filter(
                email__icontains=search
            ) | queryset.filter(
                phone__icontains=search
            ) | queryset.filter(
                position__icontains=search
            ) | queryset.filter(
                area__icontains=search
            )

        return queryset