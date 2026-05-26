from django.conf import settings
from django.db import models


class UserRole(models.TextChoices):
    ADMINISTRADOR = "ADMINISTRADOR", "Administrador"
    FINANZAS_COMERCIAL = "FINANZAS_COMERCIAL", "Finanzas / Comercial"
    RRHH = "RRHH", "RRHH"
    SUPERVISOR = "SUPERVISOR", "Supervisor"
    TRABAJADOR = "TRABAJADOR", "Trabajador"
    SOLO_LECTURA = "SOLO_LECTURA", "Solo lectura"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.TRABAJADOR,
    )
    is_active_profile = models.BooleanField(default=True)
    phone = models.CharField(max_length=30, blank=True)
    position = models.CharField(max_length=120, blank=True)
    area = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuario"

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"