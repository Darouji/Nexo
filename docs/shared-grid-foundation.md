# Núcleo transversal de grillas — SERKAN V2

## Alcance del primer incremento

Este incremento introduce un contrato reutilizable para las grillas de Inventario,
Ventas y Compras. La primera integración funcional corresponde al Catálogo de
productos.

El núcleo separa explícitamente dos conceptos:

- **Preferencias personales de vista:** orden, visibilidad, ancho, fijación de
  columnas y tamaño de página. Se guardan por usuario y no afectan a terceros.
- **Etiquetas visibles globales:** nombre comercial mostrado en el encabezado de
  una columna. No constituyen una preferencia personal y se aplican a todos los
  usuarios de la plataforma.

La clave técnica del campo y su nombre oficial de sistema no cambian cuando se
modifica una etiqueta visible.

## Regla de negocio: renombrado global de columnas

El renombrado de una columna es una operación administrativa global. Puede ser
ejecutada por los roles con capacidad administrativa definida por la plataforma:

- `ADMINISTRADOR`
- `RRHH`
- `INFORMATICO`
- `FINANZAS_COMERCIAL`

La autorización se valida siempre en el backend. Ocultar el control en la interfaz
es sólo una ayuda visual y no reemplaza esa validación.

Cada cambio exige un motivo, conserva la etiqueta oficial del sistema, actualiza
la etiqueta efectiva para todos los usuarios y genera trazabilidad de auditoría.
Un usuario operativo no puede ejecutar esta acción.

## Contratos del núcleo

Las definiciones de grilla se registran en el backend con una clave estable y una
versión. Para Catálogo se utiliza `inventory.products`.

Endpoints transversales:

- `GET /api/grid/definitions/<grid_key>/`: definición, columnas, etiquetas
  efectivas, operadores y capacidades del usuario.
- `GET|PUT|DELETE /api/grid/preferences/<grid_key>/`: lectura, guardado con
  revisión optimista y restablecimiento de preferencias personales.
- `PUT /api/grid/labels/<grid_key>/<field_key>/`: cambio administrativo de la
  etiqueta global, con motivo obligatorio.

Las preferencias toleran evolución de versión: se descartan únicamente columnas
u opciones desconocidas y se conservan las que siguen siendo válidas. La revisión
optimista evita que dos pestañas sobrescriban silenciosamente la configuración más
reciente.

## Catálogo de productos

El Catálogo consume la definición registrada, persiste la vista del usuario y
envía filtros tipados al servidor antes de paginar. Los campos y operadores
permitidos se validan contra el registro; un cliente no puede construir filtros
arbitrarios sobre el modelo.

La exportación tiene dos modalidades:

- **Vista actual:** respeta filtros, orden, columnas visibles y etiquetas globales.
- **Oficial:** usa el conjunto y los nombres oficiales definidos por el sistema;
  requiere capacidad administrativa.

CSV y XLSX neutralizan valores que una hoja de cálculo podría interpretar como
fórmulas. Las exportaciones se auditan y tienen un límite operativo de 5.000 filas.

## Criterios de extensión

Inventario, Compras y Ventas reutilizan este registro, los endpoints y el
componente de grilla. Además de los listados principales, se integraron las
grillas flotantes de categorías, productos asociados, líneas de venta y alertas.
Ventas usa la clave `sales.sales` con paginación, orden, filtros múltiples y
filtros por columna aplicados en el servidor.
Cada nueva grilla debe declarar su clave, versión, columnas permitidas,
tipos, operadores, columnas protegidas y definición de exportación oficial. No se
deben crear implementaciones paralelas de preferencias o etiquetas.

