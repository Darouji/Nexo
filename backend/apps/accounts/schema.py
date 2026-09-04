# Extensión de documentación OpenAPI para que clientes y herramientas externas
# conozcan el formato de autenticación realmente aceptado por la API.
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class ExpiringTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    """
    Documenta en OpenAPI el esquema de autenticación usado por NEXO ERP/CRM.

    El backend usa apps.accounts.authentication.ExpiringTokenAuthentication,
    que mantiene el formato estándar de DRF:

        Authorization: Token <token>

    pero agrega expiración de token.
    """

    target_class = "apps.accounts.authentication.ExpiringTokenAuthentication"
    name = "TokenAuth"

    def get_security_definition(self, auto_schema):
        # apiKey representa correctamente el encabezado completo `Authorization`
        # exigido por TokenAuthentication.
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Token de autenticación. Formato: Token <token>",
        }
