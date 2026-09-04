import re
import unicodedata

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel


def normalize_text(value):
    if not value:
        return ""

    value = str(value).strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()

    return value


def normalize_rut(value):
    if not value:
        return ""

    value = str(value).strip().upper()
    value = value.replace(".", "").replace("-", "").replace(" ", "")

    return value


def normalize_email(value):
    if not value:
        return ""

    return str(value).strip().lower()


class Collaborator(BaseModel):
    """
    Persona interna de NEXO.

    Regla de negocio:
    - Crear colaborador NO crea usuario.
    - Crear colaborador NO crea contacto externo.
    - Un colaborador puede vincularse opcionalmente a un usuario interno.
    - La vinculación permite trazabilidad, pero no define por sí sola permisos.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="collaborator",
        verbose_name="Usuario vinculado",
    )

    rut = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    rut_normalized = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        verbose_name="RUT normalizado",
    )

    first_name = models.CharField(
        max_length=120,
        verbose_name="Nombres",
    )
    last_name = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Apellidos",
    )
    full_name_normalized = models.CharField(
        max_length=260,
        blank=True,
        db_index=True,
        verbose_name="Nombre completo normalizado",
    )

    email = models.EmailField(
        blank=True,
        verbose_name="Correo",
    )
    email_normalized = models.EmailField(
        blank=True,
        db_index=True,
        verbose_name="Correo normalizado",
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Teléfono",
    )
    position = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Cargo",
    )
    department = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Departamento interno",
    )
    shift = models.CharField(
        max_length=80,
        blank=True,
        verbose_name="Turno",
    )

    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de ingreso",
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de salida",
    )

    observations = models.TextField(
        blank=True,
        verbose_name="Observaciones",
    )

    class Meta:
        verbose_name = "Colaborador"
        verbose_name_plural = "Colaboradores"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["status", "department"]),
            models.Index(fields=["rut_normalized"]),
            models.Index(fields=["email_normalized"]),
            models.Index(fields=["full_name_normalized"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["rut_normalized"],
                condition=~models.Q(rut_normalized=""),
                name="unique_collaborator_rut_normalized",
            ),
            models.UniqueConstraint(
                fields=["email_normalized"],
                condition=~models.Q(email_normalized=""),
                name="unique_collaborator_email_normalized",
            ),
        ]

    def __str__(self):
        return self.full_name or "Colaborador sin nombre"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def clean(self):
        super().clean()

        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {
                    "end_date": "La fecha de salida no puede ser anterior a la fecha de ingreso."
                }
            )

    def save(self, *args, **kwargs):
        self.rut_normalized = normalize_rut(self.rut)
        self.email_normalized = normalize_email(self.email)
        self.full_name_normalized = normalize_text(self.full_name)

        super().save(*args, **kwargs)