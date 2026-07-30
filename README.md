# SERKAN V2

Plataforma web interna de gestión ERP/CRM desarrollada para centralizar y relacionar información operativa de **SERKAN**.

La aplicación integra administración de usuarios, colaboradores, entidades comerciales, inventario, Kardex, ventas, compras, logística, documentos, importaciones, estadísticas y auditoría bajo una arquitectura modular con validaciones de negocio en el backend.

> **Estado actual:** MVP funcional para entrega, demostración y continuidad interna.  
> **Uso previsto:** plataforma privada de uso interno.  
> **Estado productivo:** no se declara todavía como despliegue productivo definitivo.

---

## Descripción

SERKAN V2 busca reemplazar procesos operativos distribuidos en archivos Excel por una plataforma centralizada, trazable y accesible mediante navegador.

El proyecto prioriza:

- una fuente de verdad para cada operación;
- validación de reglas de negocio en el backend;
- trazabilidad de operaciones sensibles;
- permisos asociados al usuario y a sus capacidades;
- integridad del inventario y del Kardex;
- prevención de duplicados por reintentos;
- estados de carga, vacío, error y éxito;
- filtros, paginación y ordenamiento procesados por el servidor;
- diseño reutilizable y coherente entre módulos;
- funcionamiento en español y zona horaria de Chile.

La interfaz facilita la operación, pero no reemplaza las validaciones de permisos, integridad y consistencia aplicadas por la API.

---

## Alcance funcional implementado

### Autenticación y sesión

- Inicio y cierre de sesión mediante autenticación por token.
- Validación de la sesión almacenada al iniciar la aplicación.
- Expiración configurable de tokens.
- Cierre automático de sesión ante respuestas no autorizadas.
- Protección general de la API para usuarios autenticados.
- Pantalla de bienvenida posterior al inicio de sesión.
- Navegación y acciones adaptadas a las capacidades del usuario.

### Usuarios y permisos

- Creación de usuarios internos.
- Edición de información personal y organizacional.
- Asignación de rol.
- Activación e inactivación de cuentas.
- Búsqueda y filtrado por rol y estado.
- Separación entre permisos visuales del frontend y autorización efectiva del backend.

Los perfiles contemplados por la aplicación son:

- Administrador;
- Finanzas/Comercial;
- Recursos Humanos;
- Informático;
- Operativo;
- Consulta.

Las acciones sensibles se controlan mediante capacidades específicas, especialmente en Inventario y Compras.

### Colaboradores

- Registro independiente de colaboradores internos.
- Vinculación opcional con una cuenta de usuario.
- Datos laborales y de contacto.
- Cargo, departamento, turno y fechas de relación laboral.
- Estados activo, inactivo y archivado.
- Búsqueda y filtros organizacionales.
- Inactivación sin eliminación destructiva del historial.

Un colaborador representa a una persona interna, mientras que un usuario representa su identidad de acceso a la plataforma. Ambas entidades pueden estar relacionadas, pero no se consideran equivalentes.

### Entidades comerciales

Gestión de la jerarquía comercial:

```text
Holding
└── Minera
    └── Área
        └── Subárea
            └── Contacto
```

Funciones disponibles:

- creación y edición de holdings;
- creación y edición de mineras;
- administración de áreas y subáreas;
- registro de contactos externos;
- administración de ciudades;
- búsqueda y ordenamiento;
- relaciones jerárquicas validadas por el backend;
- normalización de nombres, RUT, correo y teléfono;
- información de contacto, ubicación, cargo, turno y observaciones.

Los contactos comerciales no representan usuarios de la plataforma ni colaboradores internos.

### Inventario y catálogo

- Catálogo central de productos.
- Categorías administrables.
- Código SAP opcional.
- Modelo o nombre del producto.
- Descripción y origen.
- Control configurable de inventario físico.
- Stock actual y stock mínimo.
- Identificación de productos bajo mínimo o sin stock.
- Estados operativos y ciclo de vida del producto.
- Cambios sensibles con motivo y auditoría.
- Gestión contextual de categorías.
- Búsqueda, filtros múltiples, ordenamiento y paginación de servidor.
- Vistas personales de grilla.
- Exportación de resultados filtrados.
- Exportación oficial autorizada.
- Indicadores agregados calculados por el backend.

### Ubicaciones y custodia

- Gestión de bodegas y otras ubicaciones físicas.
- Ubicaciones asociadas a custodia personal cuando corresponde.
- Distribución del stock por ubicación.
- Verificación de que la suma de saldos coincida con el stock total.
- Traslados entre ubicaciones.
- Validación de stock disponible en el origen.
- Responsable, fecha, motivo y referencia de traslado.
- Evidencia obligatoria para movimientos sensibles.
- Operaciones transaccionales e idempotentes.
- Historial de traslados.
- Conservación del stock total durante un traslado interno.

Los saldos por ubicación no se editan directamente. Deben cambiar mediante operaciones oficiales de entrada, recepción, ajuste o traslado.

### Recepción física y unidades por recibir

- Registro de unidades esperadas.
- Asociación con producto y ubicación de recepción.
- Recepciones parciales o totales.
- Cancelaciones parciales.
- Historial inmutable de operaciones.
- Protección ante reintentos mediante idempotencia.
- Bloqueo transaccional de registros durante operaciones críticas.
- Actualización conjunta de stock, ubicación, Kardex y cantidad pendiente.
- Búsqueda, estados, fechas, filtros por columna y paginación.
- Exportaciones seguras y auditadas.

Registrar una unidad pendiente no aumenta el stock. El inventario cambia únicamente cuando se confirma la recepción física.

### Kardex global

- Historial transversal de movimientos de inventario.
- Entradas manuales.
- Entradas por recepción.
- Ajustes de inventario.
- Salidas por ventas.
- Reversas por anulación.
- Entradas provenientes de importaciones.
- Stock anterior y posterior.
- Producto, categoría, ubicación, operador, motivo y referencia.
- Snapshots históricos para conservar información legible.
- Filtros por tipo de movimiento y origen.
- Búsqueda y filtros remotos.
- Paginación de servidor.
- Exportación de vista y exportación oficial.
- Registro de auditoría para cada exportación.

El Kardex funciona como un historial inmutable. Las correcciones se realizan mediante movimientos compensatorios o ajustes autorizados, no modificando o eliminando movimientos anteriores.

### Ventas e ingresos

- Registro de ventas con fecha y referencias comerciales.
- Asociación con minera, área, subárea y contacto.
- Registro de factura, orden de compra, guía o HES.
- Líneas de productos con cantidad, valor unitario y ubicación de salida.
- Cálculo de valor neto, IVA y total.
- Estados de venta:
  - ingresada;
  - concretada;
  - anulada.
- Alertas de consistencia.
- Filtros comerciales y operativos.
- Paginación y ordenamiento de servidor.
- Indicadores agregados sobre la consulta.
- Edición controlada de metadatos.
- Modificación de líneas con motivo obligatorio.
- Trazabilidad conjunta de cambios y movimientos Kardex.

Crear una venta no descuenta existencias. El descuento de stock ocurre al concretarla y es ejecutado por el backend.

Cuando una venta concretada se anula, el backend conserva la operación original y genera la reversa de inventario correspondiente.

### Compras y egresos

El alcance actual de Compras corresponde a un **MVP operativo funcional**.

Incluye:

- gestión de proveedores;
- creación de órdenes en borrador;
- líneas de productos;
- moneda y valores de compra;
- ubicación de destino;
- envío a revisión;
- aprobación;
- emisión;
- motivo auditable en transiciones sensibles;
- generación de unidades pendientes para líneas inventariables;
- recepciones parciales y totales;
- cancelación y seguimiento de estados;
- filtros, vistas y grillas de servidor.

Flujo operativo principal:

```text
Borrador
→ En revisión
→ Aprobada
→ Emitida
→ Parcialmente recibida
→ Recibida
→ Cerrada
```

También se contempla el estado `Cancelada`.

La creación, revisión, aprobación o emisión de una orden no aumenta el stock. Sólo la recepción física confirmada puede modificar existencias y generar movimientos Kardex.

### Envíos y logística de compras

- Creación de envíos asociados a órdenes de compra.
- Transportistas.
- Seguimiento de estados logísticos.
- Fechas estimadas y actualizadas.
- Custodia y responsables.
- Registro de avances e incidencias.
- Información de Aduanas.
- Evidencias y referencias.
- Cobros logísticos.
- Monto y moneda original.
- Conversión a CLP cuando corresponde.
- Fuente y motivo del valor registrado.
- Eventos logísticos inmutables e idempotentes.
- Recepción física integrada con Inventario.

Estados logísticos contemplados:

- preparando;
- despachado;
- en tránsito;
- en Aduana;
- retenido;
- liberado;
- en reparto;
- entregado;
- con incidencia;
- cancelado.

El módulo de Compras se presenta como un MVP operativo y no como un sistema contable completo ni como una declaración de preparación productiva definitiva.

### Gestión documental

- Repositorio de documentos asociados a entidades del sistema.
- Tipos de documento configurados por el dominio.
- Propietario lógico mediante relación con registros de negocio.
- Carga de archivos con metadatos.
- Nombre original, tipo de contenido, tamaño y hash SHA-256.
- Versionado de documentos.
- Versión activa.
- Historial de versiones.
- Usuario y fecha de carga.
- Reemplazo mediante una nueva versión.
- Motivo obligatorio de reemplazo.
- Conservación de versiones anteriores para trazabilidad.

Reemplazar un archivo no sobrescribe silenciosamente el documento anterior.

### Importación de Excel

El centro de importación implementado actualmente procesa datos de productos.

Incluye:

- carga de archivos;
- creación de lotes de importación;
- hash del archivo;
- conservación de datos originales por fila;
- normalización separada de los valores;
- prevalidación antes del procesamiento;
- clasificación de filas;
- detección de errores y duplicados;
- identificación de filas que requieren revisión;
- procesamiento explícito del lote;
- registro del objeto creado;
- procedencia y trazabilidad.

Estados de lote:

- creado;
- prevalidado;
- procesado;
- fallido;
- cancelado.

Estados de fila:

- válida;
- error;
- duplicada;
- requiere revisión;
- omitida;
- importada.

Prevalidar un lote no crea registros definitivos. El procesamiento se solicita únicamente después de revisar el resultado de la prevalidación.

### Estadísticas

- Indicadores generales de usuarios y colaboradores.
- Resumen de entidades comerciales.
- Indicadores de productos y existencias.
- Productos bajo nivel crítico.
- Cantidad de movimientos de inventario.
- Totales de ventas.
- Resultados del mes actual.
- Evolución de ventas por periodo.
- Productos con mayor participación.
- Mineras y contactos destacados por ventas.
- Alertas comerciales activas.
- Resumen documental.
- Resumen de importaciones y filas con problemas.

Los indicadores se calculan en el backend. El frontend no reconstruye totales de negocio utilizando únicamente las filas visibles de una grilla.

### Auditoría

- Flujo global de actividad.
- Filtros por módulo y acción.
- Actor responsable.
- Fecha y origen.
- Tipo de operación.
- Representación legible del objeto.
- Identificadores de negocio.
- Motivo.
- Dirección IP y agente de usuario para perfiles autorizados.
- Metadatos de trazabilidad.
- Historial de cambios por registro.
- Campo modificado.
- Valor anterior y nuevo.
- Identificador de solicitud.

La interfaz de Auditoría es de consulta. Las huellas se generan desde el backend, sus servicios de dominio y el middleware transversal.

---

## Núcleo transversal de grillas

SERKAN V2 utiliza un contrato compartido para las grillas operativas.

Cada grilla puede definir:

- una clave técnica estable;
- versión;
- columnas permitidas;
- etiquetas visibles;
- operadores de filtro;
- columnas obligatorias;
- columnas protegidas;
- criterios de ordenamiento;
- definición de exportación oficial.

### Preferencias personales

Cada usuario puede conservar, según la grilla:

- orden de columnas;
- visibilidad;
- ancho;
- fijación;
- ordenamiento;
- filtros;
- tamaño de página;
- vistas personales con nombre;
- vista predeterminada.

Estas preferencias no modifican la experiencia de otros usuarios.

### Etiquetas globales

Los perfiles autorizados pueden cambiar la etiqueta visible de una columna de manera global.

El cambio:

- no modifica la clave técnica;
- no altera el campo de base de datos;
- exige un motivo;
- se aplica a todos los usuarios;
- genera auditoría.

### Exportaciones

La plataforma distingue entre:

- **Exportación de la vista:** respeta filtros, orden, columnas visibles y etiquetas efectivas.
- **Exportación oficial:** utiliza el contrato estable definido por el backend y requiere autorización específica.

Los archivos CSV y XLSX neutralizan valores que una hoja de cálculo podría interpretar como fórmulas.

---

## Principios técnicos

### Backend como autoridad

El frontend puede ocultar acciones que un usuario no debería utilizar, pero esto no constituye autorización.

El backend valida:

- identidad;
- estado del usuario;
- rol y capacidades;
- datos recibidos;
- transiciones de estado;
- reglas de inventario;
- integridad entre stock y Kardex;
- alcance de exportaciones;
- operaciones idempotentes;
- acceso a documentos y registros.

### Trazabilidad

Las operaciones críticas conservan, cuando corresponde:

- usuario;
- fecha y hora;
- origen;
- motivo;
- valores anteriores y posteriores;
- identificador de solicitud;
- representación legible del registro;
- referencias operativas.

### Idempotencia

Las operaciones que podrían repetirse por problemas de red utilizan claves de idempotencia.

Esto evita duplicar:

- recepciones;
- movimientos de inventario;
- traslados;
- operaciones logísticas;
- auditorías;
- efectos de una misma solicitud.

### Integridad transaccional

Las operaciones relacionadas se ejecutan dentro de transacciones del backend.

Por ejemplo, una recepción física debe actualizar como una sola unidad:

```text
Cantidad recibida
+ saldo de la ubicación
+ stock total
+ movimiento Kardex
+ historial de recepción
+ auditoría
```

Si una parte falla, la operación completa debe revertirse.

---

## Arquitectura

```text
┌───────────────────────────────────────────────┐
│                  Navegador                    │
│                                               │
│  React + TypeScript + Material UI + AG Grid   │
└───────────────────────┬───────────────────────┘
                        │ HTTP / JSON
                        │ Token Authentication
┌───────────────────────▼───────────────────────┐
│              API REST de Django               │
│                                               │
│  Cuentas · Comercial · Inventario · Compras   │
│  Ventas · Documentos · Importaciones · Core   │
└───────────────────────┬───────────────────────┘
                        │
┌───────────────────────▼───────────────────────┐
│             Persistencia de datos             │
│                                               │
│  SQLite en desarrollo / PostgreSQL configurable│
└───────────────────────────────────────────────┘
```

La aplicación sigue una organización modular:

- el frontend presenta la experiencia y coordina las solicitudes;
- los servicios frontend centralizan los contratos HTTP;
- las vistas y serializers reciben y validan solicitudes;
- los servicios de dominio ejecutan reglas de negocio;
- los modelos conservan datos y restricciones;
- el núcleo compartido administra auditoría, errores, grillas y paginación.

---

## Tecnologías

### Backend

| Tecnología            | Uso                                                |
| --------------------- | -------------------------------------------------- |
| Python 3.12           | Entorno utilizado por integración continua         |
| Django 5.2            | Framework principal                                |
| Django REST Framework | API REST                                           |
| drf-spectacular       | Esquema OpenAPI, Swagger UI y ReDoc                |
| django-cors-headers   | Configuración de CORS                              |
| PostgreSQL / psycopg  | Base de datos configurable para despliegue         |
| SQLite                | Base de datos local predeterminada                 |
| openpyxl              | Lectura y generación de archivos Excel             |
| Pillow                | Procesamiento y validación de archivos compatibles |
| python-dotenv         | Variables de entorno                               |

### Frontend

| Tecnología   | Uso                      |
| ------------ | ------------------------ |
| React 19     | Interfaz de usuario      |
| TypeScript   | Tipado estático          |
| Vite         | Desarrollo y compilación |
| Material UI  | Componentes visuales     |
| AG Grid      | Grillas operativas       |
| Axios        | Cliente HTTP             |
| React Router | Navegación               |
| Vitest       | Pruebas frontend         |
| ESLint       | Análisis estático        |

### Automatización

| Tecnología            | Uso                        |
| --------------------- | -------------------------- |
| Git                   | Control de versiones       |
| GitHub                | Repositorio y revisión     |
| GitHub Actions        | Comprobaciones automáticas |
| Django Test Framework | Pruebas backend            |

---

## Estructura del repositorio

```text
Serkan-V2/
├── .github/
│   └── workflows/
│       └── backend-ci.yml
│
├── backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── collaborators/
│   │   ├── commercial/
│   │   ├── core/
│   │   ├── documents/
│   │   ├── imports/
│   │   ├── inventory/
│   │   ├── purchases/
│   │   └── sales/
│   ├── config/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .env.production.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── features/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── theme/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── inventory-production-readiness.md
│   ├── purchases-production-readiness.md
│   └── shared-grid-foundation.md
│
└── README.md
```

---

## Requisitos para desarrollo local

Se recomienda utilizar:

- Git;
- Python 3.12;
- Node.js 22;
- npm;
- PowerShell, Terminal o una consola equivalente.

PostgreSQL es opcional para desarrollo local. La configuración predeterminada utiliza SQLite.

---

## Instalación local

### 1. Clonar el repositorio

```bash
git clone https://github.com/Darouji/Serkan-V2.git
cd Serkan-V2
```

Al tratarse de un repositorio privado, la cuenta utilizada debe disponer de acceso.

### 2. Preparar el backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

En Linux o macOS, la activación del entorno virtual es:

```bash
source .venv/bin/activate
```

### 3. Configurar variables de entorno

El archivo local debe quedar en:

```text
backend/.env
```

La plantilla `backend/.env.example` utiliza SQLite y valores apropiados para desarrollo local.

Antes de utilizar otro entorno, deben revisarse como mínimo:

```env
DJANGO_SECRET_KEY=replace-this-with-a-real-secret-key
DJANGO_DEBUG=True
DJANGO_ENABLE_API_DOCS=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,testserver

DJANGO_CORS_ALLOWED_ORIGINS=http://localhost:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://localhost:5173

DJANGO_LANGUAGE_CODE=es-cl
DJANGO_TIME_ZONE=America/Santiago

DB_ENGINE=sqlite
DB_NAME=db.sqlite3

DRF_PAGE_SIZE=50
DRF_TOKEN_EXPIRE_HOURS=12
```

No deben guardarse contraseñas, claves secretas ni credenciales reales dentro del repositorio.

### 4. Crear la base de datos

```powershell
python manage.py migrate
```

### 5. Crear el usuario administrador inicial

```powershell
python manage.py createsuperuser
```

### 6. Iniciar el backend

```powershell
python manage.py runserver
```

El backend quedará disponible en:

```text
http://127.0.0.1:8000/
```

### 7. Preparar el frontend

Abre una segunda terminal desde la raíz del proyecto:

```powershell
cd frontend
npm ci
npm run dev
```

El frontend quedará disponible en:

```text
http://127.0.0.1:5173/
```

En desarrollo, Vite redirige automáticamente las solicitudes `/api` hacia:

```text
http://127.0.0.1:8000/
```

Por este motivo no es necesario definir una URL externa para la API durante el desarrollo local normal.

Para un entorno separado puede configurarse:

```env
VITE_API_BASE_URL=https://dominio-del-backend.cl/api
```

---

## Documentación de la API

Cuando `DJANGO_ENABLE_API_DOCS=True`, se encuentran disponibles:

| Recurso               | Dirección local                     |
| --------------------- | ----------------------------------- |
| Esquema OpenAPI       | `http://127.0.0.1:8000/api/schema/` |
| Swagger UI            | `http://127.0.0.1:8000/api/docs/`   |
| ReDoc                 | `http://127.0.0.1:8000/api/redoc/`  |
| Administración Django | `http://127.0.0.1:8000/admin/`      |

La documentación interactiva puede desactivarse mediante variables de entorno.

---

## Comprobaciones de calidad

### Backend

Desde `backend/`:

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py spectacular --file schema.yml --validate
python manage.py collectstatic --noinput --dry-run
```

### Frontend

Desde `frontend/`:

```powershell
npm run lint
npm run test
npm run build
```

### Revisión del repositorio

Antes de integrar cambios:

```powershell
git status
git diff --check
```

---

## Integración continua

El repositorio incluye un flujo de GitHub Actions para cambios enviados a `main` y pull requests dirigidas a `main`.

Las comprobaciones automatizadas incluyen:

### Backend

- instalación de dependencias;
- validación de dependencias de Python;
- comprobación de configuración Django;
- detección de migraciones pendientes;
- ejecución de pruebas;
- validación del esquema OpenAPI;
- validación de archivos estáticos.

### Frontend

- instalación reproducible con `npm ci`;
- ESLint;
- pruebas de Vitest;
- compilación de producción.

Una comprobación automática exitosa no reemplaza la revisión funcional manual de los flujos críticos.

---

## Configuración de base de datos

### SQLite

Configuración recomendada para desarrollo local:

```env
DB_ENGINE=sqlite
DB_NAME=db.sqlite3
```

### PostgreSQL

Configuración disponible para un entorno PostgreSQL:

```env
DB_ENGINE=postgres
DB_NAME=serkan_v2
DB_USER=serkan_v2_user
DB_PASSWORD=replace-this-with-a-secure-database-password
DB_HOST=localhost
DB_PORT=5432
DB_CONN_MAX_AGE=60
```

Las credenciales reales deben almacenarse mediante variables seguras del entorno de despliegue.

---

## Seguridad

La implementación actual contempla:

- autenticación obligatoria por defecto;
- expiración de tokens;
- control de acceso en backend;
- capacidades separadas para acciones sensibles;
- limitación de solicitudes mediante DRF;
- validación de hosts, CORS y CSRF;
- encabezados de seguridad;
- protección frente a contenido interpretado como fórmula en exportaciones;
- validación de archivos;
- hash de documentos e importaciones;
- errores estructurados;
- identificadores de solicitud;
- auditoría de operaciones;
- inmutabilidad de historiales críticos;
- configuración separada para desarrollo y producción.

La plantilla `backend/.env.production.example` es solamente una referencia. No debe utilizarse sin reemplazar valores, configurar infraestructura, revisar permisos y ejecutar las pruebas correspondientes.

---

## Estado de la entrega

Esta versión permite demostrar de manera integrada los principales flujos administrativos y operativos desarrollados para SERKAN.

Se encuentran implementados flujos funcionales de:

- autenticación;
- usuarios;
- colaboradores;
- estructura comercial;
- catálogo e inventario;
- ubicaciones y custodia;
- Kardex;
- ventas;
- compras en alcance MVP;
- logística y recepción física;
- documentos versionados;
- importación de productos;
- estadísticas;
- auditoría;
- preferencias y exportaciones de grilla.

La existencia de una pantalla no debe interpretarse por sí sola como preparación para producción.

El despliegue productivo requiere una validación independiente de infraestructura, seguridad, respaldos, rendimiento, concurrencia, accesibilidad y aceptación operativa.

---

## Documentación técnica interna

El repositorio incluye documentación complementaria en `docs/`:

- `inventory-production-readiness.md`: reglas, integridad y validaciones del dominio Inventario.
- `purchases-production-readiness.md`: alcance funcional vigente de Compras y logística.
- `shared-grid-foundation.md`: contrato común de grillas, preferencias, etiquetas y exportaciones.

El desarrollo se basa en la **Especificación Maestra Definitiva SERKAN V2**, que define los principios funcionales, arquitectónicos, visuales, de seguridad y evolución del proyecto.

---

## Desarrollo

Proyecto desarrollado para SERKAN.

**Responsable principal de desarrollo:**  
Fabián García Ríos

Participación en análisis funcional, diseño de arquitectura, desarrollo full-stack, documentación técnica, validación y preparación de la entrega.

---

## Uso y distribución

Este repositorio está destinado al uso interno y a la entrega del proyecto.

No se ha definido una licencia de distribución pública. El código, los documentos y los datos asociados no deben redistribuirse sin la autorización correspondiente.
