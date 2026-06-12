from rest_framework.response import Response
from rest_framework.views import exception_handler


def get_error_code(exc, response):
    """
    Obtiene un código técnico estable para frontend/logs.
    """

    if hasattr(exc, "default_code"):
        return str(exc.default_code)

    if response is not None and response.status_code:
        return f"http_{response.status_code}"

    return "server_error"


def get_error_message(exc, response):
    """
    Obtiene un mensaje principal legible.
    """

    if response is None:
        return "Error interno del servidor."

    data = response.data

    if isinstance(data, dict):
        detail = data.get("detail")

        if detail:
            return str(detail)

        if response.status_code == 400:
            return "Hay errores de validación."

        if response.status_code == 401:
            return "No autenticado."

        if response.status_code == 403:
            return "No tiene permisos para realizar esta acción."

        if response.status_code == 404:
            return "Recurso no encontrado."

    if isinstance(data, list) and data:
        return str(data[0])

    return "Ocurrió un error al procesar la solicitud."


def custom_exception_handler(exc, context):
    """
    Respuesta uniforme de errores para toda la API.

    Mantiene los detalles originales en error.details,
    pero agrega una estructura estable y el request_id.
    """

    response = exception_handler(exc, context)
    request = context.get("request")

    request_id = ""

    if request is not None:
        request_id = getattr(request, "request_id", "")

    if response is None:
        return response

    original_data = response.data

    response.data = {
        "success": False,
        "error": {
            "code": get_error_code(exc, response),
            "message": get_error_message(exc, response),
            "details": original_data,
        },
        "request_id": request_id,
    }

    return response


def api_error_response(
    *,
    message,
    status_code,
    code=None,
    details=None,
    request=None,
):
    """
    Respuesta uniforme para errores controlados manualmente.

    Se usa cuando una vista decide devolver error sin lanzar excepción.
    Ejemplo:
    - login inválido
    - credenciales faltantes
    - usuario inactivo
    """

    request_id = ""

    if request is not None:
        request_id = getattr(request, "request_id", "")

    if code is None:
        code = f"http_{status_code}"

    if details is None:
        details = {"detail": message}

    return Response(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details,
            },
            "request_id": request_id,
        },
        status=status_code,
    )
