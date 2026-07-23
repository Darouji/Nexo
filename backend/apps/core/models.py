from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone


class BaseStatus(models.TextChoices):
    ACTIVO = "ACTIVO", "Activo"
    INACTIVO = "INACTIVO", "Inactivo"
    ANULADO = "ANULADO", "Anulado"
    ARCHIVADO = "ARCHIVADO", "Archivado"


class AuditAction(models.TextChoices):
    CREAR = "CREAR", "Crear"
    EDITAR = "EDITAR", "Editar"
    RENOMBRAR = "RENOMBRAR", "Renombrar"
    FUSIONAR = "FUSIONAR", "Fusionar"
    CAMBIAR_ORIGEN = "CAMBIAR_ORIGEN", "Cambiar origen"
    ANULAR = "ANULAR", "Anular"
    INACTIVAR = "INACTIVAR", "Inactivar"
    ARCHIVAR = "ARCHIVAR", "Archivar"
    RESTAURAR = "RESTAURAR", "Restaurar"
    IMPORTAR = "IMPORTAR", "Importar"
    EXPORTAR = "EXPORTAR", "Exportar"
    REEMPLAZAR_DOCUMENTO = "REEMPLAZAR_DOCUMENTO", "Reemplazar documento"
    CAMBIAR_ESTADO = "CAMBIAR_ESTADO", "Cambiar estado"
    AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO", "Ajuste inventario"
    TRASLADAR = "TRASLADAR", "Trasladar"
    LOGIN = "LOGIN", "Inicio de sesión"
    LOGOUT = "LOGOUT", "Cierre de sesión"
    ELIMINAR = "ELIMINAR", "Eliminar"


class AuditOrigin(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    API = "API", "API"
    IMPORTACION_EXCEL = "IMPORTACION_EXCEL", "Importación Excel"
    AUTOMATICO = "AUTOMATICO", "Automático"
    SISTEMA = "SISTEMA", "Sistema"


class AlertSeverity(models.TextChoices):
    INFORMATIVA = "INFORMATIVA", "Informativa"
    ADVERTENCIA = "ADVERTENCIA", "Advertencia"
    BLOQUEANTE = "BLOQUEANTE", "Bloqueante"


class BaseModel(models.Model):
    """
    Modelo base para registros principales del sistema.

    Regla de negocio:
    - No se elimina físicamente información importante.
    - La vigencia se controla por status.
    - La trazabilidad mínima queda en created_at, updated_at, created_by y updated_by.
    """

    status = models.CharField(
        max_length=20,
        choices=BaseStatus.choices,
        default=BaseStatus.ACTIVO,
        db_index=True,
        verbose_name="Estado",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Fecha de creación",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        verbose_name="Creado por",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        verbose_name="Actualizado por",
    )

    class Meta:
        abstract = True

    @property
    def is_active(self):
        return self.status == BaseStatus.ACTIVO

    def mark_inactive(self, user=None):
        self.status = BaseStatus.INACTIVO
        self.updated_by = user
        self.save(update_fields=["status", "updated_by", "updated_at"])

    def mark_annulled(self, user=None):
        self.status = BaseStatus.ANULADO
        self.updated_by = user
        self.save(update_fields=["status", "updated_by", "updated_at"])

    def mark_archived(self, user=None):
        self.status = BaseStatus.ARCHIVADO
        self.updated_by = user
        self.save(update_fields=["status", "updated_by", "updated_at"])


class AuditLog(models.Model):
    """
    Auditoría global del sistema.

    Guarda acciones relevantes del sistema, ya sean manuales, automáticas,
    por API o por importaciones. No reemplaza al historial específico por registro.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="Usuario",
    )
    action = models.CharField(
        max_length=50,
        choices=AuditAction.choices,
        db_index=True,
        verbose_name="Acción",
    )
    origin = models.CharField(
        max_length=30,
        choices=AuditOrigin.choices,
        default=AuditOrigin.MANUAL,
        db_index=True,
        verbose_name="Origen",
    )
    module = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Módulo",
    )
    model_name = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Modelo",
    )

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Tipo de contenido",
    )
    object_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="ID registro afectado",
    )
    content_object = GenericForeignKey("content_type", "object_id")

    object_repr = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Descripción legible del registro",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="Dirección IP",
    )
    user_agent = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="User agent",
    )
    reason = models.TextField(
        blank=True,
        verbose_name="Motivo",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Metadatos",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Fecha y hora",
    )

    class Meta:
        verbose_name = "Auditoría global"
        verbose_name_plural = "Auditoría global"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["module", "model_name"]),
        ]

    def __str__(self):
        actor = self.actor or "Sistema"
        target = self.object_repr or self.model_name or self.module or "registro"
        return f"{actor} - {self.action} - {target}"


class RecordChangeLog(models.Model):
    """
    Historial específico por registro.

    Se usa para saber qué campo cambió, cuál era el valor anterior,
    cuál es el valor nuevo, quién lo cambió y por qué.
    """

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name="Tipo de contenido",
    )
    object_id = models.CharField(
        max_length=100,
        verbose_name="ID registro",
    )
    content_object = GenericForeignKey("content_type", "object_id")

    action = models.CharField(
        max_length=50,
        choices=AuditAction.choices,
        db_index=True,
        verbose_name="Acción",
    )
    field_name = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Campo modificado",
    )
    old_value = models.TextField(
        blank=True,
        verbose_name="Valor anterior",
    )
    new_value = models.TextField(
        blank=True,
        verbose_name="Valor nuevo",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="record_changes",
        verbose_name="Modificado por",
    )
    origin = models.CharField(
        max_length=30,
        choices=AuditOrigin.choices,
        default=AuditOrigin.MANUAL,
        db_index=True,
        verbose_name="Origen",
    )
    reason = models.TextField(
        blank=True,
        verbose_name="Motivo",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Fecha y hora",
    )

    class Meta:
        verbose_name = "Historial por registro"
        verbose_name_plural = "Historial por registro"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.content_type} #{self.object_id} - {self.action}"


class RecordAlert(BaseModel):
    """
    Alerta asociada a un registro específico.

    Ejemplos futuros:
    - STOCK_INSUFICIENTE
    - FALTA_FACTURA
    - RELACION_INCONSISTENTE
    - DOCUMENTO_REEMPLAZADO
    """

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name="Tipo de contenido",
    )
    object_id = models.CharField(
        max_length=100,
        verbose_name="ID registro",
    )
    content_object = GenericForeignKey("content_type", "object_id")

    code = models.CharField(
        max_length=80,
        db_index=True,
        verbose_name="Código interno",
    )
    message = models.CharField(
        max_length=255,
        verbose_name="Mensaje visible",
    )
    severity = models.CharField(
        max_length=20,
        choices=AlertSeverity.choices,
        default=AlertSeverity.ADVERTENCIA,
        db_index=True,
        verbose_name="Severidad",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Activa",
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de resolución",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_alerts",
        verbose_name="Resuelta por",
    )

    class Meta:
        verbose_name = "Alerta por registro"
        verbose_name_plural = "Alertas por registro"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id", "is_active"]),
            models.Index(fields=["code", "severity"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.message}"

    def resolve(self, user=None):
        self.is_active = False
        self.resolved_by = user
        self.resolved_at = timezone.now()
        self.save(
            update_fields=["is_active", "resolved_by", "resolved_at", "updated_at"]
        )


class ColumnDisplayName(BaseModel):
    """
    Permite cambiar etiquetas visibles sin cambiar campos reales del backend.

    Ejemplo:
    - field_key: purchase_order
    - visible_name: Orden de Compra Cliente
    """

    module = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Módulo",
    )
    model_name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Modelo",
    )
    field_key = models.CharField(
        max_length=120,
        verbose_name="Campo backend",
    )
    visible_name = models.CharField(
        max_length=160,
        verbose_name="Nombre visible",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )
    modified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="column_display_names_modified",
        verbose_name="Modificado por",
    )

    class Meta:
        verbose_name = "Nombre visible de columna"
        verbose_name_plural = "Nombres visibles de columnas"
        ordering = ["module", "model_name", "field_key"]
        constraints = [
            models.UniqueConstraint(
                fields=["module", "model_name", "field_key"],
                name="unique_column_display_name_by_field",
            )
        ]

    def __str__(self):
        return f"{self.module}.{self.model_name}.{self.field_key} = {self.visible_name}"


class SmartTag(BaseModel):
    """
    Etiqueta transversal reutilizable para agrupar registros.
    """

    name = models.CharField(
        max_length=80,
        unique=True,
        verbose_name="Nombre",
    )
    color_hex = models.CharField(
        max_length=7,
        default="#64748B",
        verbose_name="Color HEX",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción",
    )

    class Meta:
        verbose_name = "Etiqueta inteligente"
        verbose_name_plural = "Etiquetas inteligentes"
        ordering = ["name"]

    def __str__(self):
        return self.name


class SavedView(BaseModel):
    """
    Vista guardada por usuario para mallas, filtros, ordenamientos y columnas.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_views",
        verbose_name="Usuario",
    )
    module = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Módulo",
    )
    model_name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="Modelo",
    )
    name = models.CharField(
        max_length=120,
        verbose_name="Nombre de la vista",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Configuración",
    )
    is_default = models.BooleanField(
        default=False,
        verbose_name="Vista predeterminada",
    )

    class Meta:
        verbose_name = "Vista guardada"
        verbose_name_plural = "Vistas guardadas"
        ordering = ["user", "module", "model_name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "module", "model_name", "name"],
                name="unique_saved_view_name_by_user_model",
            ),
            models.UniqueConstraint(
                fields=["user", "module", "model_name"],
                condition=models.Q(is_default=True),
                name="unique_default_saved_view_by_user_model",
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.module}.{self.model_name} - {self.name}"


class GridPreference(models.Model):
    """
    Diseño visual estable de una grilla, aislado por usuario.

    No almacena filtros, búsqueda ni ordenamiento de la tarea actual. Esos
    criterios pertenecen a SavedView cuando el usuario decide guardarlos de
    forma explícita.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grid_preferences",
        verbose_name="Usuario",
    )
    grid_key = models.CharField(
        max_length=160,
        db_index=True,
        verbose_name="Clave estable de grilla",
    )
    definition_version = models.PositiveIntegerField(
        default=1,
        verbose_name="Versión de definición",
    )
    revision = models.PositiveIntegerField(
        default=1,
        verbose_name="Revisión optimista",
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Diseño visual estable",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de creación",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )

    class Meta:
        verbose_name = "Preferencia de grilla"
        verbose_name_plural = "Preferencias de grilla"
        ordering = ["user", "grid_key"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "grid_key"],
                name="unique_grid_preference_by_user_key",
            )
        ]
        indexes = [
            models.Index(fields=["user", "updated_at"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.grid_key} (r{self.revision})"
