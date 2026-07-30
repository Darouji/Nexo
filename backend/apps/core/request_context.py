# Contexto de ejecución para propagar el identificador de una solicitud sin
# acoplar cada servicio o logger al objeto HTTP de Django.
from contextvars import ContextVar

_request_id_var = ContextVar("request_id", default="")


def set_request_id(request_id):
    """
    Guarda el request_id actual en contexto local de ejecución.

    Esto permite que el sistema de logging pueda incluirlo
    sin tener que pasarlo manualmente a cada logger.
    """

    return _request_id_var.set(request_id or "")


def get_request_id():
    """
    Obtiene el request_id actual.
    """

    return _request_id_var.get("")


def reset_request_id(token):
    """
    Restaura el contexto anterior.
    """

    # Restaurar el token evita que el identificador de una solicitud se filtre a
    # otra ejecución atendida posteriormente por el mismo proceso.
    if token is not None:
        _request_id_var.reset(token)
