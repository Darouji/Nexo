import re
import unicodedata


LEGAL_ENTITY_STOPWORDS = {
    "ltda",
    "limitada",
    "spa",
    "sa",
    "s",
    "a",
    "compania",
    "cia",
    "minera",
}


def remove_accents(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    return "".join(char for char in value if not unicodedata.combining(char))


def normalize_text(value) -> str:
    """
    Normaliza texto para comparación, búsqueda y detección de duplicados.

    No reemplaza el nombre visible oficial.
    Solo genera una versión comparable.
    """
    if not value:
        return ""

    value = str(value).strip().lower()
    value = remove_accents(value)
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()

    words = [
        word
        for word in value.split()
        if word not in LEGAL_ENTITY_STOPWORDS
    ]

    return " ".join(words).strip()


def normalize_rut(value) -> str:
    if not value:
        return ""

    value = str(value).strip().upper()
    value = value.replace(".", "").replace("-", "").replace(" ", "")

    return value


def normalize_email(value) -> str:
    if not value:
        return ""

    return str(value).strip().lower()


def normalize_phone(value) -> str:
    if not value:
        return ""

    value = str(value).strip()
    value = re.sub(r"[^\d+]", "", value)

    if value.count("+") > 1:
        value = value.replace("+", "")

    if "+" in value and not value.startswith("+"):
        value = value.replace("+", "")

    return value