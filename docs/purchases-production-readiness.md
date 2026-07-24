# Compras, abastecimiento y costos — SERKAN

## Propósito

Este documento controla la implementación del módulo real de Compras conforme a
la sección 12 del documento maestro. Compras administra proveedores, órdenes,
líneas, moneda, aprobación, recepción, documentos, conciliación y costos
asociados. La pantalla visual anterior era una demostración y no constituye una
función terminada.

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

- Secciones Órdenes, Proveedores y Recepciones.
- Grillas remotas compartidas, filtros, vistas personales y exportaciones.
- Errores dentro del formulario, estados de carga/vacío/error y accesibilidad.

## Puertas de calidad

El módulo no se declara terminado sin permisos por acción, OpenAPI, auditoría
legible, migraciones verificadas, pruebas de integración, exportación segura,
pruebas frontend, lint, build y validación concurrente posterior en PostgreSQL.

