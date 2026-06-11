from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import AuditOrigin, BaseModel
from apps.core.utils import normalize_text


class KardexMovementType(models.TextChoices):
    ENTRADA_IMPORTACION = "ENTRADA_IMPORTACION", "Entrada por importación"
    ENTRADA_MANUAL = "ENTRADA_MANUAL", "Entrada manual"
    SALIDA_VENTA = "SALIDA_VENTA", "Salida por venta"
    REVERSA_ANULACION = "REVERSA_ANULACION", "Reversa por anulación"
    AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO", "Ajuste de inventario"


class Categoria(BaseModel):
    name = models.CharField(max_length=150, verbose_name="Categoría")
    name_normalized = models.CharField(
        max_length=150,
        blank=True,
        db_index=True,
        verbose_name="Categoría normalizada",
    )
    description = models.TextField(blank=True, verbose_name="Descripción")

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_categoria_name_normalized",
            )
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        if not self.name or not self.name.strip():
            raise ValidationError({"name": "El nombre de la categoría es obligatorio."})

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        self.full_clean()
        super().save(*args, **kwargs)


class Producto(BaseModel):
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="productos",
        verbose_name="Categoría",
    )
    modelo = models.CharField(max_length=150, verbose_name="Modelo")
    modelo_normalized = models.CharField(
        max_length=150,
        blank=True,
        db_index=True,
        verbose_name="Modelo normalizado",
    )
    detalle = models.TextField(blank=True, verbose_name="Detalle")

    codigo_sap = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Código SAP",
    )
    codigo_sap_normalized = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        verbose_name="Código SAP normalizado",
    )

    stock_actual = models.IntegerField(
        default=0,
        editable=False,
        verbose_name="Stock actual",
    )
    stock_critico = models.PositiveIntegerField(
        default=0,
        verbose_name="Stock crítico",
    )
    en_camino = models.PositiveIntegerField(
        default=0,
        verbose_name="En camino",
    )
    controla_stock = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Controla stock",
    )

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["categoria__name", "modelo"]
        indexes = [
            models.Index(fields=["categoria", "status"]),
            models.Index(fields=["modelo_normalized"]),
            models.Index(fields=["codigo_sap_normalized"]),
            models.Index(fields=["controla_stock", "stock_actual"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["categoria", "modelo_normalized"],
                condition=~models.Q(modelo_normalized=""),
                name="unique_producto_modelo_normalized_by_categoria",
            ),
            models.UniqueConstraint(
                fields=["codigo_sap_normalized"],
                condition=~models.Q(codigo_sap_normalized=""),
                name="unique_producto_codigo_sap_normalized",
            ),
        ]

    def __str__(self):
        return f"{self.categoria.name} - {self.modelo}"

    @property
    def stock(self):
        """
        Alias de compatibilidad de lectura.

        No debe usarse para modificar stock.
        El valor real controlado por Kardex es stock_actual.
        """
        return self.stock_actual

    @property
    def is_stock_critical(self):
        if not self.controla_stock:
            return False

        return self.stock_actual <= self.stock_critico

    def clean(self):
        super().clean()

        if not self.categoria_id:
            raise ValidationError({"categoria": "El producto debe tener una categoría."})

        if not self.modelo or not self.modelo.strip():
            raise ValidationError({"modelo": "El modelo del producto es obligatorio."})

        if self.stock_actual < 0:
            raise ValidationError(
                {"stock_actual": "El stock actual no puede ser negativo."}
            )

    def save(self, *args, **kwargs):
        self.modelo_normalized = normalize_text(self.modelo)
        self.codigo_sap_normalized = normalize_text(self.codigo_sap)
        self.full_clean()
        super().save(*args, **kwargs)


class MovimientoKardex(BaseModel):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="kardex",
        verbose_name="Producto",
    )
    movement_type = models.CharField(
        max_length=40,
        choices=KardexMovementType.choices,
        db_index=True,
        verbose_name="Tipo de movimiento",
    )
    origin = models.CharField(
        max_length=30,
        choices=AuditOrigin.choices,
        default=AuditOrigin.MANUAL,
        db_index=True,
        verbose_name="Origen",
    )

    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kardex_movements",
        verbose_name="Operador",
    )

    cantidad = models.IntegerField(
        verbose_name="Cantidad del movimiento",
        help_text="Entradas y reversas usan cantidad positiva. Salidas usan cantidad negativa.",
    )
    stock_antes = models.IntegerField(verbose_name="Stock antes")
    stock_despues = models.IntegerField(verbose_name="Stock después")

    motivo = models.CharField(max_length=255, verbose_name="Motivo")

    reference_content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Tipo de referencia",
    )
    reference_object_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="ID de referencia",
    )
    reference_object = GenericForeignKey(
        "reference_content_type",
        "reference_object_id",
    )
    reference_repr = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Referencia legible",
    )

    class Meta:
        verbose_name = "Movimiento de Kardex"
        verbose_name_plural = "Movimientos de Kardex"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["producto", "created_at"]),
            models.Index(fields=["movement_type", "created_at"]),
            models.Index(fields=["origin", "created_at"]),
            models.Index(fields=["reference_content_type", "reference_object_id"]),
        ]

    def __str__(self):
        return f"{self.producto.modelo} | {self.movement_type} | {self.cantidad}"

    def clean(self):
        super().clean()

        if not self.producto_id:
            raise ValidationError({"producto": "El movimiento debe tener un producto."})

        if self.producto and not self.producto.controla_stock:
            raise ValidationError(
                {
                    "producto": "No se puede crear movimiento Kardex para un producto que no controla stock."
                }
            )

        if self.cantidad == 0:
            raise ValidationError({"cantidad": "La cantidad del movimiento no puede ser cero."})

        if not self.motivo or not self.motivo.strip():
            raise ValidationError({"motivo": "El motivo del movimiento es obligatorio."})

        positive_types = [
            KardexMovementType.ENTRADA_IMPORTACION,
            KardexMovementType.ENTRADA_MANUAL,
            KardexMovementType.REVERSA_ANULACION,
        ]

        if self.movement_type in positive_types and self.cantidad <= 0:
            raise ValidationError(
                {
                    "cantidad": "Este tipo de movimiento debe tener cantidad positiva."
                }
            )

        if self.movement_type == KardexMovementType.SALIDA_VENTA and self.cantidad >= 0:
            raise ValidationError(
                {
                    "cantidad": "La salida por venta debe tener cantidad negativa."
                }
            )

        if self.stock_despues < 0:
            raise ValidationError(
                {"stock_despues": "El movimiento no puede dejar stock negativo."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)