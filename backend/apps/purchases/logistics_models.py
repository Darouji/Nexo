from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel
from apps.core.utils import normalize_text


class ShipmentStatus(models.TextChoices):
    PREPARANDO = "PREPARANDO", "Preparando envío"
    DESPACHADO = "DESPACHADO", "Despachado"
    EN_TRANSITO = "EN_TRANSITO", "En tránsito"
    EN_ADUANA = "EN_ADUANA", "En Aduanas"
    RETENIDO = "RETENIDO", "Retenido"
    LIBERADO = "LIBERADO", "Liberado"
    EN_REPARTO = "EN_REPARTO", "En reparto"
    ENTREGADO = "ENTREGADO", "Entregado"
    CON_INCIDENCIA = "CON_INCIDENCIA", "Con incidencia"
    CANCELADO = "CANCELADO", "Cancelado"


class ShipmentTransportMode(models.TextChoices):
    COURIER = "COURIER", "Courier"
    AEREO = "AEREO", "Aéreo"
    MARITIMO = "MARITIMO", "Marítimo"
    TERRESTRE = "TERRESTRE", "Terrestre"
    OTRO = "OTRO", "Otro"


class ShipmentCustodian(models.TextChoices):
    PROVEEDOR = "PROVEEDOR", "Proveedor"
    TRANSPORTISTA_ORIGEN = "TRANSPORTISTA_ORIGEN", "Transportista de origen"
    TRANSPORTISTA_INTERNACIONAL = (
        "TRANSPORTISTA_INTERNACIONAL",
        "Transportista internacional",
    )
    ADUANA = "ADUANA", "Aduanas"
    AGENTE_ADUANA = "AGENTE_ADUANA", "Agente de aduanas"
    COURIER_CHILE = "COURIER_CHILE", "Courier en Chile"
    ULTIMA_MILLA = "ULTIMA_MILLA", "Transportista de última milla"
    EMPRESA = "EMPRESA", "EMPRESA"
    OTRO = "OTRO", "Otro"


class ShipmentEventType(models.TextChoices):
    ACTUALIZACION = "ACTUALIZACION", "Actualización"
    DESPACHO = "DESPACHO", "Despacho"
    LLEGADA_PAIS = "LLEGADA_PAIS", "Llegada al país"
    REVISION_ADUANERA = "REVISION_ADUANERA", "Revisión aduanera"
    DOCUMENTACION = "DOCUMENTACION", "Solicitud de documentación"
    RETENCION = "RETENCION", "Retención"
    LIBERACION = "LIBERACION", "Liberación"
    ENTREGA = "ENTREGA", "Entrega"
    INCIDENCIA = "INCIDENCIA", "Incidencia"
    CAMBIO_ESTIMACION = "CAMBIO_ESTIMACION", "Cambio de estimación"


class ShipmentChargeType(models.TextChoices):
    FLETE_ADICIONAL = "FLETE_ADICIONAL", "Flete adicional"
    DERECHO_ADUANERO = "DERECHO_ADUANERO", "Derecho aduanero"
    IVA_IMPORTACION = "IVA_IMPORTACION", "IVA de importación"
    ALMACENAMIENTO = "ALMACENAMIENTO", "Almacenamiento"
    SEGURO = "SEGURO", "Seguro"
    REENTREGA = "REENTREGA", "Reentrega"
    DEMORA = "DEMORA", "Demora"
    COMISION_COURIER = "COMISION_COURIER", "Comisión del courier"
    COMISION_BANCARIA = "COMISION_BANCARIA", "Comisión bancaria"
    OTRO = "OTRO", "Otro"


class ShipmentChargeStatus(models.TextChoices):
    ESTIMADO = "ESTIMADO", "Estimado"
    CONFIRMADO = "CONFIRMADO", "Confirmado"
    EN_DISPUTA = "EN_DISPUTA", "En disputa"
    REEMBOLSADO = "REEMBOLSADO", "Reembolsado"
    RECHAZADO = "RECHAZADO", "Rechazado"


class PurchaseOrderSequence(models.Model):
    year = models.PositiveSmallIntegerField(unique=True)
    next_value = models.PositiveIntegerField(default=1)

    class Meta:
        app_label = "purchases"
        verbose_name = "Secuencia de órdenes de compra"
        verbose_name_plural = "Secuencias de órdenes de compra"


class Carrier(BaseModel):
    name = models.CharField(max_length=180, verbose_name="Empresa transportista")
    name_normalized = models.CharField(
        max_length=180,
        editable=False,
        db_index=True,
        verbose_name="Nombre normalizado",
    )
    aliases = models.JSONField(default=list, blank=True, verbose_name="Alias")
    country = models.CharField(max_length=80, blank=True, verbose_name="País")
    website_url = models.URLField(blank=True, verbose_name="Sitio web oficial")
    tracking_url_template = models.URLField(
        blank=True,
        help_text="Puede incluir {tracking_number}.",
        verbose_name="Plantilla oficial de seguimiento",
    )
    contact_name = models.CharField(max_length=160, blank=True, verbose_name="Contacto")
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=60, blank=True, verbose_name="Teléfono")

    class Meta:
        app_label = "purchases"
        ordering = ["name"]
        verbose_name = "Empresa transportista"
        verbose_name_plural = "Empresas transportistas"
        constraints = [
            models.UniqueConstraint(
                fields=["name_normalized"],
                name="purchase_carrier_name_normalized_unique",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        self.name = str(self.name or "").strip()
        self.name_normalized = normalize_text(self.name)
        self.country = str(self.country or "").strip()
        self.contact_name = str(self.contact_name or "").strip()
        self.email = str(self.email or "").strip().lower()
        self.phone = str(self.phone or "").strip()
        self.aliases = [
            str(alias).strip()
            for alias in (self.aliases or [])
            if str(alias).strip()
        ]
        if not self.name:
            raise ValidationError({"name": "La empresa transportista es obligatoria."})
        for field_name in ("website_url", "tracking_url_template"):
            value = str(getattr(self, field_name) or "").strip()
            if value and not value.lower().startswith("https://"):
                raise ValidationError({
                    field_name: "Por seguridad, el enlace oficial debe utilizar HTTPS."
                })
            setattr(self, field_name, value)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def tracking_url_for(self, tracking_number):
        tracking_number = str(tracking_number or "").strip()
        if not tracking_number or not self.tracking_url_template:
            return ""
        if "{tracking_number}" in self.tracking_url_template:
            return self.tracking_url_template.replace(
                "{tracking_number}", quote(tracking_number, safe="")
            )
        return self.tracking_url_template

    def get_audit_target_snapshot(self):
        return {
            "entity_label": "Empresa transportista",
            "display_name": self.name,
            "internal_id": self.pk,
            "identifiers": [
                {"key": "nombre", "label": "Nombre", "value": self.name},
                {"key": "pais", "label": "País", "value": self.country},
            ],
        }


class PurchaseShipment(BaseModel):
    creation_idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        editable=False,
        verbose_name="Clave de idempotencia de creación",
    )
    order = models.ForeignKey(
        "purchases.PurchaseOrder",
        on_delete=models.PROTECT,
        related_name="shipments",
        verbose_name="Orden de compra",
    )
    carrier = models.ForeignKey(
        Carrier,
        on_delete=models.PROTECT,
        related_name="shipments",
        verbose_name="Empresa transportista",
    )
    transport_mode = models.CharField(
        max_length=20,
        choices=ShipmentTransportMode.choices,
        default=ShipmentTransportMode.COURIER,
        verbose_name="Medio de transporte",
    )
    tracking_number = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="Código de seguimiento",
    )
    origin_country = models.CharField(max_length=80, blank=True, verbose_name="País de origen")
    origin_place = models.CharField(max_length=160, blank=True, verbose_name="Lugar de origen")
    destination_place = models.CharField(
        max_length=160,
        default="Chile",
        verbose_name="Destino",
    )
    shipped_date = models.DateField(null=True, blank=True, verbose_name="Fecha de despacho")
    initial_eta = models.DateField(null=True, blank=True, verbose_name="Estimación inicial")
    current_eta = models.DateField(null=True, blank=True, verbose_name="Estimación actual")
    actual_arrival_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha real de llegada",
    )
    state = models.CharField(
        max_length=30,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.PREPARANDO,
        db_index=True,
        verbose_name="Estado logístico",
    )
    current_custodian = models.CharField(
        max_length=40,
        choices=ShipmentCustodian.choices,
        default=ShipmentCustodian.PROVEEDOR,
        verbose_name="Custodia o gestión actual",
    )
    customs_review_expected = models.BooleanField(
        default=False,
        verbose_name="Se espera gestión aduanera especial",
    )
    customs_review_reason = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Motivo de gestión aduanera",
    )
    notes = models.TextField(blank=True, verbose_name="Observaciones")
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="responsible_purchase_shipments",
        verbose_name="Responsable",
    )

    class Meta:
        app_label = "purchases"
        ordering = ["-created_at"]
        verbose_name = "Envío de compra"
        verbose_name_plural = "Envíos de compras"
        indexes = [
            models.Index(fields=["state", "current_eta"]),
            models.Index(fields=["order", "state"]),
            models.Index(fields=["carrier", "tracking_number"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["carrier", "tracking_number"],
                condition=~models.Q(tracking_number=""),
                name="purchase_shipment_carrier_tracking_unique",
            ),
        ]

    def __str__(self):
        return f"{self.order.number} · {self.carrier}"

    def clean(self):
        self.tracking_number = str(self.tracking_number or "").strip()
        self.origin_country = str(self.origin_country or "").strip()
        self.origin_place = str(self.origin_place or "").strip()
        self.destination_place = str(self.destination_place or "").strip()
        self.customs_review_reason = str(self.customs_review_reason or "").strip()
        self.notes = str(self.notes or "").strip()
        if not self.destination_place:
            raise ValidationError({"destination_place": "El destino es obligatorio."})
        if self.shipped_date and self.initial_eta and self.initial_eta < self.shipped_date:
            raise ValidationError({
                "initial_eta": "La estimación inicial no puede ser anterior al despacho."
            })
        if self.shipped_date and self.current_eta and self.current_eta < self.shipped_date:
            raise ValidationError({
                "current_eta": "La estimación actual no puede ser anterior al despacho."
            })
        if self.actual_arrival_date and self.shipped_date:
            if self.actual_arrival_date < self.shipped_date:
                raise ValidationError({
                    "actual_arrival_date": "La llegada no puede ser anterior al despacho."
                })
        if self.customs_review_expected and not self.customs_review_reason:
            raise ValidationError({
                "customs_review_reason": "Explique por qué se espera gestión aduanera especial."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def effective_eta(self):
        return self.current_eta or self.initial_eta

    @property
    def days_remaining(self):
        if not self.effective_eta or self.state in {
            ShipmentStatus.ENTREGADO,
            ShipmentStatus.CANCELADO,
        }:
            return None
        return (self.effective_eta - timezone.localdate()).days

    @property
    def tracking_url(self):
        return self.carrier.tracking_url_for(self.tracking_number)

    def get_audit_target_snapshot(self):
        return {
            "entity_label": "Envío de compra",
            "display_name": f"{self.order.number} · {self.carrier.name}",
            "internal_id": self.pk,
            "identifiers": [
                {"key": "orden", "label": "Orden", "value": self.order.number},
                {
                    "key": "seguimiento",
                    "label": "Seguimiento",
                    "value": self.tracking_number,
                },
                {"key": "estado", "label": "Estado", "value": self.get_state_display()},
            ],
        }


class ShipmentEvent(BaseModel):
    idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        editable=False,
        verbose_name="Clave de idempotencia",
    )
    shipment = models.ForeignKey(
        PurchaseShipment,
        on_delete=models.PROTECT,
        related_name="events",
        verbose_name="Envío",
    )
    event_type = models.CharField(
        max_length=30,
        choices=ShipmentEventType.choices,
        default=ShipmentEventType.ACTUALIZACION,
        verbose_name="Tipo de evento",
    )
    title = models.CharField(max_length=180, verbose_name="Título")
    description = models.TextField(blank=True, verbose_name="Descripción")
    occurred_at = models.DateTimeField(db_index=True, verbose_name="Fecha del evento")
    new_state = models.CharField(
        max_length=30,
        choices=ShipmentStatus.choices,
        blank=True,
        verbose_name="Nuevo estado",
    )
    new_custodian = models.CharField(
        max_length=40,
        choices=ShipmentCustodian.choices,
        blank=True,
        verbose_name="Nueva custodia",
    )
    updated_eta = models.DateField(
        null=True,
        blank=True,
        verbose_name="Nueva estimación",
    )
    evidence_reference = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Referencia o evidencia",
    )
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="purchase_shipment_events",
        verbose_name="Responsable",
    )

    class Meta:
        app_label = "purchases"
        ordering = ["-occurred_at", "-id"]
        verbose_name = "Evento logístico"
        verbose_name_plural = "Eventos logísticos"

    def clean(self):
        self.title = str(self.title or "").strip()
        self.description = str(self.description or "").strip()
        self.evidence_reference = str(self.evidence_reference or "").strip()
        if not self.title:
            raise ValidationError({"title": "El título del evento es obligatorio."})

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Los eventos logísticos son inmutables.")
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Los eventos logísticos no se eliminan.")


class ShipmentCharge(BaseModel):
    idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        editable=False,
        verbose_name="Clave de idempotencia",
    )
    shipment = models.ForeignKey(
        PurchaseShipment,
        on_delete=models.PROTECT,
        related_name="charges",
        verbose_name="Envío",
    )
    charge_type = models.CharField(
        max_length=30,
        choices=ShipmentChargeType.choices,
        verbose_name="Tipo de cobro",
    )
    description = models.CharField(max_length=255, verbose_name="Descripción")
    amount_original = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        verbose_name="Monto original",
    )
    currency = models.CharField(max_length=3, verbose_name="Moneda")
    exchange_rate = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=1,
        verbose_name="Tipo de cambio",
    )
    exchange_rate_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha del tipo de cambio",
    )
    exchange_rate_source = models.CharField(
        max_length=160,
        blank=True,
        verbose_name="Fuente del tipo de cambio",
    )
    amount_clp = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        editable=False,
        verbose_name="Monto CLP",
    )
    charged_by = models.CharField(max_length=180, blank=True, verbose_name="Cobrado por")
    reason = models.CharField(max_length=255, verbose_name="Motivo")
    source_reference = models.CharField(
        max_length=180,
        blank=True,
        verbose_name="Documento de respaldo",
    )
    charge_status = models.CharField(
        max_length=20,
        choices=ShipmentChargeStatus.choices,
        default=ShipmentChargeStatus.ESTIMADO,
        db_index=True,
        verbose_name="Estado del cobro",
    )
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="purchase_shipment_charges",
        verbose_name="Responsable",
    )

    class Meta:
        app_label = "purchases"
        ordering = ["-created_at"]
        verbose_name = "Cobro de envío"
        verbose_name_plural = "Cobros de envíos"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount_original__gte=0),
                name="purchase_shipment_charge_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(exchange_rate__gt=0),
                name="purchase_shipment_charge_fx_positive",
            ),
        ]

    def clean(self):
        self.description = str(self.description or "").strip()
        self.currency = str(self.currency or "").strip().upper()
        self.exchange_rate_source = str(self.exchange_rate_source or "").strip()
        self.charged_by = str(self.charged_by or "").strip()
        self.reason = str(self.reason or "").strip()
        self.source_reference = str(self.source_reference or "").strip()
        if not self.description:
            raise ValidationError({"description": "La descripción del cobro es obligatoria."})
        if len(self.currency) != 3 or not self.currency.isalpha():
            raise ValidationError({
                "currency": "Use un código de moneda de tres letras, por ejemplo CLP."
            })
        if not self.reason:
            raise ValidationError({"reason": "El motivo del cobro es obligatorio."})
        if self.amount_original < 0:
            raise ValidationError({"amount_original": "El monto no puede ser negativo."})
        if self.exchange_rate <= 0:
            raise ValidationError({"exchange_rate": "El tipo de cambio debe ser positivo."})
        if self.currency == "CLP" and self.exchange_rate != 1:
            raise ValidationError({"exchange_rate": "Los cobros en CLP deben usar tipo de cambio 1."})
        if self.currency != "CLP" and (
            not self.exchange_rate_date or not self.exchange_rate_source
        ):
            raise ValidationError({
                "exchange_rate_date": "La moneda extranjera requiere fecha y fuente del tipo de cambio."
            })
        self.amount_clp = self.amount_original * self.exchange_rate

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
