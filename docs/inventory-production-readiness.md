# Cierre de Inventario para producción — SERKAN V2

## Propósito

Este documento controla la Fase 2 del roadmap: cerrar Catálogo, ubicaciones,
custodia, Por Recibir y Kardex conforme al Anexo A del documento maestro y a
las políticas transversales vigentes.

La fase declara **Inventario listo dentro de la aplicación** únicamente cuando
cumple integridad, permisos, auditoría, exportación, accesibilidad, rendimiento,
documentación y pruebas. La salida completa a producción de SERKAN continúa
dependiendo del endurecimiento transversal de autenticación, infraestructura,
privacidad y operación descrito en la Fase 8.

## Normas y políticas obligatorias

- Objetivo técnico: OWASP ASVS 5.0 nivel 2, OWASP API Security Top 10, NIST
  SSDF 1.1 y prácticas oficiales de Django.
- Cumplimiento chileno considerado desde el diseño: leyes 21.719, 21.663 y
  21.459, sujeto a revisión jurídica antes de producción.
- Autorización siempre validada en backend y separada por capacidad.
- Trazabilidad para stock, custodia, exportaciones y cambios sensibles.
- PostgreSQL como base de producción; SQLite sólo para desarrollo local.
- Consultas paginadas, índices justificados por medición, cancelación de
  solicitudes obsoletas y límites de exportación.
- Arquitectura modular y contratos estables; no se introducen microservicios,
  cachés o infraestructura adicional sin una necesidad medida.

## Decisiones que prevalecen

- El renombrado de columnas es global y está disponible para los perfiles
  administrativos definidos por SERKAN; nunca es una preferencia personal.
- La duplicación visual de columnas y las vistas organizacionales publicadas
  permanecen como funciones futuras.
- Las vistas nombradas personales sí pertenecen al núcleo inmediato.
- La auditoría técnica global conserva IP, agente de usuario y metadatos para
  perfiles autorizados. El historial simple y entendible de cada registro se
  habilitará para quienes ya tengan autorización de consulta sobre ese registro,
  sin exponer esos metadatos técnicos.
- La identidad legible de un producto en auditoría conserva una foto del modelo,
  Código SAP y categoría al momento del evento. El ID interno permanece como
  referencia técnica secundaria y no sustituye esos identificadores de negocio.
- La actividad de Inventario explica cada modificación con campo, valor anterior
  y valor nuevo en lenguaje cotidiano. Kardex, recepciones y operaciones de
  ciclo de vida incluyen además una explicación específica de la operación.
- La decisión sobre vender stock remanente de un producto descontinuado se
  resolverá al integrar Ventas.
- Compras, Ventas e Importaciones referenciarán Inventario mediante servicios
  oficiales; sus flujos completos no se simulan dentro de esta fase.

Estas decisiones corrigen escenarios residuales contradictorios del Anexo A y
deben incorporarse en una futura actualización controlada del documento
maestro.

## Incrementos

### 1. Contratos y cierre de Catálogo

- Orden y comportamiento exactos del formulario Nuevo Producto.
- Código SAP opcional, sin valores ficticios y con cambio posterior motivado.
- Permisos explícitos para productos, categorías, ciclo de vida, entradas,
  ajustes, pendientes y exportación oficial.
- Auditoría de cambios sensibles con actor, motivo, valores y request ID.
- Vistas personales nombradas sobre el núcleo transversal.

Estado actual: las vistas personales nombradas están disponibles en el Catálogo.
Cada usuario puede guardar, aplicar y eliminar sus propias vistas, marcar una
como predeterminada y conservar búsqueda, filtros, orden, columnas y tamaño de
página sin modificar la experiencia de los demás usuarios.

### 2. Ubicaciones de inventario

- Ubicaciones tipadas: bodega, domicilio bajo custodia, tránsito,
  cliente/faena y otro.
- Saldos de producto por ubicación cuya suma coincide con el stock total.
- Transferencias atómicas con origen, destino, cantidad, responsable, fecha,
  motivo y evidencia/referencia cuando corresponda.
- Migración explícita del stock existente a una ubicación inicial.

Estado actual: incremento implementado y verificado en la rama de trabajo.

- Se incorporaron ubicaciones de tipo Bodega, Domicilio bajo custodia,
  Tránsito, Cliente/faena y Otra ubicación.
- El domicilio bajo custodia exige un colaborador responsable y evita guardar
  una dirección residencial completa; sólo conserva ciudad/comuna y una
  referencia operativa.
- Cada movimiento Kardex nuevo exige ubicación y actualiza, dentro de la misma
  transacción, el stock total y el saldo físico por ubicación.
- La suma de saldos se valida contra `stock_actual` antes y después de cada
  operación. Los saldos no admiten escritura directa.
- Los traslados son registros inmutables con responsable, fecha, motivo,
  referencia/evidencia e idempotencia. Mueven saldo entre ubicaciones sin
  modificar el stock total ni crear movimientos Kardex ficticios.
- Una transferencia que involucra Domicilio bajo custodia o Cliente/faena
  exige referencia o evidencia.
- El stock anterior a esta función se asigna a
  **Stock histórico por regularizar**, de tipo Otra ubicación. Esto conserva
  la verdad histórica y evita inventar una bodega que no fue informada.
- Las recepciones pendientes antiguas se migran al mismo destino técnico; las
  nuevas deben seleccionar ubicación de recepción desde la plataforma.
- La pantalla de Inventario permite administrar ubicaciones, revisar el stock
  distribuido con paginación, trasladar desde el saldo elegido y consultar
  los traslados recientes.
- Los perfiles de consulta pueden leer ubicaciones, saldos y traslados. Crear,
  editar o archivar ubicaciones y trasladar stock requiere las capacidades
  administrativas específicas ya definidas en backend.
- Auditoría presenta el producto mediante modelo, Código SAP y categoría, y
  explica la ruta, cantidad, responsable, motivo, evidencia y stock total
  inalterado en lenguaje cotidiano. Los metadatos técnicos se conservan para
  perfiles autorizados.

Validación automatizada del incremento:

- Migración regresiva desde el esquema anterior con stock y pendientes.
- Integridad Kardex/saldo/stock total.
- Traslado atómico, stock insuficiente, evidencia sensible e inmutabilidad.
- Reintentos idempotentes y permisos de sólo lectura.
- Contrato OpenAPI, migraciones sin cambios pendientes y `manage.py check`.
- Suite backend completa, lint, pruebas y build de producción frontend.

La ubicación técnica de regularización no representa una bodega real. Antes
de la aceptación operativa, un administrador debe crear las ubicaciones reales
y trasladar cada saldo histórico hacia su ubicación verificada.

### 3. Por Recibir

- Ubicación destino y referencias futuras sin aumentar stock al crear.
- Filtros, ordenamiento, preferencias, vistas y exportaciones mediante el
  núcleo común.
- Recepción/cancelación parcial idempotente y protegida contra concurrencia.

Estado actual: incremento implementado y verificado en la rama de trabajo.

- Registrar un pendiente exige producto operativo, cantidad positiva,
  ubicación de recepción activa y una referencia o motivo. Esta acción no
  modifica stock ni crea Kardex.
- Crear, recibir y cancelar usan claves de idempotencia. Un reintento idéntico
  devuelve el mismo resultado sin duplicar pendientes, stock, movimientos ni
  auditoría; reutilizar una clave con otros datos se rechaza.
- Las recepciones y cancelaciones parciales bloquean el registro y el producto
  durante la transacción. La recepción física actualiza stock, saldo por
  ubicación, Kardex y pendiente como una sola unidad atómica.
- Cada recepción o cancelación conserva un registro operativo inmutable con
  actor, fecha, motivo, cantidad, saldos anterior/posterior, estados
  anterior/posterior y vínculo al Kardex cuando corresponde.
- El historial conserva una instantánea del modelo, Código SAP, categoría y
  ubicación. La plataforma lo presenta en lenguaje cotidiano desde el botón
  **Historial**, aunque el producto se renombre posteriormente.
- La grilla incorpora búsqueda, estado, rango de fechas, filtros remotos por
  columna, ordenamiento, paginación y preferencias del núcleo transversal.
- Cada usuario puede guardar vistas personales con nombre que conservan
  búsqueda, estado, fechas, filtros de columna, orden, columnas y tamaño de
  página.
- La exportación de la vista respeta las columnas visibles y etiquetas
  administrativas. La exportación oficial requiere su capacidad backend,
  ambas tienen límite de 5.000 registros, neutralizan fórmulas y quedan
  auditadas.
- Los errores de creación, recepción y cancelación aparecen dentro del diálogo
  correspondiente y marcan el campo afectado.
- El controlador de Por Recibir está separado de la página principal y cancela
  solicitudes obsoletas para evitar resultados fuera de orden.

Validación automatizada del incremento:

- Migración generada y ausencia de cambios de esquema pendientes.
- Creación, recepción y cancelación idempotentes.
- Recepciones/cancelaciones parciales, integridad stock/Kardex y permisos.
- Historial inmutable con identificadores históricos legibles.
- Filtros remotos, exportación segura, alcance oficial y auditoría.
- `manage.py check`, pruebas backend específicas, lint, pruebas frontend y
  build de producción.

Este incremento cierra **Por Recibir**, pero no declara todavía Inventario
completo: faltan los incrementos 4 (Kardex transversal) y 5 (verificación de
producción).

### 4. Kardex

- Grilla transversal, filtros oficiales y exportación de resultados filtrados/oficial.
- Snapshots históricos, zona America/Santiago y alcance autorizado.
- Correcciones mediante reversa o ajuste autorizado; nunca update/delete.

Estado actual: **cierre funcional completado**. Kardex dispone de filtros
transversales y de columna aplicados antes de paginar, exportación de resultados
filtrados y exportación oficial con permisos separados, límite de 5.000 filas,
neutralización de fórmulas y auditoría de cada exportación.

- Inventario se divide en rutas reales para **Catálogo**, **Por recibir** y
  **Ubicaciones de inventario**. La URL, el historial del navegador y la
  pantalla activa se conservan sin apilar cuatro grillas en una sola vista.
- **Kardex** pasa a ser una pantalla global independiente. No existen Kardex
  separados para ventas, compras e inventario: todos consultan el mismo libro
  inmutable y se distinguen mediante tipo de movimiento y origen.
- La acción contextual **Ver Kardex** desde un producto abre esta pantalla
  global con la búsqueda del producto preservada en la URL.
- El Catálogo integra la búsqueda y filtros dentro de la misma tarjeta de la
  grilla, con una barra compacta reutilizable.
- Categoría, estado del producto, estado de stock, estado de recepción, tipo
  de movimiento y origen aceptan varios valores. Los booleanos continúan como
  tres estados y las fechas como rangos; no se fuerza selección múltiple donde
  el tipo de dato no corresponde.
- Las vistas personales existentes conservan compatibilidad: los conjuntos se
  serializan como CSV dentro de las claves ya autorizadas por el backend.
- Las rutas que no necesitan Catálogo o Por recibir evitan cargar sus grillas;
  Kardex no solicita categorías, resumen ni ubicaciones al abrirse.

### 5. Verificación de producción

Estado actual: **cierre funcional aprobado; endurecimiento de despliegue
pendiente**. Se aprobaron 121 pruebas backend, 15 pruebas frontend, lint, build,
`manage.py check`, control de migraciones y validación OpenAPI. También se
revisaron las rutas de escritura de stock, la inmutabilidad de Kardex y los
permisos de exportación.

Pendiente antes del despliegue productivo final:

- Pruebas de concurrencia PostgreSQL y exportaciones bajo carga.
- Datos representativos: 5.000 productos y 50.000 movimientos.
- Presupuestos p95, consultas y memoria documentados.
- Revisión WCAG 2.2 AA aplicable y flujos de teclado.
- OpenAPI, CI, variables, operación, reversión y aceptación manual.

## Puertas de calidad

Ningún incremento se declara terminado si existe una ruta ordinaria para
editar stock sin Kardex, una acción sensible sin autorización backend, una
exportación fuera del alcance del usuario, una migración sin verificación o
una función sin estados de carga, vacío y error.
