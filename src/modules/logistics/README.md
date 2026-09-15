# logistics

Responsable: Riquelme

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

## Contracts que consume

OrderRepository, PickingRepository, DispatchRepository, InventoryRepository

## Reglas

- No duplicar entities de `core/`.
- No acceder directamente a LocalStorage.
- Usar repositories desde `RepositoryProvider`.
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.

## Foundation Picking

- `PickingApplicationService` es el boundary autoritativo para la futura Mesa de Picking; no acepta tenant, actor ni assignee desde la UI.
- Cola y detalle se exponen como DTOs tenant+sucursal scoped, incluyendo progreso y trazabilidad.
- Inventory conserva la formula de disponibilidad que distingue reserva propia, reservas ajenas y stock libre.
- Assignment, release, incidencias y completion tienen persistencia/transacciones mock; completion avanza Picking y Order atomicamente.
- Tomar una orden avanza `confirmed -> preparing`; el primer consumo real avanza `preparing -> picking`.
- Completion crea Packing persistente y mueve la Order a `packing`. Packing finaliza en `ready_for_dispatch` para domicilio o `ready_for_pickup` para retiro. `immediate` falla cerrado.
- `DispatchApplicationService` reconstruye Session/User/Role/Branch, expone DTOs scoped y nunca acepta tenant o actor desde UI.
- Confirmar Dispatch exige Picking completo y reservas consumidas, copia `Order.transportMode`, es idempotente y no muta inventario.
- `markDelivered` es el owner atomico e idempotente de `Dispatch + Order: dispatched -> delivered`; no altera envio, inventario ni notificaciones.
- `OrderRepository.listByBranch` permite colas Logistics sin cargar Orders globales ni de otras sucursales.
- `StorePickupDeliveryRepository.confirm` posee `ready_for_pickup -> delivered`, registra evidencia autoritativa y no vuelve a descontar inventario. La conexion a UI/application authorization queda pendiente de la key canonica de permiso.
- `GetLogisticsItemTraceService` expone DTOs tenant+sucursal scoped desde movimientos y reservas reales, incluyendo allocations multiubicacion, lote/vencimiento y serie.
- Ecommerce/App solo pueden crear Orders domiciliarias; POS conserva inmediata, retiro y domicilio. `immediate` no entra a Logistics.

## Packing y Despacho

- `/logistica/despachos` consume la cola scoped de `DispatchApplicationService` para pedidos domiciliarios `ready_for_dispatch`.
- Packing persiste checklist, peso/bultos y evidencia de etiqueta; no consume inventario.
- La confirmacion persiste Dispatch y materializa sus Packages desde la Packing finalizada en una sola transaccion.
- El Trace es read-only y se obtiene de `GetLogisticsItemTraceService` sobre evidencia canonica de Picking e InventoryMovement.

## Mesa de Picking

- `/logistica/picking` consume exclusivamente `PickingApplicationService` con contexto confiable de tenant y sucursal.
- La cola muestra pedidos pendientes, asignados y en progreso, con cliente, modalidad de entrega y progreso autoritativo.
- La UI registra cantidades objetivo y series canonicas; las allocations, FEFO, reservas y movimientos permanecen bajo autoridad del repository.
- Assignment, incidencias, liberacion y completion conservan permisos, idempotencia y transiciones del dominio existentes.
- Completar una entrega domiciliaria la deja disponible automaticamente para `/logistica/despachos`.

## Estructura futura

```text
logistics/
|-- pages/
|-- components/
|-- application/
|   |-- dto/
|   |-- mappers/
|   `-- services/
|-- hooks/
|-- validation/
|-- navigation.ts
|-- permissions.ts
`-- index.ts
```
