from django.db import models


class RecordStatus(models.TextChoices):
    ACTIVO = "ACTIVO", "Activo"
    INACTIVO = "INACTIVO", "Inactivo"


class ContactType(models.TextChoices):
    COMPRAS = "COMPRAS", "Compras"
    VENTAS = "VENTAS", "Ventas"
    OPERACION = "OPERACION", "Operación"
    ADMINISTRACION = "ADMINISTRACION", "Administración"
    FINANZAS = "FINANZAS", "Finanzas"
    TECNICO = "TECNICO", "Técnico"
    OTRO = "OTRO", "Otro"


class AllianceLevel(models.TextChoices):
    ALTO = "ALTO", "Alto"
    MEDIO = "MEDIO", "Medio"
    BAJO = "BAJO", "Bajo"
    SIN_DEFINIR = "SIN_DEFINIR", "Sin definir"


class GrupoEmpresarial(models.Model):
    name = models.CharField(max_length=180, unique=True, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Grupo empresarial"
        verbose_name_plural = "Grupos empresariales"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Minera(models.Model):
    name = models.CharField(max_length=180, verbose_name="Nombre")
    business_group = models.ForeignKey(
        GrupoEmpresarial,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mining_companies",
        verbose_name="Grupo empresarial",
    )
    rut = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )
    observations = models.TextField(blank=True, verbose_name="Observaciones")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Minera"
        verbose_name_plural = "Mineras"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "business_group"],
                name="unique_minera_by_group",
            )
        ]

    def __str__(self):
        return self.name


class EmpresaCliente(models.Model):
    name = models.CharField(max_length=180, verbose_name="Nombre / Razón social")
    rut = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="RUT",
    )
    mining_company = models.ForeignKey(
        Minera,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="client_companies",
        verbose_name="Minera relacionada",
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
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Empresa cliente"
        verbose_name_plural = "Empresas cliente"
        ordering = ["name"]

    def __str__(self):
        return self.name


class AreaCliente(models.Model):
    company = models.ForeignKey(
        EmpresaCliente,
        on_delete=models.PROTECT,
        related_name="areas",
        verbose_name="Empresa",
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
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Área cliente"
        verbose_name_plural = "Áreas cliente"
        ordering = ["company__name", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                name="unique_area_by_company",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.company.name}"


class ContactoCliente(models.Model):
    first_name = models.CharField(max_length=120, verbose_name="Nombres")
    last_name = models.CharField(max_length=120, blank=True, verbose_name="Apellidos")
    position = models.CharField(max_length=120, blank=True, verbose_name="Cargo")
    company = models.ForeignKey(
        EmpresaCliente,
        on_delete=models.PROTECT,
        related_name="contacts",
        verbose_name="Empresa",
    )
    area = models.ForeignKey(
        AreaCliente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contacts",
        verbose_name="Área",
    )
    email = models.EmailField(blank=True, verbose_name="Correo")
    phone = models.CharField(max_length=30, blank=True, verbose_name="Teléfono")
    shift = models.CharField(max_length=80, blank=True, verbose_name="Turno")
    contact_type = models.CharField(
        max_length=30,
        choices=ContactType.choices,
        default=ContactType.OTRO,
        verbose_name="Tipo de contacto",
    )
    alliance_level = models.CharField(
        max_length=30,
        choices=AllianceLevel.choices,
        default=AllianceLevel.SIN_DEFINIR,
        verbose_name="Nivel de alianza",
    )
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.ACTIVO,
        verbose_name="Estado",
    )
    observations = models.TextField(blank=True, verbose_name="Observaciones")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Última actualización")

    class Meta:
        verbose_name = "Contacto cliente"
        verbose_name_plural = "Contactos cliente"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or "Contacto sin nombre"