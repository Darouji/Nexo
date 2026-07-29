from apps.core.grid_registry import GridColumnDefinition as C, GridDefinition, register_grid_definition

T = ("contains", "equals", "startsWith")
def register(key, model, columns):
    register_grid_definition(GridDefinition(key=key, module="commercial", model_name=model, version=1, default_page_size=25, saved_filter_keys=("search",), columns=columns))
def edit():
    return C("edit", "Editar", sortable=False, hideable=False, pinnable=False, required=True, exportable=False)
def status():
    return C("status", "Estado", data_type="choice", query_field="status", filter_operators=("equals",))

register("commercial.holdings", "holding", (
    C("name", "Holding", query_field="name", filter_operators=T, required=True), C("description", "Descripción", query_field="description", filter_operators=T), status(), C("updated_at", "Última actualización", data_type="date", query_field="updated_at"), edit()))
register("commercial.mineras", "minera", (
    C("name", "Minera", query_field="name", filter_operators=T, required=True), C("rut", "RUT", query_field="rut", filter_operators=T), C("holding_name", "Holding", query_field="holding__name", filter_operators=T), C("city_name", "Ciudad", query_field="city__name", filter_operators=T), C("email", "Correo", query_field="email", filter_operators=T), C("phone", "Teléfono", query_field="phone", filter_operators=T), status(), edit()))
register("commercial.areas", "area", (
    C("name", "Área", query_field="name", filter_operators=T, required=True), C("minera_name", "Minera", query_field="minera__name", filter_operators=T), C("holding_name", "Holding", query_field="minera__holding__name", filter_operators=T), C("location", "Ubicación", query_field="location", filter_operators=T), status(), edit()))
register("commercial.subareas", "subarea", (
    C("name", "Subárea", query_field="name", filter_operators=T, required=True), C("area_name", "Área", query_field="area__name", filter_operators=T), C("minera_name", "Minera", query_field="area__minera__name", filter_operators=T), C("holding_name", "Holding", query_field="area__minera__holding__name", filter_operators=T), C("description", "Descripción", query_field="description", filter_operators=T), status(), edit()))
register("commercial.contactos", "contacto", (
    C("full_name", "Contacto", query_field="full_name_normalized", filter_operators=T, required=True), C("position", "Cargo", query_field="position", filter_operators=T), C("minera_name", "Minera", query_field="subarea__area__minera__name", filter_operators=T), C("area_name", "Área", query_field="subarea__area__name", filter_operators=T), C("subarea_name", "Subárea", query_field="subarea__name", filter_operators=T), C("email", "Correo", query_field="email", filter_operators=T), C("phone", "Teléfono", query_field="phone", filter_operators=T), C("shift_mode_display", "Modalidad", query_field="shift_mode", filter_operators=("equals",)), C("cycle", "Ciclo laboral", sortable=False), status(), C("availability", "Disponibilidad", sortable=False, hideable=False, required=True, exportable=False), edit()))