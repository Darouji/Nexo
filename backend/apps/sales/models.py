from django.db import models
from django.conf import settings
from apps.commercial.models import Minera, Area, Subarea, Contacto
from apps.inventory.models import Producto
from apps.core.models import BaseModel


class TipoDocumento(models.TextChoices):
    GUIA_DESPACHO = "GUIA_DESPACHO", "Guía de Despacho"
    HES = "HES", "HES"
    OTRO = "OTRO", "Otro"

class Venta(BaseModel):
    # Operador que realiza la venta
    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        related_name="ventas_registradas", 
        verbose_name="Operador (Usuario)"
    )

    # Documentos
    factura_pdf = models.FileField(upload_to="documentos/facturas/", blank=True, null=True, verbose_name="Factura PDF")
    fecha_factura = models.DateField(verbose_name="Fecha Factura")
    orden_compra = models.CharField(max_length=100, blank=True, verbose_name="Orden de Compra")
    
    # Relaciones Comerciales (Módulo Commercial)
    minera = models.ForeignKey(Minera, on_delete=models.PROTECT, related_name="ventas", verbose_name="Minera")
    area = models.ForeignKey(Area, on_delete=models.PROTECT, null=True, blank=True, related_name="ventas", verbose_name="Área")
    subarea = models.ForeignKey(Subarea, on_delete=models.PROTECT, null=True, blank=True, related_name="ventas", verbose_name="Subárea")
    contacto = models.ForeignKey(Contacto, on_delete=models.PROTECT, null=True, blank=True, related_name="ventas", verbose_name="Contacto")

    # Totales Contables
    valor_neto = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Valor Neto")
    iva = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="IVA (19%)")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="TOTAL")

    # Guía de Despacho / HES
    tipo_documento = models.CharField(
        max_length=50, 
        choices=TipoDocumento.choices, 
        default=TipoDocumento.GUIA_DESPACHO, 
        verbose_name="Tipo Documento"
    )
    guia_pdf = models.FileField(upload_to="documentos/guias/", blank=True, null=True, verbose_name="Guía/HES PDF")

    # Soft Delete (Anular en lugar de borrar)
    is_active = models.BooleanField(default=True, verbose_name="Activa")

    class Meta:
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"
        ordering = ["-fecha_factura"]

    def __str__(self):
        return f"Venta {self.id} - {self.minera.name} ({self.fecha_factura})"


class DetalleVenta(BaseModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="detalles", verbose_name="Venta")
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, related_name="ventas_detalle", verbose_name="Producto")
    
    cantidad = models.PositiveIntegerField(verbose_name="Cantidad")
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Valor Unitario")
    codigo_sap = models.CharField(max_length=100, blank=True, verbose_name="Cód. Interno (SAP)")

    class Meta:
        verbose_name = "Detalle de Venta"
        verbose_name_plural = "Detalles de Venta"

    def __str__(self):
        return f"{self.cantidad} x {self.producto.modelo} (Venta {self.venta.id})"