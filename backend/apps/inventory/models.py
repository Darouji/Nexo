from django.db import models
from django.conf import settings

class Categoria(models.Model):
    name = models.CharField(max_length=150, unique=True, verbose_name="Categoría")
    is_active = models.BooleanField(default=True, verbose_name="Activa")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        ordering = ["name"]

    def __str__(self):
        return self.name

class ProductoStatus(models.TextChoices):
    EN_USO = "EN_USO", "En Uso"
    DESCONTINUADO = "DESCONTINUADO", "Descontinuado"
    EN_REPOSICION = "EN_REPOSICION", "En Reposición"

class Producto(models.Model):
    categoria = models.ForeignKey(
        Categoria, 
        on_delete=models.PROTECT, 
        related_name="productos", 
        verbose_name="Categoría"
    )
    modelo = models.CharField(max_length=150, unique=True, verbose_name="Modelo")
    detalle = models.TextField(blank=True, verbose_name="Detalle")
    ficha = models.FileField(
        upload_to="documentos/fichas/", 
        blank=True, 
        null=True, 
        verbose_name="Ficha (PDF)"
    )
    stock = models.IntegerField(default=0, verbose_name="Stock")
    en_camino = models.IntegerField(default=0, verbose_name="En Camino")
    status = models.CharField(
        max_length=30, 
        choices=ProductoStatus.choices, 
        default=ProductoStatus.EN_USO, 
        verbose_name="Estado"
    )
    is_active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["categoria__name", "modelo"]

    def __str__(self):
        return f"{self.categoria.name} - {self.modelo}"

class MovimientoKardex(models.Model):
    producto = models.ForeignKey(
        Producto, 
        on_delete=models.PROTECT, 
        related_name="kardex", 
        verbose_name="Producto"
    )
    fecha = models.DateTimeField(auto_now_add=True, verbose_name="Fecha")
    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        verbose_name="Operador"
    )
    cantidad = models.IntegerField(verbose_name="Movimiento (+/-)")
    motivo = models.CharField(max_length=255, verbose_name="Motivo")
    stock_restante = models.IntegerField(verbose_name="Stock Restante")
    
    # Se agrega para cumplir el "Soft Delete" en caso de anular una venta
    is_active = models.BooleanField(default=True, verbose_name="Válido")

    class Meta:
        verbose_name = "Movimiento de Kardex"
        verbose_name_plural = "Movimientos de Kardex"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.producto.modelo} | {self.cantidad} | {self.fecha.strftime('%Y-%m-%d %H:%M')}"