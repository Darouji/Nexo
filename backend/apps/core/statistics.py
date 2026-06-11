from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.accounts.permissions import user_has_role
from apps.collaborators.models import Collaborator
from apps.commercial.models import Area, Contacto, Holding, Minera, Subarea
from apps.core.models import AlertSeverity, BaseStatus
from apps.documents.models import DocumentFile, DocumentType, DocumentVersion
from apps.imports.models import ImportBatch, ImportBatchStatus, ImportRow, ImportRowStatus
from apps.inventory.models import Categoria, KardexMovementType, MovimientoKardex, Producto
from apps.sales.models import Venta, VentaAlert, VentaStatus


MONEY_QUANTIZER = Decimal("0.01")

PEOPLE_STATS_ROLES = [
    UserRole.ADMINISTRADOR,
    UserRole.RRHH,
    UserRole.INFORMATICO,
    UserRole.FINANZAS_COMERCIAL,
]


def decimal_to_string(value):
    if value is None:
        value = Decimal("0")

    return str(Decimal(value).quantize(MONEY_QUANTIZER))


def int_or_zero(value):
    return int(value or 0)


def count_by_choice(queryset, field_name, choices):
    choice_map = dict(choices)

    output = []

    for item in queryset.values(field_name).annotate(count=Count("id")).order_by(field_name):
        value = item[field_name] or ""
        output.append(
            {
                "value": value,
                "label": choice_map.get(value, value or "Sin valor"),
                "count": item["count"],
            }
        )

    return output


def can_view_people_stats(user):
    return user_has_role(user, PEOPLE_STATS_ROLES)


def get_general_statistics(user=None):
    can_view_people = can_view_people_stats(user)

    users_active = None
    collaborators_active = None

    if can_view_people:
        users_active = User.objects.filter(
            is_active=True,
            status=BaseStatus.ACTIVO,
        ).count()

        collaborators_active = Collaborator.objects.filter(
            status=BaseStatus.ACTIVO,
        ).count()

    return {
        "users_active": users_active,
        "collaborators_active": collaborators_active,
        "holdings_active": Holding.objects.filter(status=BaseStatus.ACTIVO).count(),
        "mineras_active": Minera.objects.filter(status=BaseStatus.ACTIVO).count(),
        "contacts_active": Contacto.objects.filter(status=BaseStatus.ACTIVO).count(),
        "products_active": Producto.objects.filter(status=BaseStatus.ACTIVO).count(),
        "sales_total": Venta.objects.count(),
        "documents_total": DocumentFile.objects.count(),
        "imports_total": ImportBatch.objects.count(),
    }


def get_commercial_statistics():
    return {
        "holdings": {
            "total": Holding.objects.count(),
            "active": Holding.objects.filter(status=BaseStatus.ACTIVO).count(),
            "inactive": Holding.objects.filter(status=BaseStatus.INACTIVO).count(),
            "archived": Holding.objects.filter(status=BaseStatus.ARCHIVADO).count(),
        },
        "mineras": {
            "total": Minera.objects.count(),
            "active": Minera.objects.filter(status=BaseStatus.ACTIVO).count(),
            "inactive": Minera.objects.filter(status=BaseStatus.INACTIVO).count(),
            "archived": Minera.objects.filter(status=BaseStatus.ARCHIVADO).count(),
        },
        "areas": {
            "total": Area.objects.count(),
            "active": Area.objects.filter(status=BaseStatus.ACTIVO).count(),
        },
        "subareas": {
            "total": Subarea.objects.count(),
            "active": Subarea.objects.filter(status=BaseStatus.ACTIVO).count(),
        },
        "contacts": {
            "total": Contacto.objects.count(),
            "active": Contacto.objects.filter(status=BaseStatus.ACTIVO).count(),
        },
    }


def get_inventory_statistics():
    active_products = Producto.objects.filter(status=BaseStatus.ACTIVO)

    critical_products_qs = active_products.filter(
        controla_stock=True,
        stock_actual__lte=F("stock_critico"),
    )

    stock_units = active_products.filter(
        controla_stock=True,
    ).aggregate(total=Sum("stock_actual"))["total"]

    critical_products = []

    for product in critical_products_qs.select_related("categoria").order_by(
        "stock_actual",
        "modelo",
    )[:10]:
        critical_products.append(
            {
                "id": product.pk,
                "modelo": product.modelo,
                "categoria": product.categoria.name,
                "codigo_sap": product.codigo_sap,
                "stock_actual": product.stock_actual,
                "stock_critico": product.stock_critico,
                "api_url": f"/api/inventory/productos/{product.pk}/",
            }
        )

    return {
        "categories_total": Categoria.objects.count(),
        "products_total": Producto.objects.count(),
        "products_active": active_products.count(),
        "products_control_stock": active_products.filter(controla_stock=True).count(),
        "stock_units_total": int_or_zero(stock_units),
        "critical_products_count": critical_products_qs.count(),
        "critical_products": critical_products,
        "movements_total": MovimientoKardex.objects.count(),
        "movements_by_type": count_by_choice(
            MovimientoKardex.objects.all(),
            "movement_type",
            KardexMovementType.choices,
        ),
    }


def get_sales_statistics():
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    all_sales = Venta.objects.all()
    valid_sales = all_sales.exclude(sale_status=VentaStatus.ANULADA)

    totals = valid_sales.aggregate(
        valor_neto=Sum("valor_neto"),
        iva=Sum("iva"),
        total=Sum("total"),
    )

    current_month_sales = valid_sales.filter(fecha_venta__gte=month_start.date())
    current_month_totals = current_month_sales.aggregate(total=Sum("total"))

    last_six_months_start = (month_start - timedelta(days=180)).date()

    monthly_data = (
        valid_sales.filter(fecha_venta__gte=last_six_months_start)
        .annotate(month=TruncMonth("fecha_venta"))
        .values("month")
        .annotate(count=Count("id"), total=Sum("total"))
        .order_by("month")
    )

    monthly_sales = []

    for item in monthly_data:
        month = item["month"]

        monthly_sales.append(
            {
                "month": month.strftime("%Y-%m") if month else "",
                "count": item["count"],
                "total": decimal_to_string(item["total"]),
            }
        )

    active_alerts = VentaAlert.objects.filter(is_active=True)

    return {
        "sales_total": all_sales.count(),
        "sales_valid": valid_sales.count(),
        "sales_by_status": count_by_choice(
            all_sales,
            "sale_status",
            VentaStatus.choices,
        ),
        "totals_valid_sales": {
            "valor_neto": decimal_to_string(totals["valor_neto"]),
            "iva": decimal_to_string(totals["iva"]),
            "total": decimal_to_string(totals["total"]),
        },
        "current_month": {
            "count": current_month_sales.count(),
            "total": decimal_to_string(current_month_totals["total"]),
        },
        "last_six_months": monthly_sales,
        "active_alerts_count": active_alerts.count(),
        "active_alerts_by_severity": count_by_choice(
            active_alerts,
            "severity",
            AlertSeverity.choices,
        ),
    }


def get_document_statistics():
    return {
        "documents_total": DocumentFile.objects.count(),
        "documents_active": DocumentFile.objects.filter(status=BaseStatus.ACTIVO).count(),
        "versions_total": DocumentVersion.objects.count(),
        "active_versions": DocumentVersion.objects.filter(is_active=True).count(),
        "documents_by_type": count_by_choice(
            DocumentFile.objects.all(),
            "document_type",
            DocumentType.choices,
        ),
    }


def get_import_statistics():
    return {
        "batches_total": ImportBatch.objects.count(),
        "batches_by_status": count_by_choice(
            ImportBatch.objects.all(),
            "batch_status",
            ImportBatchStatus.choices,
        ),
        "rows_total": ImportRow.objects.count(),
        "rows_by_status": count_by_choice(
            ImportRow.objects.all(),
            "row_status",
            ImportRowStatus.choices,
        ),
        "rows_with_error": ImportRow.objects.filter(
            row_status=ImportRowStatus.ERROR,
        ).count(),
        "rows_requires_review": ImportRow.objects.filter(
            row_status=ImportRowStatus.REQUIERE_REVISION,
        ).count(),
    }


def get_dashboard_statistics(user=None):
    return {
        "generated_at": timezone.now().isoformat(),
        "general": get_general_statistics(user=user),
        "commercial": get_commercial_statistics(),
        "inventory": get_inventory_statistics(),
        "sales": get_sales_statistics(),
        "documents": get_document_statistics(),
        "imports": get_import_statistics(),
    }