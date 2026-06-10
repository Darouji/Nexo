from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel, BaseStatus
from apps.core.utils import (
    normalize_email,
    normalize_phone,
    normalize_rut,
    normalize_text,
)


class ShiftMode(models.TextChoices):
    DIA = "DIA", "Día"
    NOCHE = "NOCHE", "Noche"
    SIN_DEFINIR = "SIN_DEFINIR", "Sin definir"


class Ciudad(BaseModel):
    name = models.CharField(max_length=120, verbose_name="Nombre")
    name_normalized = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        verbose_name="Nombre normalizado",
    )
    region = models.CharField(max_length=120, blank=True, verbose_name="Región")

    class Meta:
        verbose_name = "Ciudad"
        verbose_name_plural = "Ciudades"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_ciudad_name_normalized",
            )
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        super().save(*args, **kwargs)


class Holding(BaseModel):
    name = models.CharField(max_length=180, verbose_name="Nombre")
    name_normalized = models.CharField(
        max_length=180,
        blank=True,
        db_index=True,
        verbose_name="Nombre normalizado",
    )
    aliases = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Alias",
    )
    description = models.TextField(blank=True, verbose_name="Descripción")

    class Meta:
        verbose_name = "Holding"
        verbose_name_plural = "Holdings"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_holding_name_normalized",
            )
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        if not self.name or not self.name.strip():
            raise ValidationError({"name": "El nombre del holding es obligatorio."})

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        self.full_clean()
        super().save(*args, **kwargs)


class Minera(BaseModel):
    name = models.CharField(max_length=180, verbose_name="Nombre / Razón social")
    name_normalized = models.CharField(
        max_length=180,
        blank=True,
        db_index=True,
        verbose_name="Nombre normalizado",
    )

    rut = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    rut_normalized = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        verbose_name="RUT normalizado",
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

    aliases = models.JSONField(
        default=list,
        blank=True,
        verbose_name="Alias",
    )
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    address = models.CharField(max_length=255, blank=True, verbose_name="Dirección")
    observations = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        verbose_name = "Minera"
        verbose_name_plural = "Mineras"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["status", "name"]),
            models.Index(fields=["rut_normalized"]),
            models.Index(fields=["name_normalized"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["rut_normalized"],
                condition=~models.Q(rut_normalized=""),
                name="unique_minera_rut_normalized",
            ),
            models.UniqueConstraint(
                fields=["name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_minera_name_normalized",
            ),
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()

        if not self.name or not self.name.strip():
            raise ValidationError({"name": "El nombre de la minera es obligatorio."})

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        self.rut_normalized = normalize_rut(self.rut)
        self.full_clean()
        super().save(*args, **kwargs)


class Area(BaseModel):
    minera = models.ForeignKey(
        Minera,
        on_delete=models.PROTECT,
        related_name="areas",
        verbose_name="Minera",
    )
    name = models.CharField(max_length=160, verbose_name="Nombre")
    name_normalized = models.CharField(
        max_length=160,
        blank=True,
        db_index=True,
        verbose_name="Nombre normalizado",
    )
    location = models.CharField(max_length=180, blank=True, verbose_name="Ubicación")
    description = models.TextField(blank=True, verbose_name="Descripción")

    class Meta:
        verbose_name = "Área"
        verbose_name_plural = "Áreas"
        ordering = ["minera__name", "name"]
        indexes = [
            models.Index(fields=["minera", "status"]),
            models.Index(fields=["name_normalized"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["minera", "name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_area_name_normalized_by_minera",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.minera.name}"

    def clean(self):
        super().clean()

        if not self.minera_id:
            raise ValidationError({"minera": "El área debe pertenecer a una minera."})

        if self.minera and self.minera.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {"minera": "No se puede asociar un área a una minera inactiva."}
            )

        if not self.name or not self.name.strip():
            raise ValidationError({"name": "El nombre del área es obligatorio."})

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        self.full_clean()
        super().save(*args, **kwargs)


class Subarea(BaseModel):
    area = models.ForeignKey(
        Area,
        on_delete=models.PROTECT,
        related_name="subareas",
        verbose_name="Área",
    )
    name = models.CharField(max_length=160, verbose_name="Nombre")
    name_normalized = models.CharField(
        max_length=160,
        blank=True,
        db_index=True,
        verbose_name="Nombre normalizado",
    )
    description = models.TextField(blank=True, verbose_name="Descripción")

    class Meta:
        verbose_name = "Subárea"
        verbose_name_plural = "Subáreas"
        ordering = ["area__minera__name", "area__name", "name"]
        indexes = [
            models.Index(fields=["area", "status"]),
            models.Index(fields=["name_normalized"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["area", "name_normalized"],
                condition=~models.Q(name_normalized=""),
                name="unique_subarea_name_normalized_by_area",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.area.name}"

    def clean(self):
        super().clean()

        if not self.area_id:
            raise ValidationError({"area": "La subárea debe pertenecer a un área."})

        if self.area and self.area.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {"area": "No se puede asociar una subárea a un área inactiva."}
            )

        if self.area and self.area.minera.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "area": "No se puede asociar una subárea a un área cuya minera está inactiva."
                }
            )

        if not self.name or not self.name.strip():
            raise ValidationError({"name": "El nombre de la subárea es obligatorio."})

    def save(self, *args, **kwargs):
        self.name_normalized = normalize_text(self.name)
        self.full_clean()
        super().save(*args, **kwargs)


class Contacto(BaseModel):
    first_name = models.CharField(max_length=120, verbose_name="Nombres")
    last_name = models.CharField(max_length=120, blank=True, verbose_name="Apellidos")
    full_name_normalized = models.CharField(
        max_length=260,
        blank=True,
        db_index=True,
        verbose_name="Nombre completo normalizado",
    )

    position = models.CharField(max_length=120, blank=True, verbose_name="Cargo")

    subarea = models.ForeignKey(
        Subarea,
        on_delete=models.PROTECT,
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
    email_normalized = models.EmailField(
        blank=True,
        db_index=True,
        verbose_name="Correo normalizado",
    )

    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    phone_normalized = models.CharField(
        max_length=40,
        blank=True,
        db_index=True,
        verbose_name="Teléfono normalizado",
    )

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

    observations = models.TextField(blank=True, verbose_name="Observaciones")

    class Meta:
        verbose_name = "Contacto"
        verbose_name_plural = "Contactos"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["status", "subarea"]),
            models.Index(fields=["email_normalized"]),
            models.Index(fields=["phone_normalized"]),
            models.Index(fields=["full_name_normalized"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["subarea", "full_name_normalized"],
                condition=~models.Q(full_name_normalized=""),
                name="unique_contact_full_name_by_subarea",
            )
        ]

    def __str__(self):
        return self.full_name or "Contacto sin nombre"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def area(self):
        return self.subarea.area if self.subarea_id else None

    @property
    def minera(self):
        return self.subarea.area.minera if self.subarea_id else None

    @property
    def holding(self):
        minera = self.minera
        return minera.holding if minera else None

    def clean(self):
        super().clean()

        if not self.first_name or not self.first_name.strip():
            raise ValidationError({"first_name": "El nombre del contacto es obligatorio."})

        if not self.subarea_id:
            raise ValidationError(
                {"subarea": "El contacto debe pertenecer a una subárea activa."}
            )

        if self.subarea and self.subarea.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {"subarea": "El contacto no puede asociarse a una subárea inactiva."}
            )

        if self.subarea and self.subarea.area.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "subarea": "El contacto no puede asociarse a una subárea cuya área está inactiva."
                }
            )

        if self.subarea and self.subarea.area.minera.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "subarea": "El contacto no puede asociarse a una subárea cuya minera está inactiva."
                }
            )

    def save(self, *args, **kwargs):
        old_subarea_id = None

        if self.pk:
            old_subarea_id = (
                type(self)
                .objects.filter(pk=self.pk)
                .values_list("subarea_id", flat=True)
                .first()
            )

        self.email_normalized = normalize_email(self.email)
        self.phone_normalized = normalize_phone(self.phone)
        self.full_name_normalized = normalize_text(self.full_name)

        self.full_clean()
        super().save(*args, **kwargs)

        if old_subarea_id and old_subarea_id != self.subarea_id:
            ContactSubareaHistory.objects.create(
                contact=self,
                old_subarea_id=old_subarea_id,
                new_subarea=self.subarea,
                changed_by=self.updated_by,
                reason="Cambio de subárea del contacto.",
            )


class ContactSubareaHistory(BaseModel):
    contact = models.ForeignKey(
        Contacto,
        on_delete=models.PROTECT,
        related_name="subarea_history",
        verbose_name="Contacto",
    )
    old_subarea = models.ForeignKey(
        Subarea,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contactos_history_old",
        verbose_name="Subárea anterior",
    )
    new_subarea = models.ForeignKey(
        Subarea,
        on_delete=models.PROTECT,
        related_name="contactos_history_new",
        verbose_name="Subárea nueva",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contact_subarea_changes",
        verbose_name="Modificado por",
    )
    reason = models.TextField(blank=True, verbose_name="Motivo")

    class Meta:
        verbose_name = "Historial de subárea de contacto"
        verbose_name_plural = "Historiales de subárea de contactos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["contact", "created_at"]),
            models.Index(fields=["old_subarea", "new_subarea"]),
        ]

    def __str__(self):
        return f"{self.contact} | {self.old_subarea} -> {self.new_subarea}"