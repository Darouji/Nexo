from apps.core.grid_registry import GridColumnDefinition as C, GridDefinition, register_grid_definition

register_grid_definition(GridDefinition(
    key="collaborators.collaborators", module="collaborators", model_name="collaborator", version=1,
    default_page_size=25, saved_filter_keys=("search", "status", "linked_user"),
    columns=(
        C("full_name", "Colaborador", query_field="full_name_normalized", filter_operators=("contains", "equals", "startsWith"), required=True),
        C("rut", "RUT", query_field="rut", filter_operators=("contains", "equals", "startsWith")),
        C("email", "Correo", query_field="email", filter_operators=("contains", "equals", "startsWith")),
        C("phone", "Teléfono", query_field="phone", filter_operators=("contains", "equals", "startsWith")),
        C("position", "Cargo", query_field="position", filter_operators=("contains", "equals", "startsWith")),
        C("department", "Departamento", query_field="department", filter_operators=("contains", "equals", "startsWith")),
        C("shift", "Turno", query_field="shift", filter_operators=("contains", "equals", "startsWith")),
        C("user_username", "Usuario vinculado", query_field="user__username", filter_operators=("contains", "equals", "startsWith")),
        C("start_date", "Ingreso", data_type="date", query_field="start_date", filter_operators=("equals", "greaterThanOrEqual", "lessThanOrEqual")),
        C("status", "Estado", data_type="choice", query_field="status", filter_operators=("equals",)),
        C("actions", "Acciones", sortable=False, hideable=False, pinnable=False, required=True, exportable=False),
    ),
))
