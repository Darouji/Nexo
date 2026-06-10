from django.utils.deprecation import MiddlewareMixin
from apps.core.models import ActivityLog

class ActivityLogMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # Filtra para auditar solo peticiones de modificación en la API
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE'] and hasattr(request, 'user') and request.user.is_authenticated:
            if request.path.startswith('/api/'):
                ActivityLog.objects.create(
                    user=request.user,
                    action=request.method,
                    model_name=request.path,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    details=f"Status Code: {response.status_code}"
                )
        return response