# Nexo ERP/CRM

**Operaciones conectadas. Información trazable. Interfaces claras.**

Plataforma web full stack para centralizar la gestión comercial y operativa de una pyme: contactos, inventario, compras, ventas, logística y documentación. Nace de un proyecto de práctica profesional y se presenta aquí como una edición anonimizada de portafolio.

**Estado:** MVP funcional en entorno de desarrollo. No se presenta como un sistema certificado ni validado en producción. Esta edición se instala con una base de datos nueva y datos ficticios.

[Arquitectura](docs/architecture.md) · [Seguridad](SECURITY.md) · [Puesta en marcha](#puesta-en-marcha) · [Metodología](docs/ai-workflow.md)

## El problema

Los procesos repartidos entre planillas dificultan seguir el recorrido de una compra, relacionar una venta con sus movimientos de inventario y saber quién modificó un registro. Nexo reúne esos flujos en una interfaz común y una API modular.

## Qué implementa

| Área | Alcance |
| --- | --- |
| Acceso | Autenticación por token, usuarios internos, roles y permisos |
| CRM | Entidades comerciales, áreas, subáreas y contactos |
| Inventario | Catálogo, categorías, ubicaciones, stock, Kardex y recepciones pendientes |
| Compras y logística | Órdenes, recepciones, costos asociados y seguimiento de envíos |
| Ventas | Detalle comercial, estados, alertas y vinculación con inventario |
| Documentos | Archivos, versiones y documentación de perfiles |
| Operación | Importación Excel, estadísticas, búsqueda y auditoría |
| Interfaz compartida | Grillas, filtros, vistas, paginación y exportaciones procesadas en servidor |

## Mi contribución

Desarrollado por **Fabián García Ríos**: levantamiento y organización de requerimientos, diseño de flujos, implementación frontend/backend y validación. El trabajo se apoyó en IA para investigación, documentación y revisión, manteniendo decisiones y comprobaciones humanas. No se atribuyen métricas de impacto empresarial ni adopción productiva no verificadas.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Material UI y AG Grid Community.
- **Backend:** Python, Django 5.2, Django REST Framework y drf-spectacular.
- **Datos:** SQLite para desarrollo; PostgreSQL configurable.
- **Calidad:** pruebas Django y Vitest, ESLint, TypeScript y GitHub Actions.

Las versiones exactas están en `backend/requirements.txt` y `frontend/package-lock.json`.

## Puesta en marcha

Requisitos: Python 3.12 y Node.js 22 con npm. Los comandos siguientes asumen una terminal en la raíz; la activación del entorno varía entre Windows y macOS/Linux.

### Backend

```sh
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Copia `backend/.env.example` a `backend/.env` y genera una clave local propia con `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`. Asigna el resultado a `DJANGO_SECRET_KEY`; no lo subas a Git.

```sh
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo --username TU_USUARIO
python manage.py runserver 127.0.0.1:8000
```

`seed_demo` crea registros ficticios y evita una segunda carga accidental. No incluye una contraseña compartida ni abre servicios externos.

### Frontend

En otra terminal:

```sh
cd frontend
npm ci
npm run dev
```

Abre `http://localhost:5173`. El proxy de Vite dirige `/api` al backend local. La URL de la API puede configurarse con `VITE_API_BASE_URL` para otros entornos. La documentación OpenAPI se habilita según `DJANGO_ENABLE_API_DOCS`.

### Validación

```sh
# En backend, con el entorno Python activado
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py spectacular --file schema.yml --validate
# En frontend
npm run lint
npm test
npm run build
```

## Estructura

```text
backend/
  apps/        # Dominios de negocio, servicios, API y pruebas
  config/      # Configuración Django por variables de entorno
frontend/
  src/         # Páginas, componentes, servicios y estado
  public/      # Recursos públicos de la interfaz
docs/          # Arquitectura, metodología y límites conocidos
```

## Alcance y próximos pasos

- Validar concurrencia, rendimiento y despliegue con PostgreSQL antes de producción.
- Completar revisión integral de permisos, recuperación de respaldos y operación con usuarios finales.
- Evaluar accesibilidad con pruebas de uso y ampliar la cobertura de integración.
- Las reglas de negocio y alertas operativas son ejemplos configurables; no constituyen validación contable, tributaria o aduanera.

Los documentos de preparación de inventario y compras describen avances técnicos y pendientes; sus títulos no constituyen una certificación productiva.

## Privacidad y uso

Esta edición no incluye datos de clientes, respaldos, documentos laborales, credenciales ni identidad de terceros. No importes una base histórica del proyecto original. Consulta [SECURITY.md](SECURITY.md) antes de desplegar.

No se ha concedido una licencia de código abierto. La publicación para revisión profesional no autoriza por sí sola reutilización o redistribución. Las dependencias conservan sus propias licencias.

**Autor:** [Fabián García Ríos](https://github.com/Darouji) · [LinkedIn](https://www.linkedin.com/in/fabian-garcia-55641333b/)
