# Política común de paginación para las listas de la API. El cliente puede
# solicitar un tamaño menor o mayor, pero el límite evita respuestas excesivas
# y mantiene predecible el costo de consultas, serialización y transferencia.
from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 100
