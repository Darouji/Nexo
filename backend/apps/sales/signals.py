from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Venta, DetalleVenta
from apps.inventory.models import MovimientoKardex

# 1. Cuando se agrega un producto a una venta (Descuento de Stock)
@receiver(post_save, sender=DetalleVenta)
def descontar_stock_y_registrar_kardex(sender, instance, created, **kwargs):
    if created:
        producto = instance.producto
        cantidad = instance.cantidad
        venta = instance.venta

        # Descontar el stock real del producto
        producto.stock -= cantidad
        producto.save()

        # Generar el registro inmutable en el Kardex
        MovimientoKardex.objects.create(
            producto=producto,
            operador=venta.operador,
            cantidad=-cantidad,  # Negativo porque sale
            motivo=f"Venta generada (Factura/Doc: {venta.id})",
            stock_restante=producto.stock
        )

# 2. Cuando un usuario anula una venta completa (Soft Delete - Reposición)
@receiver(pre_save, sender=Venta)
def anular_venta_reponer_stock(sender, instance, **kwargs):
    if instance.id:
        old_instance = Venta.objects.get(id=instance.id)
        # Detectar si la venta pasó de Activa a Inactiva (Anulación)
        if old_instance.is_active and not instance.is_active:
            for detalle in instance.detalles.all():
                producto = detalle.producto
                cantidad = detalle.cantidad
                
                # Devolver el stock a bodega
                producto.stock += cantidad
                producto.save()
                
                # Generar el registro de devolución en el Kardex
                MovimientoKardex.objects.create(
                    producto=producto,
                    operador=instance.operador,
                    cantidad=cantidad, # Positivo porque vuelve a entrar
                    motivo=f"Anulación de Venta (Doc: {instance.id}) - Devolución",
                    stock_restante=producto.stock
                )