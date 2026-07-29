import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    value = os.getenv(name)

    if value is None:
        return default

    return str(value).strip().lower() in ["1", "true", "yes", "y", "si", "sí", "on"]


def env_list(name, default=None):
    value = os.getenv(name)

    if value is None or not value.strip():
        return default or []

    return [item.strip() for item in value.split(",") if item.strip()]


def env_int(name, default):
    value = os.getenv(name)

    if value is None or value == "":
        return default

    try:
        return int(value)
    except ValueError:
        raise ImproperlyConfigured(f"{name} debe ser un número entero.")


DEBUG = env_bool("DJANGO_DEBUG", default=True)

DEV_FALLBACK_SECRET_KEY = (
    "django-insecure-serkan-v2-local-dev-only-change-in-production"
)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", DEV_FALLBACK_SECRET_KEY)

if not DEBUG and SECRET_KEY == DEV_FALLBACK_SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY es obligatorio cuando DJANGO_DEBUG=False."
    )


ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "testserver"] if DEBUG else [],
)

if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "DJANGO_ALLOWED_HOSTS es obligatorio cuando DJANGO_DEBUG=False."
    )


INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "drf_spectacular",
    "drf_spectacular_sidecar",
    # Local apps
    "apps.core",
    "apps.accounts.apps.AccountsConfig",
    "apps.collaborators",
    "apps.commercial",
    "apps.inventory",
    "apps.purchases.apps.PurchasesConfig",
    "apps.sales",
    "apps.documents.apps.DocumentsConfig",
    "apps.imports.apps.ImportsConfig",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.ActivityLogMiddleware",
]


ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"


DB_ENGINE = os.getenv("DB_ENGINE", "sqlite").strip().lower()

if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "serkan_v2"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "CONN_MAX_AGE": env_int("DB_CONN_MAX_AGE", 60),
        }
    }
else:
    sqlite_name = os.getenv("DB_NAME", "db.sqlite3")

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / sqlite_name,
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


LANGUAGE_CODE = os.getenv("DJANGO_LANGUAGE_CODE", "es-cl")
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "America/Santiago")

USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"


DRF_TOKEN_EXPIRE_HOURS = env_int("DRF_TOKEN_EXPIRE_HOURS", 12)
ENABLE_API_DOCS = env_bool("DJANGO_ENABLE_API_DOCS", default=DEBUG)


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ExpiringTokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": env_int("DRF_PAGE_SIZE", 50),
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("DRF_ANON_THROTTLE_RATE", "100/hour"),
        "user": os.getenv("DRF_USER_THROTTLE_RATE", "1000/hour"),
    },
}


CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    # Vite puede abrirse tanto con localhost como con 127.0.0.1.
    # Ambos son orígenes distintos para los navegadores.
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=CORS_ALLOWED_ORIGINS,
)


SESSION_COOKIE_SECURE = env_bool("DJANGO_SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env_bool("DJANGO_CSRF_COOKIE_SECURE", default=not DEBUG)

SECURE_SSL_REDIRECT = env_bool(
    "DJANGO_SECURE_SSL_REDIRECT", default=False if DEBUG else True
)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_HSTS_SECONDS = env_int(
    "DJANGO_SECURE_HSTS_SECONDS",
    0 if DEBUG else 31536000,
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    default=not DEBUG,
)
SECURE_HSTS_PRELOAD = env_bool(
    "DJANGO_SECURE_HSTS_PRELOAD",
    default=False,
)

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
REFERRER_POLICY = "same-origin"


DATA_UPLOAD_MAX_MEMORY_SIZE = env_int(
    "DJANGO_DATA_UPLOAD_MAX_MEMORY_SIZE",
    30 * 1024 * 1024,
)
FILE_UPLOAD_MAX_MEMORY_SIZE = env_int(
    "DJANGO_FILE_UPLOAD_MAX_MEMORY_SIZE",
    30 * 1024 * 1024,
)


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {
            "()": "apps.core.logging_filters.RequestIdLogFilter",
        },
    },
    "formatters": {
        "simple": {
            "format": "[{levelname}] {asctime} {name} [request_id={request_id}]: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "filters": ["request_id"],
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django.server": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SERKAN V2 API",
    "DESCRIPTION": (
        "API interna de SERKAN V2. "
        "Django REST Framework es la fuente de verdad para autenticación, "
        "permisos, validaciones, auditoría, trazabilidad, inventario, ventas, "
        "documentos, importaciones y estadísticas."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_DIST": "SIDECAR",
    "SWAGGER_UI_FAVICON_HREF": "SIDECAR",
    "REDOC_DIST": "SIDECAR",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": True,
    "ENUM_NAME_OVERRIDES": {
        "PurchaseCostQualityEnum": "apps.purchases.models.CostQuality.choices",
        "PurchaseOrderStatusEnum": "apps.purchases.models.PurchaseOrderStatus.choices",
        "ShipmentStatusEnum": "apps.purchases.logistics_models.ShipmentStatus.choices",
        "ShipmentCustodianEnum": "apps.purchases.logistics_models.ShipmentCustodian.choices",
        "ShipmentTransportModeEnum": "apps.purchases.logistics_models.ShipmentTransportMode.choices",
        "ShipmentEventTypeEnum": "apps.purchases.logistics_models.ShipmentEventType.choices",
        "ShipmentChargeTypeEnum": "apps.purchases.logistics_models.ShipmentChargeType.choices",
        "ShipmentChargeStatusEnum": "apps.purchases.logistics_models.ShipmentChargeStatus.choices",
    },
    "TAGS": [
        {
            "name": "Auth",
            "description": "Autenticación, sesión, tokens y usuario actual.",
        },
        {
            "name": "Core",
            "description": "Health checks, auditoría, búsqueda global e inicio.",
        },
        {"name": "Accounts", "description": "Usuarios internos, roles y permisos."},
        {"name": "Collaborators", "description": "Colaboradores internos de SERKAN."},
        {
            "name": "Commercial",
            "description": "Holdings, mineras, áreas, subáreas y contactos.",
        },
        {"name": "Inventory", "description": "Productos, stock y movimientos Kardex."},
        {
            "name": "Purchases",
            "description": (
                "Proveedores, órdenes de compra, recepciones y costos asociados."
            ),
        },
        {
            "name": "Sales",
            "description": "Ventas, detalles, estados comerciales y alertas.",
        },
        {
            "name": "Documents",
            "description": "Documentos lógicos y versiones documentales.",
        },
        {
            "name": "Imports",
            "description": "Importaciones Excel, prevalidación y lotes.",
        },
    ],
}

# Umbral operativo interno de SERKAN; no sustituye una regla legal aduanera.
PURCHASE_CUSTOMS_ALERT_THRESHOLD_USD = os.getenv(
    "PURCHASE_CUSTOMS_ALERT_THRESHOLD_USD", "5000"
)
