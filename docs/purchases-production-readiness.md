# Compras, abastecimiento y costos — NEXO

## Propósito

Este documento controla la implementación del módulo real de Compras conforme a
la sección 12 del documento maestro. Compras administra proveedores, órdenes,
líneas, moneda, aprobación, recepción, documentos, conciliación y costos
asociados. La pantalla visual anterior era una demostración y no constituye una
función terminada.

## Estado de entrega de la práctica — MVP funcional

Al 29 de julio de 2026, el alcance entregable permite demostrar el recorrido
operativo mínimo de Compras:

1. Crear una orden en borrador con proveedor, moneda, productos y destino.
2. Enviar a revisión, aprobar y emitir con motivo auditable.
3. Registrar uno o varios envíos desde el detalle de una orden elegible o desde
   la sección global Envíos e importaciones.
4. Mantener seguimiento, estimaciones, incidencias, custodia y cobros logísticos.
5. Confirmar recepciones parciales o totales; sólo este paso modifica stock y
   Kardex.

Este alcance es un MVP funcional para continuidad interna y demostración. No se
declara listo para producción ni reemplaza todavía todo el flujo administrativo
y contable de NEXO. Las limitaciones conocidas se conservan en la sección
“Pendiente para completar Compras”.

## Reglas que no se pueden vulnerar

- Registrar, revisar, aprobar o emitir una compra no aumenta el stock.
- Emitir una orden crea las unidades pendientes por recibir de sus líneas
  inventariables.
- Sólo confirmar la recepción física actualiza ubicación, stock y Kardex.
- Cada recepción parcial o total debe ejecutarse exactamente una vez, incluso
  ante reintentos o solicitudes concurrentes.
- Los productos sin control de inventario físico no generan Kardex.
- La moneda y el tipo de cambio quedan congelados con fecha, fuente y
  responsable.
- Los costos desconocidos no se presentan como cero ni como definitivos.
- Cancelar exige motivo y no revierte recepciones realizadas.
- Cerrar exige recepción y conciliación completas, salvo una excepción
  expresamente autorizada y auditada.

## Estados oficiales

`BORRADOR`, `EN_REVISION`, `APROBADA`, `EMITIDA`,
`PARCIALMENTE_RECIBIDA`, `RECIBIDA`, `CERRADA` y `CANCELADA`.

## Incrementos

### 1. Núcleo de Compras

- Proveedores con identidad tributaria, contacto, condiciones y estado.
- Órdenes y líneas con importes originales, equivalencia contable y snapshots.
- Transiciones explícitas, permisos backend, idempotencia y auditoría.

### 2. Integración con Inventario

- Compromisos por línea y ubicación enlazados a Por recibir.
- Recepciones parciales y totales mediante el servicio oficial de Inventario.
- Trazabilidad orden → línea → pendiente → recepción → Kardex.

### 3. Moneda, conciliación y costo aterrizado

- Flete, seguro, aduana, impuestos no recuperables y otros costos atribuibles.
- Distribución por cantidad, valor u otra regla documentada.
- Calidad `CONFIRMED`, `INCOMPLETE`, `INFERRED`, `CONFLICTING` o `UNKNOWN`.

### 4. Experiencia operativa

- Secciones Órdenes, Proveedores, Envíos e importaciones y Recepción física.
- Grillas remotas compartidas, filtros, vistas personales y exportaciones.
- Errores dentro del formulario, estados de carga/vacío/error y accesibilidad.

## Puertas de calidad

El módulo no se declara terminado sin permisos por acción, OpenAPI, auditoría
legible, migraciones verificadas, pruebas de integración, exportación segura,
pruebas frontend, lint, build y validación concurrente posterior en PostgreSQL.

### 5. Envíos e importaciones

El flujo visible se separa deliberadamente en tres conceptos:

1. La orden registra qué se compra y sus importes.
2. El envío explica dónde está el pedido, quién lo gestiona, la estimación,
   incidencias, Aduanas y cobros adicionales.
3. La recepción física confirma unidades y es el único paso que cambia stock y
   Kardex. Es la única bandeja operativa visible para recepciones.

#### Bandeja única de recepción física

La pantalla independiente **Por recibir** se retiró de la navegación de
Inventario para evitar dos puntos de operación. El registro pendiente continúa
existiendo internamente como fuente única para cantidades, idempotencia,
trazabilidad y Kardex.

Recepción física muestra conjuntamente:

- compromisos creados automáticamente al emitir una orden de compra;
- recepciones esperadas registradas manualmente desde el producto.

Cada fila identifica su origen. Recibir actualiza stock y crea Kardex una sola
vez; cancelar cierra unidades sin modificar stock; el historial conserva cada
operación. Los accesos históricos de Inventario redirigen a esta bandeja.

Estados logísticos: `PREPARANDO`, `DESPACHADO`, `EN_TRANSITO`,
`EN_ADUANA`, `RETENIDO`, `LIBERADO`, `EN_REPARTO`, `ENTREGADO`,
`CON_INCIDENCIA` y `CANCELADO`.

Los eventos son inmutables, idempotentes y conservan usuario, fecha,
explicación, estado, custodia, nueva estimación y evidencia. Los cobros
conservan monto y moneda originales, conversión CLP, fuente, motivo, respaldo y
estado.

El umbral USD 5.000 es una alerta operativa interna configurable mediante
`PURCHASE_CUSTOMS_ALERT_THRESHOLD_USD`; no se presenta como una ley universal
ni reemplaza la confirmación con courier, Aduanas o agente de aduanas.

#### Permisos

- Lectura: usuarios autorizados de Compras.
- Gestión completa logística: Administrador, Finanzas/Comercial y RR. HH.
- Avances, incidencias y entregas: también Operativo.
- Cobros y exportación oficial logística: Administrador, Finanzas/Comercial y
  RR. HH.
- Consulta no crea ni modifica información.

RR. HH. recibe estas capacidades logísticas sin obtener implícitamente permisos
para aprobar, emitir, cancelar o cerrar órdenes.

#### Pendiente para completar Compras

- Facturas, notas de crédito, pagos y conciliación documental.
- Asignación productiva de costo aterrizado.
- Adjuntos documentales y validación concurrente definitiva en PostgreSQL.
- Cobertura OpenAPI final y prueba integral por usuarios de NEXO.
