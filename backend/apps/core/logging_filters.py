import logging

from apps.core.request_context import get_request_id


class RequestIdLogFilter(logging.Filter):
    """
    Agrega request_id a cada registro de log.

    Si el log ocurre fuera de una petición HTTP, se deja "-".
    """

    def filter(self, record):
        record.request_id = get_request_id() or "-"
        return True
