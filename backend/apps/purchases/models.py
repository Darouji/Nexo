from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel, BaseStatus


class PurchaseOrderStatus(models.TextChoices):
    BORRADOR = "BORRADOR", "Borrador"
    EN_REVISION = "EN_REVISION", "En revisión"
    APROBADA = "APROBADA", "Aprobada"
    EMITIDA = "EMITIDA", "Emitida"
    PARCIALMENTE_RECIBIDA = "PARCIALMENTE_RECIBIDA", "Parcialmente recibida"
    RECIBIDA = "RECIBIDA", "Recibida"
    CERRADA = "CERRADA", "Cerrada"
    CANCELADA = "CANCELADA", "Cancelada"


class PurchaseCurrency(models.TextChoices):
    CLP = "CLP", "Peso chileno"
    USD = "USD", "Dólar estadounidense"


class CostQuality(models.TextChoices):
    CONFIRMED = "CONFIRMED", "Confirmado"
    INCOMPLETE = "INCOMPLETE", "Incompleto"
    INFERRED = "INFERRED", "Inferido"
    CONFLICTING = "CONFLICTING", "Con información contradictoria"
    UNKNOWN = "UNKNOWN", "Desconocido"


class PurchaseOperationType(models.TextChoices):
    CREATE = "CREATE", "Crear"
    EDIT = "EDIT", "Editar"
    SUBMIT = "SUBMIT", "Enviar a revisión"
    APPROVE = "APPROVE", "Aprobar"
    ISSUE = "ISSUE", "Emitir"
    RECEIVE = "RECEIVE", "Recibir"
    CANCEL = "CANCEL", "Cancelar"
    COST = "COST", "Registrar costo"
    ALLOCATE = "ALLOCATE", "Asignar costo"
    CLOSE = "CLOSE", "Cerrar"


class LandedCostType(models.TextChoices):
    FREIGHT = "FREIGHT", "Flete"
    INSURANCE = "INSURANCE", "Seguro"
    CUSTOMS = "CUSTOMS", "Aduana"
    TAX = "TAX", "Impuesto"
    OTHER = "OTHER", "Otro"


class Supplier(BaseModel):
    legal_name = models.CharField(max_length=180, verbose_name="Razón social")
    trade_name = models.CharField(max_length=180, blank=True, verbose_name="Nombre comercial")
    tax_id = models.CharField(max_length=40, unique=True, verbose_name="Identidad tributaria")
    country = models.CharField(max_length=80, default="Chile", verbose_name="País")
    contact_name = models.CharField(max_length=160, blank=True, verbose_name="Contacto")
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=60, blank=True, verbose_name="Teléfono")
    payment_terms = models.CharField(max_length=255, blank=True, verbose_name="Condiciones de pago")
    notes = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        ordering = ["legal_name"]
        verbose_name = "Proveedor"
        verbose_name_plural = "Proveedores"
        indexes = [
            models.Index(fields=["legal_name", "status"]),
            models.Index(fields=["tax_id"]),
        ]

    def __str__(self):
        return self.trade_name or self.legal_name

    def clean(self):
        self.legal_name = str(self.legal_name or "").strip()
        self.trade_name = str(self.trade_name or "").strip()
        self.tax_id = str(self.tax_id or "").strip().upper()
        self.country = str(self.country or "").strip()
        self.contact_name = str(self.contact_name or "").strip()
        self.email = str(self.email or "").strip().lower()
        self.phone = str(self.phone or "").strip()
        self.payment_terms = str(self.payment_terms or "").strip()
        if not self.legal_name:
            raise ValidationError({"legal_name": "La razón social es obligatoria."})
        if not self.country:
            raise ValidationError({"country": "El país es obligatorio."})
        if not self.tax_id:
            raise ValidationError({"tax_id": "La identidad tributaria es obligatoria."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def get_audit_target_snapshot(self):
        return {
            "entity_label": "Proveedor",
            "display_name": str(self),
            "internal_id": self.pk,
            "identifiers": [
                {"key": "razon_social", "label": "Razón social", "value": self.legal_name},
                {"key": "identidad_tributaria", "label": "Identidad tributaria", "value": self.tax_id},
            ],
        }


class PurchaseOrder(BaseModel):
    number = models.CharField(max_length=60, unique=True, verbose_name="Número de orden")
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchase_orders", verbose_name="Proveedor"
    )
    order_date = models.DateField(verbose_name="Fecha de orden")
    expected_date = models.DateField(null=True, blank=True, verbose_name="Fecha esperada")
    currency = models.CharField(
        max_length=3, choices=PurchaseCurrency.choices, default=PurchaseCurrency.CLP, db_index=True
    )
    exchange_rate = models.DecimalField(
        max_digits=18, decimal_places=6, default=Decimal("1"), verbose_name="Tipo de cambio congelado"
    )
    exchange_rate_date = models.DateField(null=True, blank=True, verbose_name="Fecha del tipo de cambio")
    exchange_rate_source = models.CharField(max_length=160, blank=True, verbose_name="Fuente del tipo de cambio")
    state = models.CharField(
        max_length=30, choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.BORRADOR, db_index=True, verbose_name="Estado de la orden"
    )
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="responsible_purchase_orders", verbose_name="Responsable"
    )
    subtotal_original = models.DecimalField(max_digits=18, decimal_places=2, default=0, editable=False)
    tax_total_original = models.DecimalField(max_digits=18, decimal_places=2, default=0, editable=False)
    total_original = models.DecimalField(max_digits=18, decimal_places=2, default=0, editable=False)
    total_clp = models.DecimalField(max_digits=18, decimal_places=2, default=0, editable=False)
    cost_quality = models.CharField(
        max_length=20, choices=CostQuality.choices, default=CostQuality.UNKNOWN, db_index=True
    )
    notes = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        ordering = ["-order_date", "-id"]
        verbose_name = "Orden de compra"
        verbose_name_plural = "Órdenes de compra"
        indexes = [
            models.Index(fields=["state", "order_date"]),
            models.Index(fields=["supplier", "state"]),
            models.Index(fields=["responsible", "state"]),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(exchange_rate__gt=0), name="purchase_exchange_rate_positive"),
            models.CheckConstraint(condition=models.Q(subtotal_original__gte=0), name="purchase_subtotal_nonnegative"),
            models.CheckConstraint(condition=models.Q(tax_total_original__gte=0), name="purchase_tax_nonnegative"),
            models.CheckConstraint(condition=models.Q(total_original__gte=0), name="purchase_total_nonnegative"),
            models.CheckConstraint(condition=models.Q(total_clp__gte=0), name="purchase_total_clp_nonnegative"),
        ]

    def __str__(self):
        return f"{self.number} · {self.supplier}"

    def clean(self):
        self.number = str(self.number or "").strip().upper()
        self.exchange_rate_source = str(self.exchange_rate_source or "").strip()
        self.notes = str(self.notes or "").strip()
        if not self.number:
            raise ValidationError({"number": "El número de orden es obligatorio."})
        if self.exchange_rate <= 0:
            raise ValidationError({"exchange_rate": "El tipo de cambio debe ser mayor que cero."})
        if self.currency == PurchaseCurrency.CLP and self.exchange_rate != Decimal("1"):
            raise ValidationError({"exchange_rate": "Las órdenes en CLP deben usar tipo de cambio 1."})
        if self.currency != PurchaseCurrency.CLP and (
            not self.exchange_rate_date or not self.exchange_rate_source
        ):
            raise ValidationError({
                "exchange_rate_date": "La moneda extranjera requiere fecha y fuente del tipo de cambio."
            })
        if self.expected_date and self.expected_date < self.order_date:
            raise ValidationError({"expected_date": "La fecha esperada no puede ser anterior a la orden."})

    def get_audit_target_snapshot(self):
        return {
            "entity_label": "Orden de compra",
            "display_name": self.number,
            "internal_id": self.pk,
            "identifiers": [
                {"key": "numero", "label": "Número", "value": self.number},
                {"key": "proveedor", "label": "Proveedor", "value": str(self.supplier)},
                {"key": "estado", "label": "Estado", "value": self.get_state_display()},
            ],
        }


class PurchaseOrderLine(BaseModel):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="lines")
    product = models.ForeignKey(
        "inventory.Producto", on_delete=models.PROTECT, null=True, blank=True,
        related_name="purchase_order_lines", verbose_name="Producto"
    )
    controls_inventory_snapshot = models.BooleanField(
        default=False, editable=False, verbose_name="Controlaba inventario al crear la línea"
    )
    product_model_snapshot = models.CharField(max_length=150, verbose_name="Producto / modelo")
    product_sap_snapshot = models.CharField(max_length=100, blank=True, verbose_name="Código SAP")
    product_category_snapshot = models.CharField(max_length=150, blank=True, verbose_name="Categoría")
    description = models.CharField(max_length=255, blank=True, verbose_name="Descripción")
    quantity = models.PositiveIntegerField(verbose_name="Cantidad")
    unit_price_original = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="Precio unitario")
    tax_rate = models.DecimalField(max_digits=7, decimal_places=4, default=0, verbose_name="Tasa de impuesto")
    subtotal_original = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    tax_total_original = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    total_original = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    total_clp = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    destination_location = models.ForeignKey(
        "inventory.InventoryLocation", on_delete=models.PROTECT, null=True, blank=True,
        related_name="purchase_order_lines", verbose_name="Ubicación de destino"
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "Línea de orden de compra"
        verbose_name_plural = "Líneas de orden de compra"
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="purchase_line_quantity_positive"),
            models.CheckConstraint(condition=models.Q(unit_price_original__gte=0), name="purchase_line_price_nonnegative"),
            models.CheckConstraint(condition=models.Q(tax_rate__gte=0), name="purchase_line_tax_nonnegative"),
        ]

    @property
    def is_inventory_item(self):
        return self.product_id is not None

    def clean(self):
        self.product_model_snapshot = str(self.product_model_snapshot or "").strip()
        self.product_sap_snapshot = str(self.product_sap_snapshot or "").strip()
        self.product_category_snapshot = str(self.product_category_snapshot or "").strip()
        self.description = str(self.description or "").strip()
        if self.quantity <= 0:
            raise ValidationError({"quantity": "La cantidad debe ser un entero positivo."})
        if self.unit_price_original < 0 or self.tax_rate < 0:
            raise ValidationError({"unit_price_original": "Los valores monetarios no pueden ser negativos."})
        if (
            self.product_id
            and self.controls_inventory_snapshot
            and not self.destination_location_id
        ):
            raise ValidationError({"destination_location": "Un producto inventariable requiere ubicación de destino."})
        if not self.product_id and not self.description:
            raise ValidationError({"description": "Una línea no inventariable requiere descripción."})


class PurchaseReceiptCommitment(BaseModel):
    order_line = models.ForeignKey(
        PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_commitments"
    )
    pending_receipt = models.OneToOneField(
        "inventory.PendientePorRecibir", on_delete=models.PROTECT,
        related_name="purchase_commitment"
    )
    destination_location = models.ForeignKey(
        "inventory.InventoryLocation", on_delete=models.PROTECT,
        related_name="purchase_receipt_commitments"
    )
    committed_quantity = models.PositiveIntegerField()

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(committed_quantity__gt=0), name="purchase_commitment_positive"),
            models.UniqueConstraint(
                fields=["order_line", "destination_location"],
                name="purchase_commitment_unique_line_location",
            ),
        ]

    @property
    def received_quantity(self):
        return self.pending_receipt.cantidad_recibida

    @property
    def pending_quantity(self):
        return self.pending_receipt.cantidad_pendiente


class PurchaseOrderOperation(BaseModel):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="operations")
    operation_type = models.CharField(max_length=20, choices=PurchaseOperationType.choices, db_index=True)
    idempotency_key = models.CharField(max_length=100, unique=True, editable=False)
    previous_state = models.CharField(max_length=30, blank=True)
    new_state = models.CharField(max_length=30, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="purchase_order_operations"
    )

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Las operaciones de compra son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Las operaciones de compra no se eliminan.")


class LandedCost(BaseModel):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="landed_costs")
    cost_type = models.CharField(max_length=20, choices=LandedCostType.choices)
    description = models.CharField(max_length=255)
    amount_original = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, choices=PurchaseCurrency.choices)
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=6, default=Decimal("1"))
    exchange_rate_date = models.DateField(null=True, blank=True, verbose_name="Fecha del tipo de cambio")
    exchange_rate_source = models.CharField(max_length=160, blank=True, verbose_name="Fuente del tipo de cambio")
    amount_clp = models.DecimalField(max_digits=18, decimal_places=2, editable=False)
    quality = models.CharField(max_length=20, choices=CostQuality.choices, default=CostQuality.UNKNOWN)
    source_reference = models.CharField(max_length=160, blank=True)

    def clean(self):
        self.description = str(self.description or "").strip()
        self.exchange_rate_source = str(self.exchange_rate_source or "").strip()
        self.source_reference = str(self.source_reference or "").strip()
        if self.currency == PurchaseCurrency.CLP and self.exchange_rate != Decimal("1"):
            raise ValidationError({"exchange_rate": "Los costos en CLP deben usar tipo de cambio 1."})
        if self.currency != PurchaseCurrency.CLP and (
            not self.exchange_rate_date or not self.exchange_rate_source
        ):
            raise ValidationError({
                "exchange_rate_date": "La moneda extranjera requiere fecha y fuente del tipo de cambio."
            })


    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount_original__gte=0), name="landed_cost_amount_nonnegative"),
            models.CheckConstraint(condition=models.Q(exchange_rate__gt=0), name="landed_cost_rate_positive"),
        ]


class CostAllocation(BaseModel):
    landed_cost = models.ForeignKey(LandedCost, on_delete=models.PROTECT, related_name="allocations")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="cost_allocations")
    amount_clp = models.DecimalField(max_digits=18, decimal_places=2)
    quality = models.CharField(max_length=20, choices=CostQuality.choices, default=CostQuality.UNKNOWN)
    rationale = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount_clp__gte=0), name="cost_allocation_nonnegative"),
            models.UniqueConstraint(fields=["landed_cost", "order_line"], name="cost_allocation_unique_cost_line"),
        ]
