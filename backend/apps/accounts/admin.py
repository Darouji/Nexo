from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "collaborator",
        "is_active_profile",
        "phone",
        "position",
        "area",
        "created_at",
        "updated_at",
    )
    list_filter = ("role", "is_active_profile")
    search_fields = (
        "user__username",
        "user__email",
        "collaborator__first_name",
        "collaborator__last_name",
        "phone",
        "position",
        "area",
    )
    ordering = ("user__username",)