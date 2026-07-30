# Restringe las modificaciones de saldos por ubicación a los servicios que
# coordinan el stock distribuido. El total del producto y sus saldos físicos
# deben cambiar como una sola operación trazable, nunca mediante guardados sueltos.
from contextlib import contextmanager
from contextvars import ContextVar


_location_stock_write_allowed = ContextVar(
    "inventory_location_stock_write_allowed",
    default=False,
)


def is_location_stock_write_authorized():
    return _location_stock_write_allowed.get()


@contextmanager
def allow_location_stock_write():
    """Habilita temporalmente una escritura controlada de stock por ubicación."""

    token = _location_stock_write_allowed.set(True)
    try:
        yield
    finally:
        # La restauración garantiza que el permiso exista sólo durante el caso de
        # uso que mantiene sincronizados ubicación, stock total y trazabilidad.
        _location_stock_write_allowed.reset(token)
