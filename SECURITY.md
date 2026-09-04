# Seguridad y privacidad

Este proyecto es una demostración de desarrollo, no un despliegue listo para producción.

## Datos y configuración

- Crea una base vacía e ingresa únicamente datos ficticios. No se distribuyen respaldos ni credenciales.
- Las plantillas `.env.example` contienen marcadores, nunca secretos válidos.
- No versiones `.env`, bases SQLite, respaldos, archivos de usuarios, certificados ni claves privadas.
- Crea una clave Django aleatoria y contraseñas propias. No publiques un superusuario de demostración.
- Los datos de muestra usan dominios reservados de ejemplo y no deben enviarse por correo.

## Antes de producción

Revisa permisos de cada operación, HTTPS, `DEBUG=False`, hosts/CORS explícitos, cookies seguras, rotación de tokens, límites de carga y almacenamiento privado de documentos. Usa PostgreSQL y verifica transacciones/concurrencia, respaldos y recuperación. Aplica análisis de dependencias y secretos al estado que vayas a desplegar.

Eliminar un archivo del último commit no lo elimina del historial. Si alguna credencial estuvo versionada, revócala o rótala en el servicio correspondiente antes de reutilizar un entorno. Una edición nueva con historial limpio no invalida las credenciales anteriores.

## Reportar un problema

No publiques credenciales, datos personales ni pruebas de explotación en issues públicos. Contacta al autor a través del perfil de GitHub para acordar un canal privado. Incluye el comportamiento esperado, el impacto y pasos reproducibles con datos ficticios.
