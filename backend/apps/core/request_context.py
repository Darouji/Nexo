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

    if token is not None:
        _request_id_var.reset(token)
