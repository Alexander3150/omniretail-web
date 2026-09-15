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
- Completion usa `ready_for_dispatch` para entrega a domicilio y `ready_for_pickup` para retiro. `immediate` falla cerrado.
- `DispatchApplicationService` reconstruye Session/User/Role/Branch, expone DTOs scoped y nunca acepta tenant o actor desde UI.
- Confirmar Dispatch exige Picking completo y reservas consumidas, copia `Order.transportMode`, es idempotente y no muta inventario.
- `markDelivered` es el owner atomico e idempotente de `Dispatch + Order: dispatched -> delivered`; no altera envio, inventario ni notificaciones.
- `OrderRepository.listByBranch` permite colas Logistics sin cargar Orders globales ni de otras sucursales.
- `StorePickupDeliveryRepository.confirm` posee `ready_for_pickup -> delivered`, registra evidencia autoritativa y no vuelve a descontar inventario. La conexion a UI/application authorization queda pendiente de la key canonica de permiso.
- `GetLogisticsItemTraceService` expone DTOs tenant+sucursal scoped desde movimientos y reservas reales, incluyendo allocations multiubicacion, lote/vencimiento y serie.
- Ecommerce/App solo pueden crear Orders domiciliarias; POS conserva inmediata, retiro y domicilio. `immediate` no entra a Logistics.

## Packing y Despacho

- `/logistica/despachos` consume la cola scoped de `DispatchApplicationService` para pedidos domiciliarios `ready_for_dispatch`.
- Packing es preparacion visual y no agrega un estado operativo intermedio ni consume inventario.
- La confirmacion persiste Dispatch y sus Packages en una sola transaccion; conteo y peso se derivan de los Packages.
- El Trace es read-only y se obtiene de `GetLogisticsItemTraceService` sobre evidencia canonica de Picking e InventoryMovement.

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
