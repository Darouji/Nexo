from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.audit import (
    capture_field_values,
    create_business_audit_log,
    create_record_change_logs_from_snapshot,
)
from apps.core.models import AuditAction, AuditOrigin, BaseStatus
from apps.core.utils import normalize_text

from .kardex_context import allow_kardex_write
from .models import (
    ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
    Categoria,
    KardexMovementType,
    MovimientoKardex,
    PendientePorRecibir,
    Producto,
    ProductOrigin,
)
from .stock_context import allow_stock_write

PENDING_RECEIPT_AUDIT_FIELDS = [
    "cantidad_recibida",
    "cantidad_cancelada",
    "cantidad_pendiente",
    "estado",
    "updated_by",
]

PRODUCT_LIFECYCLE_AUDIT_FIELDS = [
    "status",
    "descontinuado",
    "updated_by",
]

PRODUCT_LIFECYCLE_AUDIT_ACTIONS = {
    "INACTIVAR": AuditAction.INACTIVAR,
    "ARCHIVAR": AuditAction.ARCHIVAR,
    "REACTIVAR": AuditAction.RESTAURAR,
    "DESCONTINUAR": AuditAction.CAMBIAR_ESTADO,
    "REANUDAR": AuditAction.RESTAURAR,
}

KARDEX_AUDIT_ACTION_BY_TYPE = {
    KardexMovementType.ENTRADA_IMPORTACION: AuditAction.IMPORTAR,
    KardexMovementType.AJUSTE_INVENTARIO: AuditAction.AJUSTE_INVENTARIO,
}


def get_operator(user):
    if user is None:
        return None

    if not getattr(user, "is_authenticated", False):
        return None

    return user


CATEGORY_RENAME_AUDIT_FIELDS = [
    "name",
    "name_normalized",
    "description",
    "updated_by",
]

CATEGORY_MERGE_AUDIT_FIELDS = [
    "status",
    "has_historical_usage",
    "merged_into",
    "merged_at",
    "merged_by",
    "merge_reason",
    "updated_by",
]

CATEGORY_PRODUCT_MERGE_AUDIT_FIELDS = [
    "categoria",
    "updated_by",
]

PRODUCT_CATEGORY_CHANGE_AUDIT_FIELDS = [
    "categoria",
    "updated_by",
]

PRODUCT_ORIGIN_AUDIT_FIELDS = [
    "origen",
    "origen_observacion",
    "controla_stock",
    "stock_critico",
    "updated_by",
]


def _require_category_reason(motivo):
    motivo = str(motivo or "").strip()

    if not motivo:
        raise ValidationError(
            {"motivo": "El motivo es obligatorio para esta operación."}
        )

    return motivo


def _require_available_category(categoria, field_name):
    if categoria.status != BaseStatus.ACTIVO or categoria.merged_into_id is not None:
        raise ValidationError(
            {
                field_name: (
                    "La categoría debe estar activa y disponible para "
                    "realizar esta operación."
                )
            }
        )


def rename_category(
    *,
    categoria,
    nombre,
    motivo,
    descripcion=None,
    user=None,
    request=None,
):
    if categoria is None:
        raise ValidationError({"categoria": "La categoría es obligatoria."})

    nombre = str(nombre or "").strip()
    motivo = _require_category_reason(motivo)
    description_provided = descripcion is not None
    descripcion = str(descripcion or "").strip() if description_provided else None
    nombre_normalized = normalize_text(nombre)

    if not nombre or not nombre_normalized:
        raise ValidationError(
            {"name": "El nuevo nombre de la categoría es obligatorio."}
        )

    with transaction.atomic():
        locked_category = Categoria.objects.select_for_update().get(pk=categoria.pk)

        _require_available_category(locked_category, "categoria")

        if locked_category.name_normalized == nombre_normalized:
            raise ValidationError(
                {"name": ("El nuevo nombre debe ser diferente del nombre actual.")}
            )

        if (
            Categoria.objects.exclude(pk=locked_category.pk)
            .filter(name_normalized=nombre_normalized)
            .exists()
        ):
            raise ValidationError(
                {
                    "name": (
                        "Ya existe otra categoría con ese nombre o con una "
                        "variante equivalente."
                    )
                }
            )

        old_values = capture_field_values(
            locked_category,
            CATEGORY_RENAME_AUDIT_FIELDS,
        )

        locked_category.name = nombre

        if description_provided:
            locked_category.description = descripcion

        locked_category.updated_by = get_operator(user)

        update_fields = [
            "name",
            "name_normalized",
            "updated_by",
            "updated_at",
        ]

        if description_provided:
            update_fields.insert(2, "description")

        try:
            with transaction.atomic():
                locked_category.save(update_fields=update_fields)
        except IntegrityError as error:
            raise ValidationError(
                {
                    "name": (
                        "Ya existe otra categoría con ese nombre o con una "
                        "variante equivalente."
                    )
                }
            ) from error

        create_record_change_logs_from_snapshot(
            instance=locked_category,
            old_values=old_values,
            fields=CATEGORY_RENAME_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.RENOMBRAR,
        )

        create_business_audit_log(
            instance=locked_category,
            action=AuditAction.RENOMBRAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "category_rename",
                "previous_name": old_values["name"],
                "new_name": locked_category.name,
                "description_changed": (
                    description_provided
                    and old_values["description"] != locked_category.description
                ),
            },
            request=request,
        )

    return locked_category


def merge_categories(
    *,
    categoria_origen,
    categoria_destino,
    motivo,
    user=None,
    request=None,
):
    if categoria_origen is None:
        raise ValidationError(
            {"categoria_origen": "La categoría origen es obligatoria."}
        )

    if categoria_destino is None:
        raise ValidationError(
            {"categoria_destino": "La categoría destino es obligatoria."}
        )

    if categoria_origen.pk == categoria_destino.pk:
        raise ValidationError(
            {
                "categoria_destino": (
                    "La categoría destino debe ser diferente de la categoría origen."
                )
            }
        )

    motivo = _require_category_reason(motivo)
    operator = get_operator(user)

    with transaction.atomic():
        category_ids = sorted([categoria_origen.pk, categoria_destino.pk])

        locked_categories = list(
            Categoria.objects.select_for_update()
            .filter(pk__in=category_ids)
            .order_by("pk")
        )

        if len(locked_categories) != 2:
            raise ValidationError(
                {"categoria": ("Una de las categorías indicadas ya no existe.")}
            )

        categories_by_id = {category.pk: category for category in locked_categories}

        source = categories_by_id[categoria_origen.pk]
        destination = categories_by_id[categoria_destino.pk]

        # Permite reintentos seguros cuando el frontend no recibió
        # la respuesta original por una caída de red.
        if source.merged_into_id:
            if source.merged_into_id == destination.pk:
                return source, destination, 0, True

            raise ValidationError(
                {
                    "categoria_origen": (
                        "La categoría origen ya fue fusionada en otra categoría."
                    )
                }
            )

        _require_available_category(source, "categoria_origen")
        _require_available_category(destination, "categoria_destino")

        products_to_move = list(
            Producto.objects.select_for_update()
            .select_related("categoria")
            .filter(categoria_id=source.pk)
            .order_by("pk")
        )

        normalized_models_to_move = [
            product.modelo_normalized
            for product in products_to_move
            if product.modelo_normalized
        ]

        if normalized_models_to_move:
            conflicting_models = list(
                Producto.objects.select_for_update()
                .filter(
                    categoria_id=destination.pk,
                    modelo_normalized__in=normalized_models_to_move,
                )
                .values_list("modelo", flat=True)[:5]
            )

            if conflicting_models:
                raise ValidationError(
                    {
                        "categoria_destino": (
                            "No se puede fusionar porque existen productos con "
                            "el mismo modelo en la categoría destino: "
                            f"{', '.join(conflicting_models)}."
                        )
                    }
                )

        source_old_values = capture_field_values(
            source,
            CATEGORY_MERGE_AUDIT_FIELDS,
        )
        destination_old_values = capture_field_values(
            destination,
            CATEGORY_MERGE_AUDIT_FIELDS,
        )

        product_old_values = [
            (
                product,
                capture_field_values(
                    product,
                    CATEGORY_PRODUCT_MERGE_AUDIT_FIELDS,
                ),
            )
            for product in products_to_move
        ]

        now = timezone.now()

        for product in products_to_move:
            product.categoria = destination
            product.updated_by = operator
            product.updated_at = now

        if products_to_move:
            try:
                with transaction.atomic():
                    Producto.objects.bulk_update(
                        products_to_move,
                        [
                            "categoria",
                            "updated_by",
                            "updated_at",
                        ],
                    )
            except IntegrityError as error:
                raise ValidationError(
                    {
                        "categoria_destino": (
                            "No se pudo completar la fusión porque la categoría "
                            "destino contiene productos incompatibles."
                        )
                    }
                ) from error

            for product, old_values in product_old_values:
                create_record_change_logs_from_snapshot(
                    instance=product,
                    old_values=old_values,
                    fields=CATEGORY_PRODUCT_MERGE_AUDIT_FIELDS,
                    user=user,
                    origin=AuditOrigin.MANUAL,
                    reason=motivo,
                    action=AuditAction.FUSIONAR,
                )

        destination.has_historical_usage = True
        destination.updated_by = operator
        destination.save(
            update_fields=[
                "has_historical_usage",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=destination,
            old_values=destination_old_values,
            fields=CATEGORY_MERGE_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.FUSIONAR,
        )

        source.status = BaseStatus.ARCHIVADO
        source.has_historical_usage = True
        source.merged_into = destination
        source.merged_at = now
        source.merged_by = operator
        source.merge_reason = motivo
        source.updated_by = operator
        source.save(
            update_fields=[
                "status",
                "has_historical_usage",
                "merged_into",
                "merged_at",
                "merged_by",
                "merge_reason",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=source,
            old_values=source_old_values,
            fields=CATEGORY_MERGE_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.FUSIONAR,
        )

        create_business_audit_log(
            instance=source,
            action=AuditAction.FUSIONAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "category_merge",
                "source_category_id": source.pk,
                "source_category_name": source.name,
                "destination_category_id": destination.pk,
                "destination_category_name": destination.name,
                "reassigned_product_count": len(products_to_move),
            },
            request=request,
        )

    return source, destination, len(products_to_move), False


def delete_category_safely(
    *,
    categoria,
    motivo,
    user=None,
    request=None,
):
    if categoria is None:
        raise ValidationError({"categoria": "La categoría es obligatoria."})

    motivo = _require_category_reason(motivo)

    with transaction.atomic():
        locked_category = Categoria.objects.select_for_update().get(pk=categoria.pk)

        if locked_category.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "categoria": (
                        "Solo se pueden eliminar categorías activas que nunca "
                        "hayan tenido uso histórico."
                    )
                }
            )

        if locked_category.has_historical_usage:
            raise ValidationError(
                {
                    "categoria": (
                        "La categoría no puede eliminarse porque tiene uso "
                        "histórico. Use renombrado o fusión."
                    )
                }
            )

        if locked_category.merged_into_id:
            raise ValidationError(
                {"categoria": ("Una categoría fusionada no puede eliminarse.")}
            )

        if locked_category.merged_categories.exists():
            raise ValidationError(
                {
                    "categoria": (
                        "La categoría no puede eliminarse porque es destino "
                        "de una fusión histórica."
                    )
                }
            )

        if (
            Producto.objects.select_for_update()
            .filter(categoria_id=locked_category.pk)
            .exists()
        ):
            raise ValidationError(
                {
                    "categoria": (
                        "La categoría no puede eliminarse porque todavía "
                        "tiene productos asociados."
                    )
                }
            )

        category_id = locked_category.pk
        category_name = locked_category.name

        create_business_audit_log(
            instance=locked_category,
            action=AuditAction.ELIMINAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "safe_category_delete",
                "category_id": category_id,
                "category_name": category_name,
            },
            request=request,
        )

        locked_category.delete()

    return {
        "id": category_id,
        "name": category_name,
    }


def resolve_or_create_product_category(
    *,
    categoria=None,
    categoria_nombre="",
    user=None,
    request=None,
):
    """
    Resuelve una categoría existente o crea una nueva dentro de la
    transacción del producto.

    Nunca deja una categoría huérfana si la creación del producto falla.
    """

    categoria_nombre = str(categoria_nombre or "").strip()
    has_category_id = categoria is not None
    has_category_name = bool(categoria_nombre)

    if has_category_id == has_category_name:
        raise ValidationError(
            {
                "categoria": (
                    "Debe indicar exactamente una categoría existente o un "
                    "nombre para crear una categoría nueva."
                )
            }
        )

    operator = get_operator(user)

    with transaction.atomic():
        if has_category_id:
            try:
                locked_category = Categoria.objects.select_for_update().get(
                    pk=categoria.pk
                )
            except Categoria.DoesNotExist as error:
                raise ValidationError(
                    {"categoria": "La categoría indicada ya no existe."}
                ) from error

            _require_available_category(
                locked_category,
                "categoria",
            )

            return locked_category, False

        category_normalized = normalize_text(categoria_nombre)

        if not category_normalized:
            raise ValidationError(
                {
                    "categoria_nombre": (
                        "El nombre de la nueva categoría es obligatorio."
                    )
                }
            )

        existing_category = (
            Categoria.objects.select_for_update()
            .filter(name_normalized=category_normalized)
            .first()
        )

        if existing_category:
            _require_available_category(
                existing_category,
                "categoria_nombre",
            )

            return existing_category, False

        try:
            with transaction.atomic():
                created_category = Categoria.objects.create(
                    name=categoria_nombre,
                    created_by=operator,
                    updated_by=operator,
                )
        except (IntegrityError, ValidationError):
            existing_category = (
                Categoria.objects.select_for_update()
                .filter(name_normalized=category_normalized)
                .first()
            )

            if not existing_category:
                raise

            _require_available_category(
                existing_category,
                "categoria_nombre",
            )

            return existing_category, False

        create_business_audit_log(
            instance=created_category,
            action=AuditAction.CREAR,
            user=user,
            origin=AuditOrigin.API,
            reason="Categoría creada junto con un producto.",
            metadata={
                "operation": "category_create_from_product",
                "category_name": created_category.name,
            },
            request=request,
        )

        return created_category, True


def create_product_with_category(
    *,
    product_data,
    categoria=None,
    categoria_nombre="",
    initial_stock=0,
    initial_stock_reason="",
    user=None,
    request=None,
):
    """
    Crea Producto y, cuando corresponde, una Categoría nueva como una
    única operación atómica.
    """

    with transaction.atomic():
        resolved_category, category_created = resolve_or_create_product_category(
            categoria=categoria,
            categoria_nombre=categoria_nombre,
            user=user,
            request=request,
        )

        product = Producto.objects.create(
            categoria=resolved_category,
            **dict(product_data),
        )

        if initial_stock > 0:
            register_manual_entry(
                producto=product,
                cantidad=initial_stock,
                motivo=initial_stock_reason,
                user=user,
                request=request,
            )

        create_business_audit_log(
            instance=product,
            action=AuditAction.CREAR,
            user=user,
            origin=AuditOrigin.API,
            reason="Producto creado.",
            metadata={
                "operation": "product_create",
                "category_id": resolved_category.pk,
                "category_name": resolved_category.name,
                "category_created_in_request": category_created,
                "product_origin": product.origen,
                "initial_stock": initial_stock,
            },
            request=request,
        )

    return product


def change_product_category(
    *,
    producto,
    categoria_destino,
    motivo="",
    user=None,
    request=None,
):
    if producto is None:
        raise ValidationError({"producto": "El producto es obligatorio."})

    if categoria_destino is None:
        raise ValidationError(
            {"categoria_destino": "La categoría destino es obligatoria."}
        )

    motivo = _require_category_reason(motivo)
    operator = get_operator(user)

    with transaction.atomic():
        locked_product = (
            Producto.objects.select_for_update()
            .select_related("categoria")
            .get(pk=producto.pk)
        )

        locked_destination_category = Categoria.objects.select_for_update().get(
            pk=categoria_destino.pk
        )

        _require_available_category(
            locked_destination_category,
            "categoria_destino",
        )

        if locked_product.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "status": (
                        "Debe reactivar el producto antes de cambiar su categoría."
                    )
                }
            )

        if locked_product.categoria_id == locked_destination_category.pk:
            raise ValidationError(
                {
                    "categoria_destino": (
                        "El producto ya pertenece a la categoría indicada."
                    )
                }
            )

        duplicate_model_exists = (
            Producto.objects.select_for_update()
            .exclude(pk=locked_product.pk)
            .filter(
                categoria=locked_destination_category,
                modelo_normalized=locked_product.modelo_normalized,
            )
            .exists()
        )

        if locked_product.modelo_normalized and duplicate_model_exists:
            raise ValidationError(
                {
                    "modelo": (
                        "Ya existe un producto con el mismo modelo en la categoría "
                        "destino. No se puede reclasificar porque generaría un "
                        "duplicado dentro de esa categoría."
                    )
                }
            )

        previous_category = locked_product.categoria

        old_values = capture_field_values(
            locked_product,
            PRODUCT_CATEGORY_CHANGE_AUDIT_FIELDS,
        )

        locked_product.categoria = locked_destination_category
        locked_product.updated_by = operator

        locked_product.save(
            update_fields=[
                "categoria",
                "updated_by",
                "updated_at",
            ]
        )

        Categoria.objects.filter(
            pk__in=[
                previous_category.pk,
                locked_destination_category.pk,
            ],
            has_historical_usage=False,
        ).update(has_historical_usage=True)

        create_record_change_logs_from_snapshot(
            instance=locked_product,
            old_values=old_values,
            fields=PRODUCT_CATEGORY_CHANGE_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.EDITAR,
        )

        create_business_audit_log(
            instance=locked_product,
            action=AuditAction.EDITAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "product_category_change",
                "previous_category_id": previous_category.pk,
                "previous_category_name": previous_category.name,
                "new_category_id": locked_destination_category.pk,
                "new_category_name": locked_destination_category.name,
            },
            request=request,
        )

    return locked_product


def change_product_origin(
    *,
    producto,
    origen,
    origen_observacion="",
    motivo="",
    user=None,
    request=None,
):
    if producto is None:
        raise ValidationError({"producto": "El producto es obligatorio."})

    origen = str(origen or "").strip().upper()
    origen_observacion = str(origen_observacion or "").strip()
    motivo = _require_category_reason(motivo)

    if origen not in ProductOrigin.values:
        raise ValidationError({"origen": "El origen del producto no es válido."})

    if origen == ProductOrigin.OTRO and not origen_observacion:
        raise ValidationError(
            {"origen_observacion": ("Debe explicar el origen cuando selecciona OTRO.")}
        )

    if origen != ProductOrigin.OTRO:
        origen_observacion = ""

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        if locked_product.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {"status": ("Debe reactivar el producto antes de cambiar su origen.")}
            )

        if (
            locked_product.origen == origen
            and locked_product.origen_observacion == origen_observacion
        ):
            raise ValidationError(
                {"origen": ("El producto ya tiene el origen y observación indicados.")}
            )

        old_values = capture_field_values(
            locked_product,
            PRODUCT_ORIGIN_AUDIT_FIELDS,
        )

        previous_origin = locked_product.origen

        locked_product.origen = origen
        locked_product.origen_observacion = origen_observacion
        locked_product.updated_by = get_operator(user)

        locked_product.save(
            update_fields=[
                "origen",
                "origen_observacion",
                "controla_stock",
                "stock_critico",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_product,
            old_values=old_values,
            fields=PRODUCT_ORIGIN_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.CAMBIAR_ORIGEN,
        )

        create_business_audit_log(
            instance=locked_product,
            action=AuditAction.CAMBIAR_ORIGEN,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "product_origin_change",
                "previous_origin": previous_origin,
                "new_origin": locked_product.origen,
            },
            request=request,
        )

    return locked_product


def build_reference_data(reference):
    if reference is None:
        return {
            "reference_content_type": None,
            "reference_object_id": "",
            "reference_repr": "",
        }

    return {
        "reference_content_type": ContentType.objects.get_for_model(
            reference,
            for_concrete_model=False,
        ),
        "reference_object_id": str(reference.pk),
        "reference_repr": str(reference)[:255],
    }


def register_kardex_movement(
    *,
    producto,
    movement_type,
    cantidad,
    motivo,
    user=None,
    origin=AuditOrigin.MANUAL,
    reference=None,
    request=None,
):
    """
    Única entrada oficial para modificar stock.

    Regla:
    - No se edita Producto.stock_actual directamente desde vistas o serializers.
    - Todo cambio de stock crea MovimientoKardex.
    - La operación es atómica: producto y Kardex se guardan juntos o no se guarda nada.
    """

    if producto is None:
        raise ValidationError({"producto": "El producto es obligatorio."})

    if not motivo or not str(motivo).strip():
        raise ValidationError({"motivo": "El motivo del movimiento es obligatorio."})

    if cantidad == 0:
        raise ValidationError(
            {"cantidad": "La cantidad del movimiento no puede ser cero."}
        )

    if (
        movement_type
        in [
            KardexMovementType.ENTRADA_IMPORTACION,
            KardexMovementType.ENTRADA_MANUAL,
            KardexMovementType.ENTRADA_RECEPCION,
            KardexMovementType.REVERSA_ANULACION,
        ]
        and cantidad <= 0
    ):
        raise ValidationError(
            {"cantidad": "Este tipo de movimiento debe tener cantidad positiva."}
        )

    if movement_type == KardexMovementType.SALIDA_VENTA and cantidad >= 0:
        raise ValidationError(
            {"cantidad": "La salida por venta debe registrarse con cantidad negativa."}
        )

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": "Este producto no controla stock y no debe generar Kardex."
                }
            )

        if locked_product.status != BaseStatus.ACTIVO:
            raise ValidationError(
                {
                    "producto": (
                        "El producto debe estar activo para registrar movimientos "
                        "de inventario."
                    )
                }
            )

        if locked_product.descontinuado and movement_type in [
            KardexMovementType.ENTRADA_MANUAL,
            KardexMovementType.ENTRADA_IMPORTACION,
        ]:
            raise ValidationError(
                {
                    "producto": (
                        "No se pueden registrar nuevas entradas de stock para un "
                        "producto descontinuado."
                    )
                }
            )

        stock_antes = locked_product.stock_actual
        stock_despues = stock_antes + cantidad

        if stock_despues < 0:
            raise ValidationError(
                {
                    "stock": (
                        "Stock insuficiente. "
                        f"Solicitado: {abs(cantidad)}. "
                        f"Disponible: {stock_antes}."
                    )
                }
            )

        locked_product.stock_actual = stock_despues
        locked_product.updated_by = get_operator(user)

        with allow_stock_write():
            locked_product.save(
                update_fields=[
                    "stock_actual",
                    "updated_by",
                    "updated_at",
                ]
            )

        reference_data = build_reference_data(reference)

        movement = MovimientoKardex(
            producto=locked_product,
            movement_type=movement_type,
            origin=origin,
            operador=get_operator(user),
            cantidad=cantidad,
            stock_antes=stock_antes,
            stock_despues=stock_despues,
            motivo=str(motivo).strip(),
            created_by=get_operator(user),
            updated_by=get_operator(user),
            **reference_data,
        )
        with allow_kardex_write():
            movement.save()

        create_business_audit_log(
            instance=movement,
            action=KARDEX_AUDIT_ACTION_BY_TYPE.get(
                movement_type,
                AuditAction.CREAR,
            ),
            user=user,
            origin=origin,
            reason=movement.motivo,
            metadata={
                "operation": "kardex_movement",
                "product_id": locked_product.pk,
                "product_model": locked_product.modelo,
                "movement_type": movement.movement_type,
                "quantity": movement.cantidad,
                "stock_before": movement.stock_antes,
                "stock_after": movement.stock_despues,
                "reference_content_type_id": (movement.reference_content_type_id),
                "reference_object_id": movement.reference_object_id,
                "reference_repr": movement.reference_repr,
            },
            request=request,
        )

        return movement


def register_manual_entry(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    request=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.ENTRADA_MANUAL,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.MANUAL,
        request=request,
    )


def register_inventory_adjustment(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    request=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.AJUSTE_INVENTARIO,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.MANUAL,
        request=request,
    )


def register_sale_exit(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    reference=None,
    request=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.SALIDA_VENTA,
        cantidad=-abs(cantidad),
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
        request=request,
    )


def register_sale_annulment_reverse(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    reference=None,
    request=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.REVERSA_ANULACION,
        cantidad=abs(cantidad),
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
        request=request,
    )


def register_sale_difference_adjustment(
    *,
    producto,
    cantidad,
    motivo,
    user=None,
    reference=None,
    request=None,
):
    return register_kardex_movement(
        producto=producto,
        movement_type=KardexMovementType.AJUSTE_INVENTARIO,
        cantidad=cantidad,
        motivo=motivo,
        user=user,
        origin=AuditOrigin.AUTOMATICO,
        reference=reference,
        request=request,
    )


def change_product_lifecycle(
    *,
    producto,
    accion,
    motivo,
    user=None,
    request=None,
):
    accion = str(accion or "").strip().upper()
    motivo = str(motivo or "").strip()

    if accion not in PRODUCT_LIFECYCLE_AUDIT_ACTIONS:
        raise ValidationError(
            {"accion": "La acción de ciclo de vida indicada no es válida."}
        )

    if not motivo:
        raise ValidationError(
            {"motivo": "El motivo del cambio de estado es obligatorio."}
        )

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        has_open_pending_receipts = PendientePorRecibir.objects.filter(
            producto_id=locked_product.pk,
            estado__in=ESTADOS_PENDIENTE_POR_RECIBIR_ABIERTOS,
        ).exists()

        old_values = capture_field_values(
            locked_product,
            PRODUCT_LIFECYCLE_AUDIT_FIELDS,
        )

        audit_action = PRODUCT_LIFECYCLE_AUDIT_ACTIONS[accion]

        if accion == "INACTIVAR":
            if locked_product.status != BaseStatus.ACTIVO:
                raise ValidationError(
                    {"accion": ("Solo se puede inactivar un producto que está activo.")}
                )

            if locked_product.stock_actual != 0 or has_open_pending_receipts:
                raise ValidationError(
                    {
                        "status": (
                            "No se puede inactivar un producto con stock físico "
                            "o unidades pendientes por recibir."
                        )
                    }
                )

            locked_product.status = BaseStatus.INACTIVO
            locked_product.descontinuado = False

        elif accion == "ARCHIVAR":
            if locked_product.status != BaseStatus.INACTIVO:
                raise ValidationError(
                    {
                        "accion": (
                            "Solo se puede archivar un producto que ya está inactivo."
                        )
                    }
                )

            if locked_product.stock_actual != 0 or has_open_pending_receipts:
                raise ValidationError(
                    {
                        "status": (
                            "No se puede archivar un producto con stock físico "
                            "o unidades pendientes por recibir."
                        )
                    }
                )

            locked_product.status = BaseStatus.ARCHIVADO
            locked_product.descontinuado = False

        elif accion == "REACTIVAR":
            if locked_product.status not in [
                BaseStatus.INACTIVO,
                BaseStatus.ARCHIVADO,
            ]:
                raise ValidationError(
                    {
                        "accion": (
                            "Solo se pueden reactivar productos inactivos o archivados."
                        )
                    }
                )

            locked_product.status = BaseStatus.ACTIVO
            locked_product.descontinuado = False

        elif accion == "DESCONTINUAR":
            if locked_product.status != BaseStatus.ACTIVO:
                raise ValidationError(
                    {
                        "accion": (
                            "Solo se puede descontinuar un producto que está activo."
                        )
                    }
                )

            if locked_product.descontinuado:
                raise ValidationError(
                    {"accion": "El producto ya se encuentra descontinuado."}
                )

            locked_product.descontinuado = True

        elif accion == "REANUDAR":
            if locked_product.status != BaseStatus.ACTIVO:
                raise ValidationError(
                    {"accion": ("Debe reactivar el producto antes de reanudarlo.")}
                )

            if not locked_product.descontinuado:
                raise ValidationError(
                    {"accion": "El producto no se encuentra descontinuado."}
                )

            locked_product.descontinuado = False

        locked_product.updated_by = get_operator(user)
        locked_product.save(
            update_fields=[
                "status",
                "descontinuado",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_product,
            old_values=old_values,
            fields=PRODUCT_LIFECYCLE_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=audit_action,
        )

        create_business_audit_log(
            instance=locked_product,
            action=audit_action,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "product_lifecycle_change",
                "lifecycle_action": accion,
                "previous_status": old_values["status"],
                "new_status": locked_product.status,
                "previous_discontinued": old_values["descontinuado"],
                "new_discontinued": str(locked_product.descontinuado),
            },
            request=request,
        )

    return locked_product, audit_action


def create_pending_receipt(
    *,
    producto,
    cantidad,
    motivo="",
    referencia="",
    user=None,
    request=None,
):
    motivo = str(motivo or "").strip()
    referencia = str(referencia or "").strip()

    if cantidad <= 0:
        raise ValidationError(
            {"cantidad": "La cantidad por recibir debe ser positiva."}
        )

    if not motivo and not referencia:
        raise ValidationError(
            {
                "motivo": (
                    "Debe indicar un motivo o una referencia para registrar "
                    "un pendiente por recibir."
                )
            }
        )

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(pk=producto.pk)

        if locked_product.status != BaseStatus.ACTIVO or locked_product.descontinuado:
            raise ValidationError(
                {
                    "producto": (
                        "Solo se pueden registrar unidades por recibir para "
                        "productos activos y no descontinuados."
                    )
                }
            )

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": (
                        "Este producto no maneja inventario y no puede registrar "
                        "unidades por recibir."
                    )
                }
            )

        pending_receipt = PendientePorRecibir.objects.create(
            producto=locked_product,
            cantidad_original=cantidad,
            referencia=referencia,
            motivo=motivo,
            created_by=get_operator(user),
            updated_by=get_operator(user),
        )

        create_business_audit_log(
            instance=pending_receipt,
            action=AuditAction.CREAR,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo or referencia,
            metadata={
                "operation": "pending_receipt_create",
                "product_id": locked_product.pk,
                "product_model": locked_product.modelo,
                "original_quantity": pending_receipt.cantidad_original,
                "reference": pending_receipt.referencia,
                "initial_status": pending_receipt.estado,
            },
            request=request,
        )

    return pending_receipt


def receive_pending_receipt(
    *,
    pending_receipt,
    cantidad,
    motivo,
    user=None,
    request=None,
):
    motivo = str(motivo or "").strip()

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad recibida debe ser positiva."})

    if not motivo:
        raise ValidationError({"motivo": "El motivo de la recepción es obligatorio."})

    with transaction.atomic():
        pending_product_id = pending_receipt.producto_id

        locked_product = Producto.objects.select_for_update().get(pk=pending_product_id)

        locked_pending_receipt = (
            PendientePorRecibir.objects.select_for_update()
            .select_related("producto")
            .get(pk=pending_receipt.pk)
        )

        if locked_pending_receipt.producto_id != locked_product.pk:
            raise ValidationError(
                {
                    "producto": (
                        "La recepción pendiente no corresponde al producto indicado."
                    )
                }
            )

        if not locked_product.controla_stock:
            raise ValidationError(
                {
                    "producto": (
                        "Este producto no maneja inventario y no puede "
                        "recibir stock físico."
                    )
                }
            )

        if cantidad > locked_pending_receipt.cantidad_pendiente:
            raise ValidationError(
                {
                    "cantidad": (
                        "La cantidad recibida no puede superar las "
                        "unidades pendientes. "
                        f"Pendiente actual: "
                        f"{locked_pending_receipt.cantidad_pendiente}."
                    )
                }
            )

        old_values = capture_field_values(
            locked_pending_receipt,
            PENDING_RECEIPT_AUDIT_FIELDS,
        )

        pending_before = locked_pending_receipt.cantidad_pendiente

        movement = register_kardex_movement(
            producto=locked_product,
            movement_type=KardexMovementType.ENTRADA_RECEPCION,
            cantidad=cantidad,
            motivo=motivo,
            user=user,
            origin=AuditOrigin.MANUAL,
            reference=locked_pending_receipt,
            request=request,
        )

        locked_pending_receipt.cantidad_recibida += cantidad
        locked_pending_receipt.updated_by = get_operator(user)
        locked_pending_receipt.save(
            update_fields=[
                "cantidad_recibida",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_pending_receipt,
            old_values=old_values,
            fields=PENDING_RECEIPT_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.CAMBIAR_ESTADO,
        )

        create_business_audit_log(
            instance=locked_pending_receipt,
            action=AuditAction.CAMBIAR_ESTADO,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "pending_receipt_receive",
                "product_id": locked_product.pk,
                "product_model": locked_product.modelo,
                "kardex_movement_id": movement.pk,
                "received_quantity": cantidad,
                "received_before": int(old_values.get("cantidad_recibida") or 0),
                "received_after": (locked_pending_receipt.cantidad_recibida),
                "pending_before": pending_before,
                "pending_after": (locked_pending_receipt.cantidad_pendiente),
                "previous_status": old_values.get("estado", ""),
                "new_status": locked_pending_receipt.estado,
            },
            request=request,
        )

    return locked_pending_receipt, movement


def cancel_pending_receipt(
    *,
    pending_receipt,
    cantidad,
    motivo,
    user=None,
    request=None,
):
    motivo = str(motivo or "").strip()

    if cantidad <= 0:
        raise ValidationError({"cantidad": "La cantidad a cancelar debe ser positiva."})

    if not motivo:
        raise ValidationError({"motivo": "El motivo de la cancelación es obligatorio."})

    with transaction.atomic():
        locked_product = Producto.objects.select_for_update().get(
            pk=pending_receipt.producto_id
        )

        locked_pending_receipt = (
            PendientePorRecibir.objects.select_for_update()
            .select_related("producto")
            .get(pk=pending_receipt.pk)
        )

        if locked_pending_receipt.producto_id != locked_product.pk:
            raise ValidationError(
                {
                    "producto": (
                        "La recepción pendiente no corresponde al producto indicado."
                    )
                }
            )

        if cantidad > locked_pending_receipt.cantidad_pendiente:
            raise ValidationError(
                {
                    "cantidad": (
                        "La cantidad cancelada no puede superar las "
                        "unidades pendientes. "
                        f"Pendiente actual: "
                        f"{locked_pending_receipt.cantidad_pendiente}."
                    )
                }
            )

        old_values = capture_field_values(
            locked_pending_receipt,
            PENDING_RECEIPT_AUDIT_FIELDS,
        )

        pending_before = locked_pending_receipt.cantidad_pendiente

        locked_pending_receipt.cantidad_cancelada += cantidad
        locked_pending_receipt.updated_by = get_operator(user)
        locked_pending_receipt.save(
            update_fields=[
                "cantidad_cancelada",
                "updated_by",
                "updated_at",
            ]
        )

        create_record_change_logs_from_snapshot(
            instance=locked_pending_receipt,
            old_values=old_values,
            fields=PENDING_RECEIPT_AUDIT_FIELDS,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            action=AuditAction.CAMBIAR_ESTADO,
        )

        create_business_audit_log(
            instance=locked_pending_receipt,
            action=AuditAction.CAMBIAR_ESTADO,
            user=user,
            origin=AuditOrigin.MANUAL,
            reason=motivo,
            metadata={
                "operation": "pending_receipt_cancel",
                "product_id": locked_product.pk,
                "product_model": locked_product.modelo,
                "cancelled_quantity": cantidad,
                "cancelled_before": int(old_values.get("cantidad_cancelada") or 0),
                "cancelled_after": (locked_pending_receipt.cantidad_cancelada),
                "pending_before": pending_before,
                "pending_after": (locked_pending_receipt.cantidad_pendiente),
                "previous_status": old_values.get("estado", ""),
                "new_status": locked_pending_receipt.estado,
            },
            request=request,
        )

    return locked_pending_receipt
