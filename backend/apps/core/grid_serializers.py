from rest_framework import serializers


class GridPreferenceWriteSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    definition_version = serializers.IntegerField(min_value=1)
    config = serializers.JSONField()


class GlobalColumnLabelWriteSerializer(serializers.Serializer):
    visible_name = serializers.CharField(max_length=160, trim_whitespace=True)
    reason = serializers.CharField(
        min_length=5,
        max_length=500,
        trim_whitespace=True,
    )

    def validate_visible_name(self, value):
        normalized = " ".join(value.split())

        if not normalized:
            raise serializers.ValidationError("El nombre visible es obligatorio.")

        return normalized


class GridColumnDefinitionSerializer(serializers.Serializer):
    field_key = serializers.CharField()
    system_label = serializers.CharField()
    visible_name = serializers.CharField()
    data_type = serializers.CharField()
    sortable = serializers.BooleanField()
    filter_operators = serializers.ListField(child=serializers.CharField())
    hideable = serializers.BooleanField()
    pinnable = serializers.BooleanField()
    required = serializers.BooleanField()
    exportable = serializers.BooleanField()


class GridDefinitionPermissionsSerializer(serializers.Serializer):
    can_rename_global = serializers.BooleanField()
    can_export_official = serializers.BooleanField()


class GridDefinitionResponseSerializer(serializers.Serializer):
    grid_key = serializers.CharField()
    definition_version = serializers.IntegerField()
    default_page_size = serializers.IntegerField()
    allowed_page_sizes = serializers.ListField(child=serializers.IntegerField())
    columns = GridColumnDefinitionSerializer(many=True)
    permissions = GridDefinitionPermissionsSerializer()


class StoredGridColumnSerializer(serializers.Serializer):
    field_key = serializers.CharField()
    width = serializers.IntegerField(required=False)
    hidden = serializers.BooleanField()
    pinned = serializers.ChoiceField(
        choices=["left", "right"],
        allow_null=True,
    )


class GridPreferenceConfigSerializer(serializers.Serializer):
    columns = StoredGridColumnSerializer(many=True)
    page_size = serializers.IntegerField()


class GridPreferenceResponseSerializer(serializers.Serializer):
    grid_key = serializers.CharField()
    definition_version = serializers.IntegerField()
    revision = serializers.IntegerField()
    config = GridPreferenceConfigSerializer()


class GlobalColumnLabelResponseSerializer(serializers.Serializer):
    grid_key = serializers.CharField()
    field_key = serializers.CharField()
    system_label = serializers.CharField()
    visible_name = serializers.CharField()
    scope = serializers.CharField()
