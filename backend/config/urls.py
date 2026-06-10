from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.collaborators.urls")),
    path("api/commercial/", include("apps.commercial.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/sales/", include("apps.sales.urls")),
]