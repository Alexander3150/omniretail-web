# Arquitectura OmniRetail

`app/` contiene rutas y layouts de Next.js. `core/` define entities, enums, types y repository contracts sin React. `infrastructure/` implementa persistencia mock, LocalStorage encapsulado, repositories mock y eventos. `modules/` contiene las features por integrante. `shared/` contiene UI, hooks y utilidades comunes. `config/` centraliza navegacion, permisos, estados y politicas.

Flujo actual:

```text
UI
-> module service / mapper
-> Repository contract
-> MockRepository
-> MockDatabase
```

Flujo futuro:

```text
UI
-> Repository contract
-> ApiRepository
-> Backend
```

## Order Reservation Lifecycle

`MockOrderRepository` crea o confirma una Order y todas sus reservas dentro de una sola llamada a `MockDatabaseStore.transact`. Las mutaciones de reserva sobre el draft viven en un helper interno de infraestructura compartido con `MockInventoryRepository`; asi ambos repositorios usan el mismo algoritmo sin abrir transacciones anidadas ni duplicar la logica de allocations.

```text
OrderRepository.create / updateStatus
-> MockOrderRepository
-> MockDatabaseStore.transact
-> Order + InventoryReservation + InventoryBalance
```

`MockPickingRepository.updateItem` usa el mismo patron transaccional para persistir el incremento de `PickingItem.pickedQuantity`, consumir las allocations originales de la reserva y crear los movimientos OUT por ubicacion. La mutacion de consumo se comparte con `MockInventoryRepository` y no abre una transaccion anidada.

```text
PickingRepository.updateItem
-> MockPickingRepository
-> MockDatabaseStore.transact
-> PickingItem + InventoryReservation + InventoryBalance + InventoryMovement
```

`MockSaleConfirmationRepository.confirm` valida dentro de su transaccion si `sourceOrderId` acredita ownership mediante la Order y sus reservas. Las ventas directas conservan el OUT propio; las vinculadas validas persisten Sale, Payment y CashMovement sin modificar reservas, balances ni movimientos de inventario.

## Cash Shift Lifecycle

`CashShiftRepository` administra exclusivamente el turno y expone consultas tenant-scoped.
`CashMovementRepository` administra los movimientos y valida el ownership del turno antes de
consultar o registrar. Los mocks protegen apertura unica, estado y relaciones dentro de
`MockDatabaseStore.transact`.

```text
POS cash application services
-> CashShiftRepository + CashMovementRepository
-> MockDatabaseStore.transact
-> CashShift + CashMovement
```

`core/cash/cashShiftTotals` es la semantica monetaria compartida por el resumen de aplicacion y el
cierre de infraestructura. Los movimientos referenciados a Sale ya representan el componente cash
de la venta, por lo que el resumen no vuelve a sumar Sale ni Payment.

## Navegacion Privada

Los modulos declaran sus entradas en `src/modules/*/navigation.ts`.
`src/config/navigation.ts` agrega esas listas junto con la navegacion base y
el layout privado entrega `navigationConfig` al `Sidebar`.

```text
modules/*/navigation.ts
-> config/navigation.ts
-> PrivateLayout
-> Sidebar
```

`Sidebar` renderiza `NavigationItem[]` sin importar modulos concretos. La
metadata de permisos se conserva en los items; cuando Auth este integrado, la
sesion podra filtrar la navegacion antes de renderizar el Sidebar.

## Private Shell

El shell privado organiza el backoffice como una barra lateral de altura
completa y una columna de contenido con header ligero y main.

```text
PrivateShell
|-- Sidebar
`-- Content column
    |-- PrivateHeader
    |   |-- ActiveBranch
    |   |-- Notifications
    |   `-- User slot
    `-- Main
```

La sucursal actual es contexto global del shell privado y se obtiene desde
`BranchRepository`. En una fase posterior Auth/Role/BranchScope filtrara las
sucursales disponibles para cada empleado. Notifications queda preparado para
conectarse al centro de notificaciones real. UserMenu queda reservado para
Session -> User -> Profile cuando Auth/Profile este completo.
