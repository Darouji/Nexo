from django.db import models


class CollaboratorStatus(models.TextChoices):
    ACTIVO = "ACTIVO", "Activo"
    INACTIVO = "INACTIVO", "Inactivo"
    SUSPENDIDO = "SUSPENDIDO", "Suspendido"


class Collaborator(models.Model):
    rut = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    first_name = models.CharField(max_length=120, verbose_name="Nombres")
    last_name = models.CharField(max_length=120, verbose_name="Apellidos")
    position = models.CharField(max_length=120, blank=True, verbose_name="Cargo")
    area = models.CharField(max_length=120, blank=True, verbose_name="Área")
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    shift = models.CharField(max_length=80, blank=True, verbose_name="Turno")
    status = models.CharField(
        max_length=20,
        choices=CollaboratorStatus.choices,
        default=CollaboratorStatus.ACTIVO,
        verbose_name="Estado",
    )
    observations = models.TextField(blank=True, verbose_name="Observaciones")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Colaborador"
        verbose_name_plural = "Colaboradores"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or "Colaborador sin nombre"