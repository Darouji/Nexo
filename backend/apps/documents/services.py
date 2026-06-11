from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.models import AuditOrigin

from .models import DocumentFile, DocumentVersion


def get_operator(user):
    if user is None:
        return None

    if not getattr(user, "is_authenticated", False):
        return None

    return user


def create_document_with_initial_version(
    *,
    title,
    document_type,
    owner_content_type,
    owner_object_id,
    file,
    description="",
    user=None,
    origin=AuditOrigin.MANUAL,
):
    operator = get_operator(user)

    if not file:
        raise ValidationError({"file": "Debe subir un archivo inicial."})

    with transaction.atomic():
        document = DocumentFile.objects.create(
            title=title,
            document_type=document_type,
            description=description,
            owner_content_type=owner_content_type,
            owner_object_id=str(owner_object_id),
            created_by=operator,
            updated_by=operator,
        )

        add_document_version(
            document=document,
            file=file,
            reason="",
            user=operator,
            origin=origin,
        )

        return document


def add_document_version(
    *,
    document,
    file,
    reason,
    user=None,
    origin=AuditOrigin.MANUAL,
):
    operator = get_operator(user)

    if not document:
        raise ValidationError({"document": "El documento es obligatorio."})

    if not file:
        raise ValidationError({"file": "Debe adjuntar un archivo."})

    with transaction.atomic():
        locked_document = DocumentFile.objects.select_for_update().get(pk=document.pk)

        active_version = (
            locked_document.versions.select_for_update()
            .filter(is_active=True)
            .first()
        )

        if active_version and not reason:
            raise ValidationError(
                {"reason": "El motivo es obligatorio al reemplazar un documento."}
            )

        last_version_number = (
            locked_document.versions.aggregate(max_version=Max("version_number"))[
                "max_version"
            ]
            or 0
        )

        if active_version:
            active_version.is_active = False
            active_version.replaced_at = timezone.now()
            active_version.replaced_by = operator
            active_version.replace_reason = reason
            active_version.updated_by = operator
            active_version.save(
                update_fields=[
                    "is_active",
                    "replaced_at",
                    "replaced_by",
                    "replace_reason",
                    "updated_by",
                    "updated_at",
                ]
            )

        version = DocumentVersion.objects.create(
            document=locked_document,
            version_number=last_version_number + 1,
            file=file,
            content_type=getattr(file, "content_type", ""),
            uploaded_by=operator,
            origin=origin,
            replace_reason=reason if active_version else "",
            created_by=operator,
            updated_by=operator,
        )

        locked_document.updated_by = operator
        locked_document.save(update_fields=["updated_by", "updated_at"])

        return version