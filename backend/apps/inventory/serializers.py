from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiTypes, extend_schema_field
from rest_framework import serializers

from apps.core.models import BaseStatus

from .models import (
    Categoria,
    InventoryLocation,
    InventoryLocationType,
    InventoryTransfer,
    MovimientoKardex,
    PendientePorRecibir,
    ProductLocationBalance,
    Producto,
    ProductOrigin,
)
from .services import create_product_with_category, update_product_details


class CategoriaSerializer(serializers.ModelSerializer):
    is_merged = serializers.BooleanField(read_only=True)
    is_available_for_products = serializers.BooleanField(read_only=True)
    merged_into_name = serializers.SerializerMethodField()
    productos_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Categoria
        fields = [
            "id",
            "name",
            "name_normalized",
            "description",
            "status",
            "has_historical_usage",
            "merged_into",
            "merged_into_name",
            "merged_at",
            "merged_by",
            "merge_reason",
            "is_merged",
            "is_available_for_products",
            "productos_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "name_normalized",
            "status",
            "has_historical_usage",
            "merged_into",
            "merged_at",
            "merged_by",
            "merge_reason",
            "is_merged",
            "is_available_for_products",
            "productos_count",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        protected_fields = {
            "status",
            "has_historical_usage",
            "merged_into",
            "merged_at",
            "merged_by",
            "merge_reason",
        }

        attempted_protected_fields = protected_fields.intersection(
            self.initial_data.keys()
        )

        if attempted_protected_fields:
            raise serializers.ValidationError(
                {
                    field_name: (
                        "Este campo solo puede cambiarse mediante una operación "
                        "controlada de categorías."
                    )
                    for field_name in attempted_protected_fields
                }
            )

        if self.instance and "name" in attrs:
            requested_name = str(attrs["name"] or "").strip()

            if requested_name != self.instance.name:
                raise serializers.ValidationError(
                    {
                        "name": (
                            "El nombre solo puede modificarse mediante la acción "
                            "controlada de renombrado."
                        )
                    }
                )

        return attrs

    @extend_schema_field(OpenApiTypes.STR)
    def get_merged_into_name(self, obj):
        if not obj.merged_into:
            return ""

        return obj.merged_into.name


def raise_serializer_validation_error(error):
    if hasattr(error, "message_dict"):
        raise serializers.ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise serializers.ValidationError(error.messages)

    raise serializers.ValidationError(str(error))


class ProductoSerializer(serializers.ModelSerializer):
    categoria = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
        required=False,
    )
    categoria_nombre = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        max_length=150,
    )
    categoria_name = serializers.CharField(
        source="categoria.name",
        read_only=True,
    )

    origen = serializers.ChoiceField(
        choices=ProductOrigin.choices,
        required=False,
    )
    origen_observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )

    stock = serializers.SerializerMethodField()
    por_recibir = serializers.SerializerMethodField()

    stock_inicial = serializers.IntegerField(
        write_only=True,
        required=False,
        min_value=0,
        default=0,
    )
    motivo_stock_inicial = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=255,
    )
    ubicacion_stock_inicial = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    motivo_codigo_sap = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=255,
    )

    stock_status = serializers.SerializerMethodField()
    estado_producto = serializers.SerializerMethodField()
    estado_producto_display = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            "id",
            "categoria",
            "categoria_nombre",
            "categoria_name",
            "modelo",
            "modelo_normalized",
            "detalle",
            "codigo_sap",
            "codigo_sap_normalized",
            "origen",
            "origen_observacion",
            "stock",
            "stock_actual",
            "stock_critico",
            "por_recibir",
            "controla_stock",
            "descontinuado",
            "stock_status",
            "estado_producto",
            "estado_producto_display",
            "status",
            "stock_inicial",
            "motivo_stock_inicial",
            "ubicacion_stock_inicial",
            "motivo_codigo_sap",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "categoria_name",
            "modelo_normalized",
            "codigo_sap_normalized",
            "stock",
            "stock_actual",
            "stock_status",
            "por_recibir",
            "descontinuado",
            "status",
            "estado_producto",
            "estado_producto_display",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        is_create = self.instance is None
        validation_errors = {}

        protected_fields = {
            "status",
            "descontinuado",
        }

        if not is_create:
            protected_fields.update(
                {
                    "origen",
                    "origen_observacion",
                }
            )

        attempted_protected_fields = protected_fields.intersection(
            self.initial_data.keys()
        )

        if attempted_protected_fields:
            validation_errors.update(
                {
                    field_name: (
                        "Este campo solo puede modificarse mediante una acción "
                        "controlada del producto."
                    )
                    for field_name in attempted_protected_fields
                }
            )

        if self.instance and self.instance.status != BaseStatus.ACTIVO:
            validation_errors["status"] = (
                "Debe reactivar el producto antes de modificar su ficha."
            )

        category = attrs.get("categoria")
        category_name = str(attrs.get("categoria_nombre", "") or "").strip()

        if is_create:
            if "origen" not in self.initial_data:
                validation_errors["origen"] = (
                    "El origen es obligatorio al crear un producto."
                )

            if bool(category) == bool(category_name):
                validation_errors["categoria"] = (
                    "Debe indicar una categoría existente o un nombre para "
                    "crear una categoría nueva."
                )
        elif (
            "categoria" in self.initial_data or "categoria_nombre" in self.initial_data
        ):
            validation_errors["categoria"] = (
                "La categoría no puede modificarse desde la edición general del "
                "producto. La reclasificación debe realizarse mediante una acción "
                "controlada y auditada."
            )

        origin = attrs.get(
            "origen",
            self.instance.origen if self.instance else None,
        )

        origin_observation = str(attrs.get("origen_observacion", "") or "").strip()

        if is_create and origin == ProductOrigin.OTRO and not origin_observation:
            validation_errors["origen_observacion"] = (
                "Debe explicar el origen cuando selecciona OTRO."
            )

        initial_stock = attrs.get("stock_inicial", 0)

        if is_create and origin == ProductOrigin.SERVICIO:
            attrs["controla_stock"] = False
            attrs["stock_critico"] = 0

            if initial_stock > 0:
                validation_errors["stock_inicial"] = (
                    "Un producto de tipo SERVICIO no puede tener stock inicial."
                )

        controla_stock = attrs.get(
            "controla_stock",
            self.instance.controla_stock if self.instance else True,
        )

        if self.instance and "stock_inicial" in self.initial_data:
            validation_errors["stock_inicial"] = (
                "El stock inicial solo se puede registrar al crear un producto. "
                "Para cambios posteriores use Gestionar inventario."
            )

        if self.instance and "codigo_sap" in self.initial_data:
            previous_sap_code = str(self.instance.codigo_sap or "").strip()
            next_sap_code = str(
                attrs.get("codigo_sap", self.instance.codigo_sap) or ""
            ).strip()

            if (
                next_sap_code != previous_sap_code
                and not str(attrs.get("motivo_codigo_sap", "") or "").strip()
            ):
                validation_errors["motivo_codigo_sap"] = (
                    "El motivo es obligatorio cuando cambia el Código SAP."
                )

        if initial_stock > 0 and not controla_stock:
            validation_errors["stock_inicial"] = (
                "Un producto que no maneja inventario no puede tener stock inicial."
            )

        if (
            initial_stock > 0
            and not str(attrs.get("motivo_stock_inicial", "") or "").strip()
        ):
            validation_errors["motivo_stock_inicial"] = (
                "El motivo del stock inicial es obligatorio cuando la cantidad "
                "es mayor a cero."
            )

        if validation_errors:
            raise serializers.ValidationError(validation_errors)

        return attrs

    def create(self, validated_data):
        validated_data.pop("motivo_codigo_sap", None)
        initial_stock = validated_data.pop("stock_inicial", 0)
        initial_location = validated_data.pop(
            "ubicacion_stock_inicial",
            None,
        )

        initial_stock_reason = str(
            validated_data.pop("motivo_stock_inicial", "") or ""
        ).strip()

        categoria = validated_data.pop("categoria", None)
        categoria_nombre = validated_data.pop("categoria_nombre", "")

        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        try:
            product = create_product_with_category(
                product_data=validated_data,
                categoria=categoria,
                categoria_nombre=categoria_nombre,
                initial_stock=initial_stock,
                initial_stock_reason=initial_stock_reason,
                initial_location=initial_location,
                user=user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_serializer_validation_error(error)

        if request:
            django_request = getattr(request, "_request", request)
            django_request.skip_activity_audit = True

        return product

    def update(self, instance, validated_data):
        sap_change_reason = str(
            validated_data.pop("motivo_codigo_sap", "") or ""
        ).strip()
        validated_data.pop("updated_by", None)

        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        try:
            product = update_product_details(
                producto=instance,
                product_data=validated_data,
                motivo_codigo_sap=sap_change_reason,
                user=user,
                request=getattr(request, "_request", request),
            )
        except DjangoValidationError as error:
            raise_serializer_validation_error(error)

        if request:
            django_request = getattr(request, "_request", request)
            django_request.skip_activity_audit = True

        return product

    @extend_schema_field(OpenApiTypes.INT)
    def get_stock(self, obj):
        return obj.stock_actual

    @extend_schema_field(OpenApiTypes.INT)
    def get_por_recibir(self, obj):
        if hasattr(obj, "por_recibir_total"):
            return obj.por_recibir_total

        return sum(
            pendiente.cantidad_pendiente
            for pendiente in obj.pendientes_por_recibir.filter(
                estado__in=["PENDIENTE", "PARCIAL"]
            )
        )

    @extend_schema_field(OpenApiTypes.STR)
    def get_stock_status(self, obj):
        return obj.stock_status

    @extend_schema_field(OpenApiTypes.STR)
    def get_estado_producto(self, obj):
        return obj.estado_producto

    @extend_schema_field(OpenApiTypes.STR)
    def get_estado_producto_display(self, obj):
        return obj.estado_producto_display


class MovimientoKardexSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.SerializerMethodField()
    producto_categoria = serializers.SerializerMethodField()
    producto_codigo_sap = serializers.SerializerMethodField()
    operador_nombre = serializers.SerializerMethodField()
    movement_type_display = serializers.CharField(
        source="get_movement_type_display",
        read_only=True,
    )
    origin_display = serializers.CharField(source="get_origin_display", read_only=True)
    reference = serializers.SerializerMethodField()
    ubicacion_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoKardex
        fields = [
            "id",
            "producto",
            "producto_modelo",
            "producto_categoria",
            "producto_codigo_sap",
            "movement_type",
            "movement_type_display",
            "origin",
            "origin_display",
            "operador",
            "operador_nombre",
            "location",
            "ubicacion_nombre",
            "cantidad",
            "stock_antes",
            "stock_despues",
            "motivo",
            "reference_content_type",
            "reference_object_id",
            "reference_repr",
            "reference",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_modelo(self, obj):
        return obj.producto_modelo_snapshot or obj.producto.modelo

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_categoria(self, obj):
        return obj.producto_categoria_snapshot or obj.producto.categoria.name

    @extend_schema_field(OpenApiTypes.STR)
    def get_producto_codigo_sap(self, obj):
        return obj.producto_codigo_sap_snapshot or obj.producto.codigo_sap

    @extend_schema_field(OpenApiTypes.STR)
    def get_operador_nombre(self, obj):
        if not obj.operador:
            return ""

        return obj.operador.get_full_name().strip() or obj.operador.username

    @extend_schema_field(OpenApiTypes.STR)
    def get_ubicacion_nombre(self, obj):
        if obj.location_name_snapshot:
            return obj.location_name_snapshot
        if obj.location:
            return obj.location.name
        return "No informada históricamente"

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_reference(self, obj):
        if not obj.reference_object_id:
            return None

        return {
            "content_type": obj.reference_content_type_id,
            "object_id": obj.reference_object_id,
            "repr": obj.reference_repr,
        }


class ManualStockEntrySerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(max_length=255)
    ubicacion = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class InventoryAdjustmentSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField()
    motivo = serializers.CharField(max_length=255)
    ubicacion = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(),
        required=True,
        allow_null=False,
    )

    def validate_cantidad(self, value):
        if value == 0:
            raise serializers.ValidationError(
                "La cantidad del ajuste no puede ser cero."
            )

        return value

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class ProductoLifecycleActionSerializer(serializers.Serializer):
    accion = serializers.ChoiceField(
        choices=[
            ("INACTIVAR", "Inactivar"),
            ("ARCHIVAR", "Archivar"),
            ("REACTIVAR", "Reactivar"),
            ("DESCONTINUAR", "Descontinuar"),
            ("REANUDAR", "Reanudar"),
        ]
    )
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo del cambio de estado es obligatorio."
            )

        return value


class ProductoCategoriaChangeSerializer(serializers.Serializer):
    categoria_destino = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all(),
    )
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = str(value or "").strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo del cambio de categoría es obligatorio."
            )

        return value


class ProductoOrigenChangeSerializer(serializers.Serializer):
    origen = serializers.ChoiceField(
        choices=ProductOrigin.choices,
    )
    origen_observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
    motivo = serializers.CharField(max_length=255)

    def validate(self, attrs):
        origen = attrs["origen"]
        observacion = str(attrs.get("origen_observacion", "") or "").strip()
        motivo = str(attrs.get("motivo", "") or "").strip()

        if origen == ProductOrigin.OTRO and not observacion:
            raise serializers.ValidationError(
                {
                    "origen_observacion": (
                        "Debe explicar el origen cuando selecciona OTRO."
                    )
                }
            )

        if not motivo:
            raise serializers.ValidationError(
                {"motivo": ("El motivo del cambio de origen es obligatorio.")}
            )

        attrs["origen_observacion"] = observacion
        attrs["motivo"] = motivo

        return attrs


class CategoriaRenameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    motivo = serializers.CharField(max_length=255)

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El nuevo nombre de la categoría es obligatorio."
            )

        return value

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo del renombrado es obligatorio."
            )

        return value


class CategoriaMergeSerializer(serializers.Serializer):
    categoria_destino = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.all()
    )
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo de la fusión es obligatorio.")

        return value


class CategoriaDeleteSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "El motivo de la eliminación es obligatorio."
            )

        return value


class CrearPendientePorRecibirSerializer(serializers.Serializer):
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    ubicacion_destino = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all(),
        required=False,
        allow_null=True,
    )
    cantidad = serializers.IntegerField(min_value=1)
    referencia = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )
    motivo = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def validate(self, attrs):
        if (
            not attrs.get("motivo", "").strip()
            and not attrs.get("referencia", "").strip()
        ):
            raise serializers.ValidationError(
                {
                    "motivo": (
                        "Debe indicar un motivo o una referencia para registrar "
                        "un pendiente por recibir."
                    )
                }
            )

        return attrs


class OperacionPendientePorRecibirSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(max_length=255)

    def validate_motivo(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")

        return value


class PendientePorRecibirSerializer(serializers.ModelSerializer):
    producto_modelo = serializers.CharField(
        source="producto.modelo",
        read_only=True,
    )
    producto_categoria = serializers.CharField(
        source="producto.categoria.name",
        read_only=True,
    )
    producto_codigo_sap = serializers.CharField(
        source="producto.codigo_sap",
        read_only=True,
    )
    cantidad_pendiente = serializers.IntegerField(read_only=True)
    estado_display = serializers.CharField(
        source="get_estado_display",
        read_only=True,
    )
    created_by_nombre = serializers.SerializerMethodField()
    updated_by_nombre = serializers.SerializerMethodField()
    ubicacion_destino_nombre = serializers.CharField(
        source="destination_location.name",
        read_only=True,
    )

    class Meta:
        model = PendientePorRecibir
        fields = [
            "id",
            "producto",
            "producto_modelo",
            "producto_categoria",
            "producto_codigo_sap",
            "destination_location",
            "ubicacion_destino_nombre",
            "cantidad_original",
            "cantidad_recibida",
            "cantidad_cancelada",
            "cantidad_pendiente",
            "estado",
            "estado_display",
            "referencia",
            "motivo",
            "status",
            "created_by",
            "created_by_nombre",
            "updated_by",
            "updated_by_nombre",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_created_by_nombre(self, obj):
        if not obj.created_by:
            return ""

        return obj.created_by.get_full_name().strip() or obj.created_by.username

    @extend_schema_field(OpenApiTypes.STR)
    def get_updated_by_nombre(self, obj):
        if not obj.updated_by:
            return ""

        return obj.updated_by.get_full_name().strip() or obj.updated_by.username


class InventoryLocationSerializer(serializers.ModelSerializer):
    location_type_display = serializers.CharField(
        source="get_location_type_display",
        read_only=True,
    )
    custodian_name = serializers.CharField(
        source="custodian.full_name",
        read_only=True,
        default="",
    )
    total_units = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = InventoryLocation
        fields = [
            "id",
            "name",
            "location_type",
            "location_type_display",
            "custodian",
            "custodian_name",
            "city",
            "description",
            "is_regularization",
            "total_units",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "location_type_display",
            "custodian_name",
            "is_regularization",
            "total_units",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        if {"status", "is_regularization"}.intersection(self.initial_data):
            raise serializers.ValidationError(
                {
                    "status": (
                        "El estado sólo puede cambiar mediante una operación "
                        "controlada de ubicación."
                    )
                }
            )

        location_type = attrs.get(
            "location_type",
            self.instance.location_type if self.instance else None,
        )
        custodian = attrs.get(
            "custodian",
            self.instance.custodian if self.instance else None,
        )
        if (
            location_type == InventoryLocationType.DOMICILIO_CUSTODIA
            and custodian is None
        ):
            raise serializers.ValidationError(
                {
                    "custodian": (
                        "Un domicilio bajo custodia debe indicar al "
                        "colaborador responsable."
                    )
                }
            )
        if (
            location_type != InventoryLocationType.DOMICILIO_CUSTODIA
            and custodian is not None
        ):
            raise serializers.ValidationError(
                {
                    "custodian": (
                        "El custodio sólo corresponde a domicilios bajo "
                        "custodia."
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        try:
            return super().create(validated_data)
        except DjangoValidationError as error:
            raise_serializer_validation_error(error)

    def update(self, instance, validated_data):
        if instance.is_regularization:
            protected_changes = {
                field
                for field in ("name", "location_type", "custodian")
                if field in validated_data
                and getattr(instance, field) != validated_data[field]
            }
            if protected_changes:
                raise serializers.ValidationError(
                    {
                        field: (
                            "La identidad de la ubicación histórica de "
                            "regularización no puede modificarse."
                        )
                        for field in protected_changes
                    }
                )
        try:
            return super().update(instance, validated_data)
        except DjangoValidationError as error:
            raise_serializer_validation_error(error)


class ProductLocationBalanceSerializer(serializers.ModelSerializer):
    product_model = serializers.CharField(
        source="product.modelo",
        read_only=True,
    )
    product_sap_code = serializers.CharField(
        source="product.codigo_sap",
        read_only=True,
    )
    product_category = serializers.CharField(
        source="product.categoria.name",
        read_only=True,
    )
    location_name = serializers.CharField(
        source="location.name",
        read_only=True,
    )
    location_type = serializers.CharField(
        source="location.location_type",
        read_only=True,
    )

    class Meta:
        model = ProductLocationBalance
        fields = [
            "id",
            "product",
            "product_model",
            "product_sap_code",
            "product_category",
            "location",
            "location_name",
            "location_type",
            "quantity",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class InventoryTransferSerializer(serializers.ModelSerializer):
    product_model = serializers.CharField(
        source="product.modelo",
        read_only=True,
    )
    product_sap_code = serializers.CharField(
        source="product.codigo_sap",
        read_only=True,
    )
    product_category = serializers.CharField(
        source="product.categoria.name",
        read_only=True,
    )
    origin_location_name = serializers.CharField(
        source="origin_location.name",
        read_only=True,
    )
    destination_location_name = serializers.CharField(
        source="destination_location.name",
        read_only=True,
    )
    responsible_name = serializers.SerializerMethodField()

    class Meta:
        model = InventoryTransfer
        fields = [
            "id",
            "product",
            "product_model",
            "product_sap_code",
            "product_category",
            "origin_location",
            "origin_location_name",
            "destination_location",
            "destination_location_name",
            "quantity",
            "responsible",
            "responsible_name",
            "reason",
            "evidence_reference",
            "transferred_at",
            "status",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.STR)
    def get_responsible_name(self, obj):
        return (
            obj.responsible.get_full_name().strip()
            or obj.responsible.username
        )


class InventoryTransferCreateSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all()
    )
    origin_location = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all()
    )
    destination_location = serializers.PrimaryKeyRelatedField(
        queryset=InventoryLocation.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255)
    evidence_reference = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
    )

    def validate_reason(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError("El motivo es obligatorio.")
        return value


class InventoryLocationArchiveSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)

    def validate_reason(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError(
                "El motivo del archivado es obligatorio."
            )
        return value
