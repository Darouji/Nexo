from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models

from apps.core.models import BaseStatus


class UserRole(models.TextChoices):
    ADMINISTRADOR = "ADMINISTRADOR", "Administrador"
    RRHH = "RRHH", "RRHH"
    INFORMATICO = "INFORMATICO", "Informático"
    FINANZAS_COMERCIAL = "FINANZAS_COMERCIAL", "Finanzas / Comercial"
    OPERATIVO = "OPERATIVO", "Operativo"
    CONSULTA = "CONSULTA", "Consulta"


class SerkanUserManager(UserManager):
    use_in_migrations = True

    def _create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError("El nombre de usuario es obligatorio.")

        username = self.model.normalize_username(username)
        email = self.normalize_email(email) if email else None

        user = self.model(
            username=username,
            email=email,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.ADMINISTRADOR)
        extra_fields.setdefault("status", BaseStatus.ACTIVO)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("El superusuario debe tener is_staff=True.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("El superusuario debe tener is_superuser=True.")

        return self._create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    """
    Usuario interno de SERKAN V2.

    Regla de negocio:
    - Un usuario es una cuenta con acceso al sistema.
    - Crear usuario NO crea colaborador.
    - Crear usuario NO crea contacto externo.
    - La vinculación con colaborador se hará desde el módulo de colaboradores.
    """

    email = models.EmailField(
        unique=True,
        null=True,
        blank=True,
        verbose_name="Correo",
    )
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.OPERATIVO,
        db_index=True,
        verbose_name="Rol",
    )
    status = models.CharField(
        max_length=20,
        choices=BaseStatus.choices,
        default=BaseStatus.ACTIVO,
        db_index=True,
        verbose_name="Estado interno",
    )
    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Teléfono",
    )
    position = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Cargo",
    )
    department = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Departamento interno",
    )
    observations = models.TextField(
        blank=True,
        verbose_name="Observaciones",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Fecha de creación",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Última actualización",
    )
    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_created",
        verbose_name="Creado por",
    )
    updated_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_updated",
        verbose_name="Actualizado por",
    )

    objects = SerkanUserManager()

    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["username"]
        indexes = [
            models.Index(fields=["role", "status"]),
            models.Index(fields=["username"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self):
        full_name = self.get_full_name().strip()
        return full_name or self.username

    @property
    def full_name(self):
        return self.get_full_name().strip()

    @property
    def is_active_internal(self):
        return self.is_active and self.status == BaseStatus.ACTIVO

    def deactivate(self, user=None):
        self.is_active = False
        self.status = BaseStatus.INACTIVO
        self.updated_by = user
        self.save(update_fields=["is_active", "status", "updated_by", "updated_at"])