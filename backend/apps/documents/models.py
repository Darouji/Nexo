import hashlib
import mimetypes
from pathlib import Path

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import AuditOrigin, BaseModel


MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
}


class DocumentType(models.TextChoices):
    CONTRATO = "CONTRATO", "Contrato"
    ANEXO = "ANEXO", "Anexo de contrato"
    CERTIFICADO = "CERTIFICADO", "Certificado"
    FACTURA = "FACTURA", "Factura"
    GUIA_DESPACHO = "GUIA_DESPACHO", "Guía de despacho"
    HES = "HES", "HES"
    FICHA_PRODUCTO = "FICHA_PRODUCTO", "Ficha de producto"
    OTRO = "OTRO", "Otro"


class DocumentFile(BaseModel):
    """
    Documento lógico asociado a un registro.

    Ejemplo:
    - Factura de una venta.
    - Guía de despacho de una venta.
    - Ficha técnica de un producto.

    El archivo real vive en DocumentVersion.
    """

    title = models.CharField(
        max_length=180,
        verbose_name="Título",
    )
    document_type = models.CharField(
        max_length=40,
        choices=DocumentType.choices,
        db_index=True,
        verbose_name="Tipo de documento",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )

    owner_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.PROTECT,
        related_name="document_files",
        verbose_name="Tipo de registro dueño",
    )
    owner_object_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="ID registro dueño",
    )
    owner_object = GenericForeignKey("owner_content_type", "owner_object_id")
    owner_repr = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Registro dueño legible",
    )

    class Meta:
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["document_type", "created_at"]),
            models.Index(fields=["owner_content_type", "owner_object_id"]),
            models.Index(fields=["status", "document_type"]),
        ]

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.title}"

    @property
    def active_version(self):
        return self.versions.filter(is_active=True).first()

    def clean(self):
        super().clean()

        if not self.title or not self.title.strip():
            raise ValidationError({"title": "El título del documento es obligatorio."})

        if not self.document_type:
            raise ValidationError(
                {"document_type": "El tipo de documento es obligatorio."}
            )

        if not self.owner_content_type_id or not self.owner_object_id:
            raise ValidationError(
                {"owner_object_id": "El documento debe asociarse a un registro dueño."}
            )

    def save(self, *args, **kwargs):
        if self.owner_object:
            self.owner_repr = str(self.owner_object)[:255]

        self.full_clean()
        super().save(*args, **kwargs)


class DocumentVersion(BaseModel):
    """
    Versión histórica de un documento.

    Regla:
    - No se destruye una versión anterior al reemplazar.
    - Solo una versión debe estar activa.
    - Reemplazar una versión exige motivo.
    """

    document = models.ForeignKey(
        DocumentFile,
        on_delete=models.CASCADE,
        related_name="versions",
        verbose_name="Documento",
    )
    version_number = models.PositiveIntegerField(
        verbose_name="Número de versión",
    )

    file = models.FileField(
        upload_to="documents/%Y/%m/",
        verbose_name="Archivo",
    )
    original_filename = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Nombre original",
    )
    file_sha256 = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name="Hash SHA256",
    )
    content_type = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Tipo MIME",
    )
    size_bytes = models.PositiveBigIntegerField(
        default=0,
        verbose_name="Tamaño en bytes",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_versions_uploaded",
        verbose_name="Subido por",
    )
    origin = models.CharField(
        max_length=30,
        choices=AuditOrigin.choices,
        default=AuditOrigin.MANUAL,
        db_index=True,
        verbose_name="Origen",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Versión activa",
    )
    replaced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de reemplazo",
    )
    replaced_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="document_versions_replaced",
        verbose_name="Reemplazada por",
    )
    replace_reason = models.TextField(
        blank=True,
        verbose_name="Motivo de reemplazo",
    )

    class Meta:
        verbose_name = "Versión de documento"
        verbose_name_plural = "Versiones de documentos"
        ordering = ["document", "-version_number"]
        indexes = [
            models.Index(fields=["document", "is_active"]),
            models.Index(fields=["file_sha256"]),
            models.Index(fields=["origin", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "version_number"],
                name="unique_document_version_number",
            ),
            models.UniqueConstraint(
                fields=["document"],
                condition=models.Q(is_active=True),
                name="unique_active_document_version",
            ),
        ]

    def __str__(self):
        return f"{self.document} v{self.version_number}"

    def clean(self):
        super().clean()

        if not self.document_id:
            raise ValidationError({"document": "La versión debe pertenecer a un documento."})

        if self.version_number <= 0:
            raise ValidationError(
                {"version_number": "El número de versión debe ser mayor a cero."}
            )

        if not self.file:
            raise ValidationError({"file": "Debe adjuntar un archivo."})

        validate_document_file(self.file, self.content_type)

    def save(self, *args, **kwargs):
        if self.file:
            self.original_filename = self.original_filename or Path(self.file.name).name
            self.size_bytes = getattr(self.file, "size", self.size_bytes or 0)

            if not self.content_type:
                guessed_type, _ = mimetypes.guess_type(self.original_filename)
                self.content_type = guessed_type or ""

            if not self.file_sha256:
                self.file_sha256 = calculate_file_sha256(self.file)

        self.full_clean()
        super().save(*args, **kwargs)

    def mark_replaced(self, *, user=None, reason=""):
        self.is_active = False
        self.replaced_at = timezone.now()
        self.replaced_by = user
        self.replace_reason = reason
        self.updated_by = user
        self.save(
            update_fields=[
                "is_active",
                "replaced_at",
                "replaced_by",
                "replace_reason",
                "updated_by",
                "updated_at",
            ]
        )


def validate_document_file(file, content_type=""):
    filename = Path(file.name).name
    extension = Path(filename).suffix.lower()
    size = getattr(file, "size", 0)

    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            {
                "file": (
                    f"Extensión no permitida: {extension}. "
                    f"Permitidas: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
                )
            }
        )

    if size and size > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError(
            {
                "file": (
                    "El archivo supera el tamaño máximo permitido "
                    f"de {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)} MB."
                )
            }
        )

    guessed_type, _ = mimetypes.guess_type(filename)
    mime_to_check = content_type or guessed_type or ""

    if mime_to_check and mime_to_check not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            {
                "file": (
                    f"Tipo MIME no permitido: {mime_to_check}. "
                    "Revise que el archivo sea válido."
                )
            }
        )


def calculate_file_sha256(file):
    sha256 = hashlib.sha256()

    original_position = None

    try:
        original_position = file.tell()
    except Exception:
        original_position = None

    try:
        file.seek(0)
    except Exception:
        pass

    if hasattr(file, "chunks"):
        for chunk in file.chunks():
            sha256.update(chunk)
    else:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            sha256.update(chunk)

    try:
        file.seek(original_position or 0)
    except Exception:
        pass

    return sha256.hexdigest()