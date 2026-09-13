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
