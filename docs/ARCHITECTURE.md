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

## Customer En Storefront

`ResolvePublicStorefrontContextService` deriva el tenant de la tienda desde el slug configurado y valida tenant/configuracion activa sin aceptar `tenantId` del caller. `PublicTenantProvider` usa ese boundary para exponer el contexto visual existente y el checkout lo revalida como autoridad. La identidad opcional se deriva de los repositories de sesion y se vincula solamente cuando pertenece al mismo tenant publico.

```text
ResolvePublicStorefrontContextService -> PublicTenantProvider
-> CreateStorefrontCheckoutService
-> Current Session -> active Customer User -> active Customer
-> tenant match
-> Order.customerId
-> OrderRepository.getByCustomer para /cuenta/pedidos
```

Guest y sesiones de personal no producen contexto Customer. Una sesion Customer invalida o inactiva falla cerrada; una identidad valida de otro tenant no se atribuye a la Order del Storefront actual.

## Order Reservation Lifecycle

`MockOrderRepository` crea o confirma una Order y todas sus reservas dentro de una sola llamada a `MockDatabaseStore.transact`. Las mutaciones de reserva sobre el draft viven en helpers de infraestructura compartidos con `MockInventoryRepository` y `MockOrderPaymentConfirmationRepository`; asi los repositorios usan el mismo algoritmo sin abrir transacciones anidadas ni duplicar la logica de allocations.

```text
OrderRepository.create / updateStatus
-> MockOrderRepository
-> MockDatabaseStore.transact
-> Order + InventoryReservation + InventoryBalance
```

El checkout e-commerce crea primero `Order.pending` y `Payment.pending`. Cada `OrderItem.id` queda namespaced por el `idempotencyKey` estable del intento, por lo que un retry conserva identidad y Orders distintas no comparten lineas. Para el pago mock con tarjeta, `OrderPaymentConfirmationRepository.confirm` valida Order, Payment, tenant, branch activa, relacion, importe y estados; en una unica transaccion reserva inventario y cambia ambos estados. Si falta disponibilidad, la transaccion de confirmacion revierte y el boundary compensa eliminando exclusivamente la pareja inmediata `pending/pending` sin reservas ni dependencias. Confirmar otra vez la misma pareja ya confirmada es idempotente.

```text
CreateStorefrontCheckoutService
-> OrderRepository.createWithPayment
-> OrderPaymentConfirmationRepository.confirm
-> MockDatabaseStore.transact
-> Payment.approved + Order.confirmed + InventoryReservation + InventoryBalance.reservedQuantity
```

Esta confirmacion no reduce `InventoryBalance.quantity` ni crea `InventoryMovement`; ese consumo fisico continua perteneciendo a Picking.

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

## Returns And Voids

`SaleReversalRepository` es el boundary compartido para consultar elegibilidad y procesar una
devolucion o anulacion. Su implementacion mock usa una sola llamada a
`MockDatabaseStore.transact`: Return/SaleVoid, refunds, entradas de inventario, salida cash,
estado de Payment y Sale, y CreditNote mock se confirman juntos. Los eventos se emiten solamente
despues del commit.

La anulacion POS normal exige que `Sale.cashShiftId` sea el turno original que continua abierto
para el actor y la sucursal. Una devolucion puede ocurrir en un turno posterior, pero cualquier
componente cash exige un turno abierto del actor en esa sucursal. La reversion de inventario usa
la ubicacion de los movimientos OUT historicos referenciados a la Sale. Lote, serial y kit se
bloquean mientras no exista una huella historica por linea suficiente para reconstruirlos.

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
