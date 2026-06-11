from django.urls import path

from .views import dashboard_statistics, health_check, omnibox_search

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("search/", omnibox_search, name="global-search"),
    path("omnibox/", omnibox_search, name="omnibox-search"),
    path("stats/", dashboard_statistics, name="dashboard-statistics"),
    path("inicio/", dashboard_statistics, name="inicio-statistics"),
    path("dashboard/", dashboard_statistics, name="dashboard"),
]