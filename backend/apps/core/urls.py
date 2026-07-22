from django.urls import path

from .views import (
    audit_activity,
    dashboard_statistics,
    full_health_check,
    health_check,
    omnibox_search,
    record_change_history,
)
from .grid_views import (
    GlobalColumnLabelView,
    GridDefinitionView,
    GridPreferenceView,
)

urlpatterns = [
    path(
        "grid/definitions/<str:grid_key>/",
        GridDefinitionView.as_view(),
        name="grid-definition",
    ),
    path(
        "grid/preferences/<str:grid_key>/",
        GridPreferenceView.as_view(),
        name="grid-preference",
    ),
    path(
        "grid/labels/<str:grid_key>/<str:field_key>/",
        GlobalColumnLabelView.as_view(),
        name="global-grid-column-label",
    ),
    path("health/", health_check, name="health-check"),
    path("health/full/", full_health_check, name="full-health-check"),
    path("search/", omnibox_search, name="global-search"),
    path("omnibox/", omnibox_search, name="omnibox-search"),
    path("stats/", dashboard_statistics, name="dashboard-statistics"),
    path("inicio/", dashboard_statistics, name="inicio-statistics"),
    path("dashboard/", dashboard_statistics, name="dashboard"),
    path("audit/activity/", audit_activity, name="audit-activity"),
    path("audit/record-changes/", record_change_history, name="record-change-history"),
]
