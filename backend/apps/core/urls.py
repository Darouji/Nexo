from django.urls import path

from .views import (
    audit_activity,
    dashboard_statistics,
    health_check,
    omnibox_search,
    record_change_history,
)

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("search/", omnibox_search, name="global-search"),
    path("omnibox/", omnibox_search, name="omnibox-search"),
    path("stats/", dashboard_statistics, name="dashboard-statistics"),
    path("inicio/", dashboard_statistics, name="inicio-statistics"),
    path("dashboard/", dashboard_statistics, name="dashboard"),
    path("audit/activity/", audit_activity, name="audit-activity"),
    path("audit/record-changes/", record_change_history, name="record-change-history"),
]