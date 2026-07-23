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

### 2. Ubicaciones y custodia

- Ubicaciones tipadas: bodega, domicilio bajo custodia, tránsito,
  cliente/faena y otro.
- Saldos de producto por ubicación cuya suma coincide con el stock total.
- Transferencias atómicas con origen, destino, cantidad, responsable, fecha,
  motivo y evidencia/referencia cuando corresponda.
- Migración explícita del stock existente a una ubicación inicial.

### 3. Por Recibir

- Ubicación destino y referencias futuras sin aumentar stock al crear.
- Filtros, ordenamiento, preferencias, vistas y exportaciones mediante el
  núcleo común.
- Recepción/cancelación parcial idempotente y protegida contra concurrencia.

### 4. Kardex

- Grilla transversal, filtros oficiales y exportación de vista/oficial.
- Snapshots históricos, zona America/Santiago y alcance autorizado.
- Correcciones mediante reversa o ajuste autorizado; nunca update/delete.

### 5. Verificación de producción

- Pruebas de permisos, concurrencia PostgreSQL, migraciones y exportaciones.
- Datos representativos: 5.000 productos y 50.000 movimientos.
- Presupuestos p95, consultas y memoria documentados.
- Revisión WCAG 2.2 AA aplicable y flujos de teclado.
- OpenAPI, CI, variables, operación, reversión y aceptación manual.

## Puertas de calidad

Ningún incremento se declara terminado si existe una ruta ordinaria para
editar stock sin Kardex, una acción sensible sin autorización backend, una
exportación fuera del alcance del usuario, una migración sin verificación o
una función sin estados de carga, vacío y error.
