from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.commercial.models import Area, Contacto, Minera, Subarea
from apps.core.models import AlertSeverity, BaseModel, BaseStatus
from apps.inventory.models import Producto


MONEY_QUANTIZER = Decimal("0.01")


def quantize_money(value):
    return Decimal(value).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


class VentaStatus(models.TextChoices):
    INGRESADA = "INGRESADA", "Ingresada"
    CONCRETADA = "CONCRETADA", "Concretada"
    ANULADA = "ANULADA", "Anulada"


class TipoDocumento(models.TextChoices):
    GUIA_DESPACHO = "GUIA_DESPACHO", "Guía de despacho"
    HES = "HES", "HES"
    OTRO = "OTRO", "Otro"


class VentaAlertCode(models.TextChoices):
    FALTA_FACTURA = "FALTA_FACTURA", "Falta factura"
    FALTA_GUIA = "FALTA_GUIA", "Falta guía de despacho o HES"
    FACTURA_DUPLICADA = "FACTURA_DUPLICADA", "Factura posiblemente duplicada"
    OC_DUPLICADA = "OC_DUPLICADA", "Orden de compra posiblemente duplicada"
    STOCK_INSUFICIENTE = "STOCK_INSUFICIENTE", "Stock insuficiente"
    RELACION_INCONSISTENTE = "RELACION_INCONSISTENTE", "Relación comercial inconsistente"
    VALORES_INCONSISTENTES = "VALORES_INCONSISTENTES", "Valores de venta no cuadran"
    DOCUMENTO_REEMPLAZADO = "DOCUMENTO_REEMPLAZADO", "Documento reemplazado recientemente"


class Venta(BaseModel):
    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas_registradas",
        verbose_name="Operador",
    )

    sale_status = models.CharField(
        max_length=30,
        choices=VentaStatus.choices,
        default=VentaStatus.INGRESADA,
        db_index=True,
        verbose_name="Estado comercial",
    )

    fecha_venta = models.DateField(
        default=timezone.localdate,
        db_index=True,
        verbose_name="Fecha de venta",
    )

    fecha_factura = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de factura",
    )
    factura_numero = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Número de factura",
    )
    factura_pdf = models.FileField(
        upload_to="documentos/facturas/",
        blank=True,
        null=True,
        verbose_name="Factura PDF",
    )

    orden_compra = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Orden de compra",
    )

    minera = models.ForeignKey(
        Minera,
        on_delete=models.PROTECT,
        related_name="ventas",
        verbose_name="Minera",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ventas",
        verbose_name="Área",
    )
    subarea = models.ForeignKey(
        Subarea,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ventas",
        verbose_name="Subárea",
    )
    contacto = models.ForeignKey(
        Contacto,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ventas",
        verbose_name="Contacto",
    )

    valor_neto = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Valor neto",
    )
    iva = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="IVA",
    )
    total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Total",
    )

    tipo_documento = models.CharField(
        max_length=50,
        choices=TipoDocumento.choices,
        default=TipoDocumento.GUIA_DESPACHO,
        verbose_name="Tipo documento logístico",
    )
    numero_guia_hes = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Número guía / HES",
    )
    guia_pdf = models.FileField(
        upload_to="documentos/guias/",
        blank=True,
        null=True,
        verbose_name="Guía / HES PDF",
    )

    stock_descontado = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Stock descontado",
    )

    concretada_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de concreción",
    )
    concretada_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas_concretadas",
        verbose_name="Concretada por",
    )

    anulada_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de anulación",
    )
    anulada_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas_anuladas",
        verbose_name="Anulada por",
    )
    anulacion_motivo = models.TextField(
        blank=True,
        verbose_name="Motivo de anulación",
    )

    observations = models.TextField(
        blank=True,
        verbose_name="Observaciones",
    )

    class Meta:
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"
        ordering = ["-fecha_venta", "-created_at"]
        indexes = [
            models.Index(fields=["sale_status", "fecha_venta"]),
            models.Index(fields=["minera", "fecha_venta"]),
            models.Index(fields=["factura_numero"]),
            models.Index(fields=["orden_compra"]),
            models.Index(fields=["numero_guia_hes"]),
            models.Index(fields=["stock_descontado"]),
        ]

    def __str__(self):
        return f"Venta {self.pk or 'nueva'} - {self.minera.name if self.minera_id else 'Sin minera'}"

    @property
    def validation_summary(self):
        active_alerts = self.alerts.filter(is_active=True)

        if active_alerts.filter(severity=AlertSeverity.BLOQUEANTE).exists():
            return "BLOQUEANTE"

        if active_alerts.exists():
            return "CON_ALERTAS"

        return "OK"

    def clean(self):
        super().clean()

        if self.sale_status == VentaStatus.ANULADA and not self.anulacion_motivo:
            raise ValidationError(
                {"anulacion_motivo": "Una venta anulada debe tener motivo obligatorio."}
            )

        if not self.minera_id:
            raise ValidationError({"minera": "La venta debe estar asociada a una minera."})

        if self.area_id and self.area.minera_id != self.minera_id:
            raise ValidationError(
                {"area": "El área seleccionada no pertenece a la minera de la venta."}
            )

        if self.subarea_id:
            if self.area_id and self.subarea.area_id != self.area_id:
                raise ValidationError(
                    {"subarea": "La subárea seleccionada no pertenece al área de la venta."}
                )

            if self.subarea.area.minera_id != self.minera_id:
                raise ValidationError(
                    {"subarea": "La subárea seleccionada no pertenece a la minera de la venta."}
                )

        if self.contacto_id:
            if self.contacto.subarea_id is None:
                raise ValidationError(
                    {"contacto": "El contacto seleccionado no tiene subárea asociada."}
                )

            if self.subarea_id and self.contacto.subarea_id != self.subarea_id:
                raise ValidationError(
                    {"contacto": "El contacto no pertenece a la subárea de la venta."}
                )

            if self.area_id and self.contacto.area.id != self.area_id:
                raise ValidationError(
                    {"contacto": "El contacto no pertenece al área de la venta."}
                )

            if self.contacto.minera.id != self.minera_id:
                raise ValidationError(
                    {"contacto": "El contacto no pertenece a la minera de la venta."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class DetalleVenta(BaseModel):
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name="detalles",
        verbose_name="Venta",
    )
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="ventas_detalle",
        verbose_name="Producto",
    )

    cantidad = models.PositiveIntegerField(verbose_name="Cantidad")
    valor_unitario = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="Valor unitario",
    )
    valor_total = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        verbose_name="Valor total línea",
    )

    codigo_sap = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Código SAP",
    )
    controla_stock_snapshot = models.BooleanField(
        default=True,
        verbose_name="Controlaba stock al registrar",
    )

    class Meta:
        verbose_name = "Detalle de venta"
        verbose_name_plural = "Detalles de venta"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["venta", "producto"]),
            models.Index(fields=["producto"]),
            models.Index(fields=["codigo_sap"]),
        ]

    def __str__(self):
        return f"{self.cantidad} x {self.producto.modelo} (Venta {self.venta_id})"

    def clean(self):
        super().clean()

        if not self.venta_id:
            raise ValidationError({"venta": "El detalle debe pertenecer a una venta."})

        if not self.producto_id:
            raise ValidationError({"producto": "El detalle debe tener producto."})

        if self.cantidad <= 0:
            raise ValidationError({"cantidad": "La cantidad debe ser mayor a cero."})

        if self.valor_unitario < 0:
            raise ValidationError(
                {"valor_unitario": "El valor unitario no puede ser negativo."}
            )

    def save(self, *args, **kwargs):
        self.controla_stock_snapshot = self.producto.controla_stock
        self.valor_total = quantize_money(Decimal(self.cantidad) * self.valor_unitario)

        if not self.codigo_sap:
            self.codigo_sap = self.producto.codigo_sap

        self.full_clean()
        super().save(*args, **kwargs)


class VentaAlert(BaseModel):
    venta = models.ForeignKey(
        Venta,
        on_delete=models.CASCADE,
        related_name="alerts",
        verbose_name="Venta",
    )
    code = models.CharField(
        max_length=80,
        choices=VentaAlertCode.choices,
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
        related_name="resolved_sale_alerts",
        verbose_name="Resuelta por",
    )

    class Meta:
        verbose_name = "Alerta de venta"
        verbose_name_plural = "Alertas de venta"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["venta", "is_active"]),
            models.Index(fields=["code", "severity"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["venta", "code"],
                condition=models.Q(is_active=True),
                name="unique_active_sale_alert_code",
            )
        ]

    def __str__(self):
        return f"{self.venta_id} - {self.code}"

    def resolve(self, user=None):
        self.is_active = False
        self.resolved_by = user
        self.resolved_at = timezone.now()
        self.updated_by = user
        self.save(
            update_fields=[
                "is_active",
                "resolved_by",
                "resolved_at",
                "updated_by",
                "updated_at",
            ]
        )