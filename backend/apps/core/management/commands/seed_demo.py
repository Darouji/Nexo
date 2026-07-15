from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.commercial.models import Area, Contacto, Minera, Subarea
from apps.core.models import BaseStatus
from apps.inventory.models import Categoria, Producto, ProductOrigin
from apps.inventory.services import (
    create_pending_receipt,
    register_manual_entry,
)
from apps.sales.services import create_sale_with_details

User = get_user_model()


PRODUCT_SPECS = [
    {
        "category": "Filtros",
        "model": "Filtro de aceite Bosch P3318",
        "code": "DEMO-AUTO-001",
        "stock": 45,
        "critical": 8,
        "price": Decimal("12990"),
    },
    {
        "category": "Filtros",
        "model": "Filtro de aire Mann C 22 117",
        "code": "DEMO-AUTO-002",
        "stock": 38,
        "critical": 7,
        "price": Decimal("18990"),
    },
    {
        "category": "Frenos",
        "model": "Pastillas de freno delanteras Brembo P85020",
        "code": "DEMO-AUTO-003",
        "stock": 32,
        "critical": 6,
        "price": Decimal("45990"),
    },
    {
        "category": "Frenos",
        "model": "Disco de freno ventilado Bosch BD1263",
        "code": "DEMO-AUTO-004",
        "stock": 24,
        "critical": 4,
        "price": Decimal("69990"),
    },
    {
        "category": "Encendido",
        "model": "Juego de bujías NGK Iridium IX",
        "code": "DEMO-AUTO-005",
        "stock": 60,
        "critical": 10,
        "price": Decimal("34990"),
    },
    {
        "category": "Motor",
        "model": "Correa de alternador Gates 6PK1200",
        "code": "DEMO-AUTO-006",
        "stock": 28,
        "critical": 5,
        "price": Decimal("28990"),
    },
    {
        "category": "Suspensión",
        "model": "Amortiguador delantero Monroe Gas-Matic",
        "code": "DEMO-AUTO-007",
        "stock": 20,
        "critical": 4,
        "price": Decimal("89990"),
    },
    {
        "category": "Rodamientos",
        "model": "Rodamiento de rueda SKF VKBA 3551",
        "code": "DEMO-AUTO-008",
        "stock": 26,
        "critical": 5,
        "price": Decimal("57990"),
    },
    {
        "category": "Refrigeración",
        "model": "Bomba de agua GMB GWT-83A",
        "code": "DEMO-AUTO-009",
        "stock": 18,
        "critical": 3,
        "price": Decimal("64990"),
    },
    {
        "category": "Refrigeración",
        "model": "Radiador de aluminio Denso DRM40010",
        "code": "DEMO-AUTO-010",
        "stock": 16,
        "critical": 3,
        "price": Decimal("149990"),
    },
    {
        "category": "Eléctrico",
        "model": "Alternador Bosch 12V 90A",
        "code": "DEMO-AUTO-011",
        "stock": 14,
        "critical": 3,
        "price": Decimal("219990"),
    },
    {
        "category": "Eléctrico",
        "model": "Motor de partida Denso 12V",
        "code": "DEMO-AUTO-012",
        "stock": 13,
        "critical": 3,
        "price": Decimal("189990"),
    },
    {
        "category": "Transmisión",
        "model": "Kit de embrague Luk RepSet",
        "code": "DEMO-AUTO-013",
        "stock": 12,
        "critical": 2,
        "price": Decimal("239990"),
    },
    {
        "category": "Sensores",
        "model": "Sensor de oxígeno Denso DOX-0119",
        "code": "DEMO-AUTO-014",
        "stock": 22,
        "critical": 4,
        "price": Decimal("79990"),
    },
    {
        "category": "Lubricantes",
        "model": "Aceite sintético 5W-30 Mobil 1 4L",
        "code": "DEMO-AUTO-015",
        "stock": 50,
        "critical": 10,
        "price": Decimal("42990"),
    },
]


COMMERCIAL_SPECS = [
    {
        "minera": "Minera Cordillera Demo",
        "area": "Mantenimiento de Flota",
        "subarea": "Taller Mecánico",
        "contact_first": "Carlos",
        "contact_last": "Rojas",
        "email": "carlos.rojas@cordillera-demo.cl",
    },
    {
        "minera": "Minera Desierto Norte Demo",
        "area": "Operaciones",
        "subarea": "Vehículos Livianos",
        "contact_first": "Marcela",
        "contact_last": "Fuentes",
        "email": "marcela.fuentes@desierto-demo.cl",
    },
    {
        "minera": "Minera Valle Cobre Demo",
        "area": "Abastecimiento",
        "subarea": "Repuestos y Suministros",
        "contact_first": "Rodrigo",
        "contact_last": "Soto",
        "email": "rodrigo.soto@vallecobre-demo.cl",
    },
]


class Command(BaseCommand):
    help = (
        "Carga datos ficticios para presentación: productos, "
        "stock, ventas y pendientes por recibir."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default="",
            help=(
                "Nombre del superusuario que quedará como operador. "
                "Si se omite, se usa el primer superusuario activo."
            ),
        )

    def handle(self, *args, **options):
        username = str(options.get("username") or "").strip()

        users = User.objects.filter(
            is_superuser=True,
            is_active=True,
            status=BaseStatus.ACTIVO,
        )

        if username:
            users = users.filter(username=username)

        operator = users.order_by("id").first()

        if operator is None:
            raise CommandError(
                "No existe un superusuario activo. "
                "Ejecuta primero: python manage.py createsuperuser"
            )

        if Producto.objects.filter(codigo_sap__startswith="DEMO-AUTO-").exists():
            raise CommandError(
                "Los datos demo ya fueron cargados. No ejecutes el comando dos veces."
            )

        if Minera.objects.filter(name__startswith="Minera Cordillera Demo").exists():
            raise CommandError("Ya existen entidades comerciales demostrativas.")

        today = timezone.localdate()

        with transaction.atomic():
            categories = {}

            for category_name in sorted({item["category"] for item in PRODUCT_SPECS}):
                categories[category_name] = Categoria.objects.create(
                    name=category_name,
                    description=("Categoría ficticia cargada para la presentación."),
                    created_by=operator,
                    updated_by=operator,
                )

            products = []

            for item in PRODUCT_SPECS:
                product = Producto.objects.create(
                    categoria=categories[item["category"]],
                    modelo=item["model"],
                    detalle=(
                        "Repuesto vehicular ficticio para demostración "
                        "de inventario y ventas."
                    ),
                    codigo_sap=item["code"],
                    origen=ProductOrigin.COMPRADO,
                    stock_critico=item["critical"],
                    controla_stock=True,
                    created_by=operator,
                    updated_by=operator,
                )

                register_manual_entry(
                    producto=product,
                    cantidad=item["stock"],
                    motivo=("Carga de stock inicial para presentación demostrativa."),
                    user=operator,
                )

                product.refresh_from_db()
                products.append(product)

            commercial_entities = []

            for item in COMMERCIAL_SPECS:
                minera = Minera.objects.create(
                    name=item["minera"],
                    observations=(
                        "Entidad ficticia creada exclusivamente para la presentación."
                    ),
                    created_by=operator,
                    updated_by=operator,
                )

                area = Area.objects.create(
                    minera=minera,
                    name=item["area"],
                    description="Área ficticia de demostración.",
                    created_by=operator,
                    updated_by=operator,
                )

                subarea = Subarea.objects.create(
                    area=area,
                    name=item["subarea"],
                    description="Subárea ficticia de demostración.",
                    created_by=operator,
                    updated_by=operator,
                )

                contacto = Contacto.objects.create(
                    first_name=item["contact_first"],
                    last_name=item["contact_last"],
                    position="Encargado de abastecimiento",
                    subarea=subarea,
                    email=item["email"],
                    phone="+56900000000",
                    created_by=operator,
                    updated_by=operator,
                )

                commercial_entities.append(
                    {
                        "minera": minera,
                        "area": area,
                        "subarea": subarea,
                        "contacto": contacto,
                    }
                )

            for index, product in enumerate(products, start=1):
                commercial = commercial_entities[(index - 1) % len(commercial_entities)]

                quantity = ((index - 1) % 4) + 1
                sale_date = today - timedelta(days=15 - index)

                create_sale_with_details(
                    sale_data={
                        "minera": commercial["minera"],
                        "area": commercial["area"],
                        "subarea": commercial["subarea"],
                        "contacto": commercial["contacto"],
                        "fecha_venta": sale_date,
                        "fecha_factura": sale_date,
                        "factura_numero": f"DEMO-F-{index:03d}",
                        "orden_compra": f"DEMO-OC-{index:03d}",
                        "numero_guia_hes": f"DEMO-GD-{index:03d}",
                        "observations": ("Venta ficticia generada para presentación."),
                    },
                    details_data=[
                        {
                            "producto": product,
                            "cantidad": quantity,
                            "valor_unitario": PRODUCT_SPECS[index - 1]["price"],
                        }
                    ],
                    user=operator,
                )

            for index, product in enumerate(products, start=1):
                create_pending_receipt(
                    producto=product,
                    cantidad=((index - 1) % 8) + 3,
                    motivo=("Reposición ficticia pendiente para presentación."),
                    referencia=f"DEMO-COMPRA-{index:03d}",
                    user=operator,
                )

        self.stdout.write(self.style.SUCCESS("Datos demo cargados correctamente:"))
        self.stdout.write("  - 15 productos")
        self.stdout.write("  - 15 entradas iniciales Kardex")
        self.stdout.write("  - 15 ventas")
        self.stdout.write("  - 15 pendientes por recibir")
        self.stdout.write("  - 3 mineras ficticias")
        self.stdout.write(f"  - Operador utilizado: {operator.username}")
