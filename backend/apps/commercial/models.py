from django.db import models
from apps.core.models import BaseModel

class RecordStatus(models.TextChoices):
    ACTIVO = "ACTIVO", "Activo"
    INACTIVO = "INACTIVO", "Inactivo"

class ShiftMode(models.TextChoices):
    DIA = "DIA", "Día"
    NOCHE = "NOCHE", "Noche"
    SIN_DEFINIR = "SIN_DEFINIR", "Sin definir"

class Ciudad(BaseModel):
    name = models.CharField(max_length=120, unique=True, verbose_name="Nombre")
    region = models.CharField(max_length=120, blank=True, verbose_name="Región")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )

    class Meta:
        verbose_name = "Ciudad"
        verbose_name_plural = "Ciudades"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Holding(BaseModel):
    name = models.CharField(max_length=180, unique=True, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )

    class Meta:
        verbose_name = "Holding"
        verbose_name_plural = "Holdings"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Minera(BaseModel):
    name = models.CharField(max_length=180, verbose_name="Nombre / Razón social")
    rut = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    holding = models.ForeignKey(
        Holding,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mineras",
        verbose_name="Holding",
    )
    city = models.ForeignKey(
        Ciudad,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mineras",
        verbose_name="Ciudad",
    )
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    address = models.CharField(max_length=255, blank=True, verbose_name="Dirección")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )
    observations = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        verbose_name = "Minera"
        verbose_name_plural = "Mineras"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Area(BaseModel):
    minera = models.ForeignKey(
        Minera,
        on_delete=models.PROTECT,
        related_name="areas",
        verbose_name="Minera",
    )
    name = models.CharField(max_length=160, verbose_name="Nombre")
    location = models.CharField(max_length=180, blank=True, verbose_name="Ubicación")
    description = models.TextField(blank=True, verbose_name="Descripción")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )

    class Meta:
        verbose_name = "Área"
        verbose_name_plural = "Áreas"
        ordering = ["minera__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["minera", "name"],
                name="unique_area_by_minera",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.minera.name}"


class Subarea(BaseModel):
    area = models.ForeignKey(
        Area,
        on_delete=models.PROTECT,
        related_name="subareas",
        verbose_name="Área",
    )
    name = models.CharField(max_length=160, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )

    class Meta:
        verbose_name = "Subárea"
        verbose_name_plural = "Subáreas"
        ordering = ["area__minera__name", "area__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["area", "name"],
                name="unique_subarea_by_area",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.area.name}"


class Contacto(BaseModel):
    first_name = models.CharField(max_length=120, verbose_name="Nombres")
    last_name = models.CharField(max_length=120, blank=True, verbose_name="Apellidos")
    position = models.CharField(max_length=120, blank=True, verbose_name="Cargo")
    minera = models.ForeignKey(
        Minera,
        on_delete=models.PROTECT,
        related_name="contactos",
        verbose_name="Minera",
    )
    area = models.ForeignKey(
        Area,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contactos",
        verbose_name="Área",
    )
    subarea = models.ForeignKey(
        Subarea,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contactos",
        verbose_name="Subárea",
    )
    city = models.ForeignKey(
        Ciudad,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contactos",
        verbose_name="Ciudad",
    )
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    shift = models.CharField(max_length=80, blank=True, verbose_name="Turno")
    active_days = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Días activos",
    )
    rest_days = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Días descanso",
    )
    active_cycle_start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha inicio ciclo activo",
    )
    shift_mode = models.CharField(
        max_length=20,
        choices=ShiftMode.choices,
        default=ShiftMode.SIN_DEFINIR,
        verbose_name="Modalidad",
    )
    
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )
    observations = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        verbose_name = "Contacto"
        verbose_name_plural = "Contactos"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or "Contacto sin nombre"