from apps.core.grid_registry import GridColumnDefinition as C, GridDefinition, register_grid_definition

register_grid_definition(GridDefinition(
    key="accounts.users", module="accounts", model_name="user", version=1,
    default_page_size=25, saved_filter_keys=("search", "role", "status"),
    columns=(
        C("username", "Usuario", query_field="username", filter_operators=("contains", "equals", "startsWith"), required=True),
        C("full_name", "Nombre", sortable=False),
        C("email", "Correo", query_field="email", filter_operators=("contains", "equals", "startsWith")),
        C("role", "Rol", data_type="choice", query_field="role", filter_operators=("equals",)),
        C("status", "Estado", data_type="choice", query_field="status", filter_operators=("equals",)),
        C("position", "Cargo", query_field="position", filter_operators=("contains", "equals", "startsWith")),
        C("department", "Departamento", query_field="department", filter_operators=("contains", "equals", "startsWith")),
        C("last_login", "Último acceso", data_type="date", query_field="last_login"),
        C("actions", "Acciones", sortable=False, hideable=False, pinnable=False, required=True, exportable=False),
    ),
))