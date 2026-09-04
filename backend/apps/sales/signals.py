"""
Signals de ventas desactivados intencionalmente.

NEXO ERP/CRM ya no modifica stock mediante signals automáticos de Django.

Regla actual:
- Crear venta con detalles se hace desde apps.sales.services.create_sale_with_details().
- El descuento de stock se hace mediante apps.inventory.services.register_sale_exit().
- La anulación se hace mediante apps.sales.services.annul_sale().
- La reversa de stock se hace mediante apps.inventory.services.register_sale_annulment_reverse().

Motivo:
Los signals antiguos podían descontar stock fuera del flujo transaccional principal,
duplicar movimientos Kardex o saltarse validaciones de negocio.
"""