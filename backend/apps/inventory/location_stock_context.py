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
    token = _location_stock_write_allowed.set(True)
    try:
        yield
    finally:
        _location_stock_write_allowed.reset(token)
