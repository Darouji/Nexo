import hashlib
from pathlib import Path

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel


ALLOWED_IMPORT_EXTENSIONS = {".xlsx", ".csv"}
MAX_IMPORT_SIZE_BYTES = 15 * 1024 * 1024


class ImportTarget(models.TextChoices):
    PRODUCTOS = "PRODUCTOS", "Productos"


class ImportBatchStatus(models.TextChoices):
    CREADO = "CREADO", "Creado"
    PREVALIDADO = "PREVALIDADO", "Prevalidado"
    PROCESADO = "PROCESADO", "Procesado"
    FALLIDO = "FALLIDO", "Fallido"
    CANCELADO = "CANCELADO", "Cancelado"


class ImportRowStatus(models.TextChoices):
    VALIDO = "VALIDO", "Válido"
    ERROR = "ERROR", "Error"
    DUPLICADO = "DUPLICADO", "Duplicado"
    REQUIERE_REVISION = "REQUIERE_REVISION", "Requiere revisión"
    OMITIDO = "OMITIDO", "Omitido"
    IMPORTADO = "IMPORTADO", "Importado"


class ImportBatch(BaseModel):
    target = models.CharField(
        max_length=40,
        choices=ImportTarget.choices,
        db_index=True,
        verbose_name="Destino de importación",
    )
    file = models.FileField(
        upload_to="imports/%Y/%m/",
        verbose_name="Archivo de importación",
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

    batch_status = models.CharField(
        max_length=30,
        choices=ImportBatchStatus.choices,
        default=ImportBatchStatus.CREADO,
        db_index=True,
        verbose_name="Estado del lote",
    )

    total_rows = models.PositiveIntegerField(default=0, verbose_name="Filas totales")
    valid_rows = models.PositiveIntegerField(default=0, verbose_name="Filas válidas")
    error_rows = models.PositiveIntegerField(default=0, verbose_name="Filas con error")
    duplicate_rows = models.PositiveIntegerField(default=0, verbose_name="Filas duplicadas")
    review_rows = models.PositiveIntegerField(default=0, verbose_name="Filas para revisión")
    imported_rows = models.PositiveIntegerField(default=0, verbose_name="Filas importadas")
    omitted_rows = models.PositiveIntegerField(default=0, verbose_name="Filas omitidas")

    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processed_import_batches",
        verbose_name="Procesado por",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de procesamiento",
    )
    notes = models.TextField(blank=True, verbose_name="Notas")

    class Meta:
        verbose_name = "Lote de importación"
        verbose_name_plural = "Lotes de importación"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target", "batch_status"]),
            models.Index(fields=["file_sha256"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.get_target_display()} - {self.original_filename or self.pk}"

    def clean(self):
        super().clean()

        if not self.target:
            raise ValidationError({"target": "Debe indicar el destino de importación."})

        if not self.file:
            raise ValidationError({"file": "Debe adjuntar un archivo."})

        validate_import_file(self.file)

    def save(self, *args, **kwargs):
        if self.file:
            self.original_filename = self.original_filename or Path(self.file.name).name
            self.size_bytes = getattr(self.file, "size", self.size_bytes or 0)

            if not self.file_sha256:
                self.file_sha256 = calculate_file_sha256(self.file)

        self.full_clean()
        super().save(*args, **kwargs)

    def update_counters(self):
        rows = self.rows.all()

        self.total_rows = rows.count()
        self.valid_rows = rows.filter(row_status=ImportRowStatus.VALIDO).count()
        self.error_rows = rows.filter(row_status=ImportRowStatus.ERROR).count()
        self.duplicate_rows = rows.filter(row_status=ImportRowStatus.DUPLICADO).count()
        self.review_rows = rows.filter(row_status=ImportRowStatus.REQUIERE_REVISION).count()
        self.imported_rows = rows.filter(row_status=ImportRowStatus.IMPORTADO).count()
        self.omitted_rows = rows.filter(row_status=ImportRowStatus.OMITIDO).count()

        self.save(
            update_fields=[
                "total_rows",
                "valid_rows",
                "error_rows",
                "duplicate_rows",
                "review_rows",
                "imported_rows",
                "omitted_rows",
                "updated_at",
            ]
        )


class ImportRow(BaseModel):
    batch = models.ForeignKey(
        ImportBatch,
        on_delete=models.CASCADE,
        related_name="rows",
        verbose_name="Lote",
    )
    row_number = models.PositiveIntegerField(verbose_name="Número de fila")
    row_status = models.CharField(
        max_length=30,
        choices=ImportRowStatus.choices,
        db_index=True,
        verbose_name="Estado de fila",
    )

    raw_data = models.JSONField(default=dict, blank=True, verbose_name="Datos originales")
    normalized_data = models.JSONField(default=dict, blank=True, verbose_name="Datos normalizados")
    messages = models.JSONField(default=list, blank=True, verbose_name="Mensajes")

    imported_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Tipo de objeto importado",
    )
    imported_object_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="ID objeto importado",
    )
    imported_object = GenericForeignKey("imported_content_type", "imported_object_id")
    imported_repr = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Objeto importado legible",
    )

    class Meta:
        verbose_name = "Fila de importación"
        verbose_name_plural = "Filas de importación"
        ordering = ["batch", "row_number"]
        indexes = [
            models.Index(fields=["batch", "row_status"]),
            models.Index(fields=["row_number"]),
            models.Index(fields=["imported_content_type", "imported_object_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "row_number"],
                name="unique_import_row_number_by_batch",
            )
        ]

    def __str__(self):
        return f"{self.batch_id} - fila {self.row_number} - {self.row_status}"


def validate_import_file(file):
    filename = Path(file.name).name
    extension = Path(filename).suffix.lower()
    size = getattr(file, "size", 0)

    if extension not in ALLOWED_IMPORT_EXTENSIONS:
        raise ValidationError(
            {
                "file": (
                    f"Extensión no permitida: {extension}. "
                    f"Permitidas: {', '.join(sorted(ALLOWED_IMPORT_EXTENSIONS))}."
                )
            }
        )

    if size and size > MAX_IMPORT_SIZE_BYTES:
        raise ValidationError(
            {
                "file": (
                    "El archivo supera el tamaño máximo permitido "
                    f"de {MAX_IMPORT_SIZE_BYTES // (1024 * 1024)} MB."
                )
            }
        )


def calculate_file_sha256(file):
    sha256 = hashlib.sha256()

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