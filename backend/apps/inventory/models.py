from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import AuditOrigin, BaseModel, BaseStatus
from apps.core.utils import normalize_text


class KardexMovementType(models.TextChoices):
    ENTRADA_IMPORTACION = "ENTRADA_IMPORTACION", "Entrada por importación"
    ENTRADA_MANUAL = "ENTRADA_MANUAL", "Entrada manual"
    ENTRADA_RECEPCION = "ENTRADA_RECEPCION", "Entrada por recepción"
    SALIDA_VENTA = "SALIDA_VENTA", "Salida por venta"
    REVERSA_ANULACION = "REVERSA_ANULACION", "Reversa por anulación"
    AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO", "Ajuste de inventario"


class ProductStockStatus(models.TextChoices):
    STOCK_CORRECTO = "STOCK_CORRECTO", "Stock correcto"
    BAJO_MINIMO = "BAJO_MINIMO", "Bajo mínimo"
    SIN_STOCK = "SIN_STOCK", "Sin stock"
    NO_CONTROLA_STOCK = "NO_CONTROLA_STOCK", "No controla stock"


class PendientePorRecibirStatus(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente"
    PARCIAL = "PARCIAL", "Parcial"
    RECIBIDA = "RECIBIDA", "Recibida"
    CANCELADA = "CANCELADA", "Cancelada"
    CERRADA_PARCIAL = "CERRADA_PARCIAL", "Cerrada parcial"


ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS = (
    PendientePorRecibirStatus.PENDIENTE,
    PendientePorRecibirStatus.PARCIAL,
)


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

        if self.pk and self.status in [
            BaseStatus.INACTIVO,
            BaseStatus.ARCHIVADO,
        ]:
            has_operational_products = self.productos.filter(
                status=BaseStatus.ACTIVO,
            ).exists()

            if has_operational_products:
                raise ValidationError(
                    {
                        "status": (
                            "No se puede inactivar ni archivar una categoría que "
                            "contiene productos activos o descontinuados."
                        )
                    }
                )

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
        verbose_name="Stock mínimo",
    )
    controla_stock = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name="Maneja inventario",
    )
    descontinuado = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Descontinuado",
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
            models.Index(fields=["descontinuado", "status"]),
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
        return self.stock_actual

    @property
    def stock_status(self):
        if not self.controla_stock:
            return ProductStockStatus.NO_CONTROLA_STOCK

        if self.stock_actual == 0:
            return ProductStockStatus.SIN_STOCK

        if self.stock_actual <= self.stock_critico:
            return ProductStockStatus.BAJO_MINIMO

        return ProductStockStatus.STOCK_CORRECTO

    @property
    def is_stock_critical(self):
        return self.stock_status in [
            ProductStockStatus.BAJO_MINIMO,
            ProductStockStatus.SIN_STOCK,
        ]

    @property
    def estado_producto(self):
        if self.descontinuado:
            return "DESCONTINUADO"

        return self.status

    @property
    def estado_producto_display(self):
        if self.descontinuado:
            return "Descontinuado"

        return self.get_status_display()

    def clean(self):
        super().clean()

        if not self.categoria_id:
            raise ValidationError(
                {"categoria": "El producto debe tener una categoría."}
            )

        current_category_id = None

        if self.pk:
            current_category_id = (
                Producto.objects.filter(pk=self.pk)
                .values_list("categoria_id", flat=True)
                .first()
            )

        is_new_product = current_category_id is None
        category_changed = current_category_id != self.categoria_id

        if (is_new_product or category_changed) and (
            self.categoria.status != BaseStatus.ACTIVO
        ):
            raise ValidationError(
                {
                    "categoria": (
                        "Solo se puede crear o reasignar un producto a una "
                        "categoría activa."
                    )
                }
            )

        if not self.modelo or not self.modelo.strip():
            raise ValidationError({"modelo": "El modelo del producto es obligatorio."})

        if self.stock_actual < 0:
            raise ValidationError(
                {"stock_actual": "El stock actual no puede ser negativo."}
            )

        if self.status == BaseStatus.ANULADO:
            raise ValidationError(
                {
                    "status": (
                        "Un producto no puede quedar anulado. "
                        "Use Activo, Inactivo, Descontinuado o Archivado."
                    )
                }
            )

        if self.descontinuado and self.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "descontinuado": (
                        "Un producto descontinuado debe conservar estado base Activo "
                        "para evitar estados contradictorios."
                    )
                }
            )

        if self.pk:
            has_open_pending_receipts = PendientePorRecibir.objects.filter(
                producto_id=self.pk,
                estado__in=ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
            ).exists()

            if self.status in [BaseStatus.INACTIVO, BaseStatus.ARCHIVADO] and (
                self.stock_actual != 0 or has_open_pending_receipts
            ):
                raise ValidationError(
                    {
                        "status": (
                            "No se puede inactivar ni archivar un producto que "
                            "tiene stock físico o unidades pendientes por recibir."
                        )
                    }
                )

            original = (
                Producto.objects.filter(pk=self.pk)
                .values("controla_stock", "stock_actual")
                .first()
            )

            if original and original["controla_stock"] and not self.controla_stock:
                has_kardex = MovimientoKardex.objects.filter(
                    producto_id=self.pk
                ).exists()

                if (
                    original["stock_actual"] != 0
                    or has_kardex
                    or has_open_pending_receipts
                ):
                    raise ValidationError(
                        {
                            "controla_stock": (
                                "No se puede desactivar el manejo de inventario si "
                                "el producto tiene stock físico, movimientos Kardex "
                                "o unidades pendientes por recibir."
                            )
                        }
                    )

    def save(self, *args, **kwargs):
        self.modelo_normalized = normalize_text(self.modelo)
        self.codigo_sap_normalized = normalize_text(self.codigo_sap)
        self.full_clean()
        super().save(*args, **kwargs)


class PendientePorRecibir(BaseModel):
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="pendientes_por_recibir",
        verbose_name="Producto",
    )
    cantidad_original = models.PositiveIntegerField(
        verbose_name="Cantidad original",
    )
    cantidad_recibida = models.PositiveIntegerField(
        default=0,
        editable=False,
        verbose_name="Cantidad recibida",
    )
    cantidad_cancelada = models.PositiveIntegerField(
        default=0,
        editable=False,
        verbose_name="Cantidad cancelada",
    )
    estado = models.CharField(
        max_length=30,
        choices=PendientePorRecibirStatus.choices,
        default=PendientePorRecibirStatus.PENDIENTE,
        db_index=True,
        verbose_name="Estado de recepción",
    )
    referencia = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Referencia",
    )
    motivo = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Motivo de registro",
    )

    class Meta:
        verbose_name = "Pendiente por recibir"
        verbose_name_plural = "Pendientes por recibir"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["producto", "estado"]),
            models.Index(fields=["estado", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    cantidad_recibida__lte=(
                        models.F("cantidad_original") - models.F("cantidad_cancelada")
                    )
                ),
                name="pending_receipt_quantities_do_not_exceed_original",
            )
        ]

    def __str__(self):
        return (
            f"{self.producto.modelo} | Por recibir: "
            f"{self.cantidad_pendiente}/{self.cantidad_original}"
        )

    @property
    def cantidad_pendiente(self):
        return self.cantidad_original - self.cantidad_recibida - self.cantidad_cancelada

    def calcular_estado(self):
        if self.cantidad_pendiente > 0:
            if self.cantidad_recibida == 0 and self.cantidad_cancelada == 0:
                return PendientePorRecibirStatus.PENDIENTE

            return PendientePorRecibirStatus.PARCIAL

        if self.cantidad_recibida == self.cantidad_original:
            return PendientePorRecibirStatus.RECIBIDA

        if self.cantidad_cancelada == self.cantidad_original:
            return PendientePorRecibirStatus.CANCELADA

        return PendientePorRecibirStatus.CERRADA_PARCIAL

    def clean(self):
        super().clean()

        if not self.producto_id:
            raise ValidationError({"producto": "El producto es obligatorio."})

        if self.producto_id and not self.producto.controla_stock:
            raise ValidationError(
                {
                    "producto": (
                        "No se puede registrar una recepción pendiente para un producto "
                        "que no maneja inventario."
                    )
                }
            )

        if self.cantidad_original <= 0:
            raise ValidationError(
                {"cantidad_original": ("La cantidad original debe ser positiva.")}
            )

        if self.cantidad_recibida + self.cantidad_cancelada > self.cantidad_original:
            raise ValidationError(
                {
                    "cantidad_recibida": (
                        "La suma de la cantidad recibida y cancelada no puede superar "
                        "la cantidad original."
                    )
                }
            )

        if not self.motivo.strip() and not self.referencia.strip():
            raise ValidationError(
                {
                    "motivo": (
                        "Debe indicar un motivo o una referencia para registrar "
                        "un pendiente por recibir."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.estado = self.calcular_estado()
        self.full_clean()

        update_fields = kwargs.get("update_fields")

        if update_fields is not None:
            kwargs["update_fields"] = list(set(update_fields) | {"estado"})

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

    producto_modelo_snapshot = models.CharField(
        max_length=150,
        blank=True,
        default="",
        editable=False,
        verbose_name="Modelo del producto al registrar",
    )
    producto_categoria_snapshot = models.CharField(
        max_length=150,
        blank=True,
        default="",
        editable=False,
        verbose_name="Categoría del producto al registrar",
    )
    producto_codigo_sap_snapshot = models.CharField(
        max_length=100,
        blank=True,
        default="",
        editable=False,
        verbose_name="Código SAP del producto al registrar",
    )

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
        producto_modelo = self.producto_modelo_snapshot or self.producto.modelo

        return f"{producto_modelo} | {self.movement_type} | {self.cantidad}"

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
            raise ValidationError(
                {"cantidad": "La cantidad del movimiento no puede ser cero."}
            )

        if not self.motivo or not self.motivo.strip():
            raise ValidationError(
                {"motivo": "El motivo del movimiento es obligatorio."}
            )

        positive_types = [
            KardexMovementType.ENTRADA_IMPORTACION,
            KardexMovementType.ENTRADA_MANUAL,
            KardexMovementType.ENTRADA_RECEPCION,
            KardexMovementType.REVERSA_ANULACION,
        ]

        if self.movement_type in positive_types and self.cantidad <= 0:
            raise ValidationError(
                {"cantidad": "Este tipo de movimiento debe tener cantidad positiva."}
            )

        if self.movement_type == KardexMovementType.SALIDA_VENTA and self.cantidad >= 0:
            raise ValidationError(
                {"cantidad": "La salida por venta debe tener cantidad negativa."}
            )

        if self.stock_despues < 0:
            raise ValidationError(
                {"stock_despues": "El movimiento no puede dejar stock negativo."}
            )

    def save(self, *args, **kwargs):
        if self._state.adding and self.producto_id:
            producto = self.producto

            if not self.producto_modelo_snapshot:
                self.producto_modelo_snapshot = producto.modelo

            if not self.producto_categoria_snapshot:
                self.producto_categoria_snapshot = producto.categoria.name

            if not self.producto_codigo_sap_snapshot:
                self.producto_codigo_sap_snapshot = producto.codigo_sap

        self.full_clean()
        super().save(*args, **kwargs)
