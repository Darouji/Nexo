from django.db import models
from django.conf import settings

class BaseModel(models.Model):
    status = models.BooleanField(default=True, verbose_name="Activo / Válido")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        verbose_name="Creado por"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        verbose_name="Actualizado por"
    )

    class Meta:
        abstract = True


class ActivityLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Usuario"
    )
    action = models.CharField(max_length=50, verbose_name="Acción HTTP")
    model_name = models.CharField(max_length=255, verbose_name="Ruta / Módulo")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="Fecha y Hora")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="Dirección IP")
    details = models.TextField(blank=True, verbose_name="Detalles Adicionales")

    class Meta:
        verbose_name = "Registro de Actividad"
        verbose_name_plural = "Registros de Actividad"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user} - {self.action} en {self.model_name} ({self.timestamp})"