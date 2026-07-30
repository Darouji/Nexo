# Impide que se creen movimientos Kardex aislados de la operación de stock que
# les da origen. Los servicios de dominio habilitan este contexto durante el
# tramo transaccional autorizado y los modelos rechazan escrituras externas.
from contextlib import contextmanager
from contextvars import ContextVar

_kardex_write_authorized = ContextVar(
    "kardex_write_authorized",
    default=False,
)


def is_kardex_write_authorized():
    return _kardex_write_authorized.get()


@contextmanager
def allow_kardex_write():
    """
    Autoriza temporalmente la creación de un movimiento Kardex.

    Solo los servicios internos deben usar este contexto. Así evitamos
    que MovimientoKardex.objects.create() genere movimientos aislados
    que no actualicen el stock del producto.
    """

    token = _kardex_write_authorized.set(True)

    try:
        yield
    finally:
        # ContextVar conserva el aislamiento entre ejecuciones; restaurar el token
        # impide que una autorización sobreviva fuera del bloque de servicio.
        _kardex_write_authorized.reset(token)
