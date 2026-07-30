# Protege la fuente de verdad del stock frente a escrituras directas al modelo.
# Los servicios de dominio habilitan este contexto únicamente mientras registran
# el movimiento Kardex y actualizan la existencia dentro de la misma operación.
from contextlib import contextmanager
from contextvars import ContextVar

_stock_write_authorized = ContextVar(
    "stock_write_authorized",
    default=False,
)


def is_stock_write_authorized():
    return _stock_write_authorized.get()


@contextmanager
def allow_stock_write():
    """
    Autoriza temporalmente un cambio persistente de Producto.stock_actual.

    Solo los servicios oficiales de Kardex deben usar este contexto.
    """

    token = _stock_write_authorized.set(True)

    try:
        yield
    finally:
        # Restablecer el token original evita que la autorización se propague a
        # operaciones posteriores del mismo hilo o contexto asíncrono.
        _stock_write_authorized.reset(token)
