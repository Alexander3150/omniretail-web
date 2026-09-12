# Contratos

ENTITY: modelo compartido del dominio. Vive en `src/core/entities`.

DTO: forma de datos de una operacion especifica. Vive dentro del modulo que implementa esa operacion.

MAPPER: convierte DTO a Entity o API DTO a Entity. Tambien pertenece al modulo.

REPOSITORY: contrato de acceso a datos definido en `src/core/repositories`.

MOCK REPOSITORY: implementacion temporal frontend que usa `MockDatabaseStore`.

`ProductMediaRepository` es el contrato compartido para consultar y administrar referencias de imagenes de producto sin acoplar modulos a seeds, LocalStorage o assets fisicos.

`PromotionRepository` es el contrato compartido para crear, editar y consultar promociones aplicables. La aplicabilidad debe considerar tenant, producto, fecha, canal y scope de sucursal; no basta con `status=active`.

`ProductPriceHistoryRepository` es el contrato compartido para leer y registrar cambios de precio base de producto. El mock debe escribir historial cuando cambia `Product.salePrice` desde el flujo comun de `ProductRepository.update`.

`Product.baseUnitId` representa la unidad base de inventario. `Product.saleUnitId` representa la unidad/presentacion normal de venta; los datos legados sin `saleUnitId` se normalizan a `baseUnitId`.

`UnitRepository` administra `Unit` y expone operaciones de consulta/reemplazo de `UnitConversion` por producto. `Unit.category` es la clasificacion canonica de la unidad (`unit`, `weight`, `length`, `volume`, `other`) y no depende de `code`, `name` ni `symbol`. `UnitConversion` no debe duplicarse en entidades de producto o proveedor.

`AttributeRepository.replaceValuesForProduct` permite persistir el conjunto completo de atributos key/value de un producto sin crear entidades paralelas de atributos.

`ProductSalesPriceTierRepository` administra precios mayoristas de venta por producto. Sus tiers usan `minQuantity` y `unitPrice`, son distintos de promociones y no representan costos de proveedor.

`ProductInventorySettings` administra configuracion operativa por `tenantId + productId + branchId`: `minStock`, `reorderPoint` opcional y `defaultLocationId` opcional. `InventoryRepository` es el owner del contrato mediante `getProductInventorySettings` y `upsertProductInventorySettings`. `InventoryBalance` sigue representando stock real; sus campos `minStock/reorderPoint` son compatibilidad legacy temporal.

`InventoryMovement` es historico append-only. `quantity` conserva la cantidad del movimiento y `type` define su direccion operacional. `quantityBefore` y `quantityAfter` son opcionales y solo deben escribirse cuando la operacion conoce esos valores en el momento de registrar el movimiento.

`InventoryRepository` tambien administra `InventoryReservation`, atribuida a `OrderItem` y compuesta por allocations que persisten el `InventoryBalance.balanceId` exacto. `reserveForOrderItem` y `releaseReservation` cambian solamente stock reservado; `consumeReservation` es atomica e idempotente por `operationId`, consume exclusivamente las allocations originales y crea un `InventoryMovement.out` por balance/ubicacion. La reserva no depende de POS, ecommerce, app movil, picking ni dispatch.

`OrderRepository` integra el lifecycle de reservas dentro de la misma transaccion mock de Order. `create` y `createWithPayment` con estado `confirmed`, y `updateStatus` desde `pending` hacia `confirmed`, reservan todos los items `physical` con `tracking.stock = true`; cancelar libera el remanente de las reservas existentes. `CreateOrderInput.idempotencyKey` es opcional y, cuando existe, se persiste en Order junto con el fingerprint del payload para impedir Orders y reservas duplicadas. Servicios, productos sin stock y kits sin resolucion de componentes no generan reservas.

`OrderPaymentConfirmationRepository.confirm` es el boundary de aprobacion mock del pago de una Order e-commerce. Exige Payment y Order relacionados, mismo tenant, branch activa coincidente, importe total equivalente, un metodo persistido permitido por `ecommercePaymentPolicy` y el par de estados `pending/pending` o `approved/confirmed`. La reserva, `Payment.approved` y `Order.confirmed` se persisten en una sola transaccion; un fallo de stock no deja cambios parciales y un retry no duplica reservas. La operacion solo incrementa `reservedQuantity`: el consumo fisico y `InventoryMovement.out` pertenecen a Picking.

`PickingRepository.updateItem` exige `operationId` y actor cuando cambia `pickedQuantity`. Cada incremento consume solamente el delta desde las allocations persistidas de la `InventoryReservation`, en su orden original, dentro de la misma transaccion mock que actualiza el item. Los reintentos identicos no duplican movimientos y reutilizar una operacion con otro payload produce conflicto. El estado `completed` de `PickingOrder` valida que sus items fisicos y reservas requeridas esten completos, pero no vuelve a consumir inventario.

`SaleConfirmationRepository.confirm` mantiene la salida directa de inventario para una Sale sin `sourceOrderId`. Cuando existe `sourceOrderId`, valida dentro de la transaccion que la Order pertenezca al mismo tenant y branch, no este cancelada, coincida en productos y cantidades, y que cada `OrderItem` fisico con stock conserve una `InventoryReservation` coherente en estado `active` o `consumed`; en ese caso la Sale no crea un segundo movimiento OUT porque Picking es responsable de consumir la reserva. Una reserva ausente, liberada o inconsistente rechaza toda la confirmacion sin fallback a inventario directo.

`CashShiftRepository` administra apertura, consulta y cierre de turnos mediante operaciones
tenant-scoped. La unicidad de turno abierto es `tenantId + userId + branchId` y se protege dentro de
la transaccion de apertura. El cierre recibe efectivo contado y deriva expected/difference de la
fuente canonica; no acepta expected cash del caller.

`CashMovementRepository` administra el agregado separado `CashMovement`. Su consulta requiere
`tenantId + cashShiftId`, valida primero el turno y devuelve solo sus movimientos en orden estable.
El registro valida turno abierto, tenant, sucursal, actor, tipo, monto positivo finito y razon no
vacia. Los montos siguen siendo positivos; `CashMovementType` define ingreso o egreso.

`SalesRepository.getByDocumentNumber` y `getByIdScoped` exigen `tenantId + branchId`; son los
contratos de consulta para devoluciones y no requieren `getAll()` ni filtrado en React.

`SaleReversalRepository` inspecciona cantidades retornables y elegibilidad y procesa
`processReturn`/`voidSale` de forma atomica e idempotente por
`tenantId + operation + idempotencyKey`. Una devolucion completada persiste `ReturnRequest` con
lineas e importe derivado, uno o varios `RefundTransaction` sobre los Payment originales,
movimientos IN cuando corresponden, salida de caja solo por el componente cash y una
`CreditNote` mock. El estado final de Sale se deriva: parcial usa `partially_returned`, agotamiento
de todas las lineas usa `returned` y solo una anulacion usa `cancelled`.

`ReceiptRepository.replaceLines` y `ReceiptRepository.replaceIncidents` persisten el estado completo de una recepcion en progreso. Las incidencias conservan su identidad al editarse y desaparecen del conjunto al eliminarse; `ReceiptLine.rejectedQuantity` es un snapshot derivado de la suma de `ReceiptIncident.quantityAffected`, no una entrada independiente.

`ReceiptRepository.confirmReceiptInventory` confirma atomicamente receipt, lineas, incidencias, orden de compra e inventario. `Receipt.confirmationId` es idempotente por tenant: la misma identidad y fingerprint devuelve el receipt original sin repetir movimientos; un payload distinto genera conflicto y una recepcion parcial posterior usa otra identidad. `StockLot.expirationDate` es una fecha comercial UTC `YYYY-MM-DD`: el lote se mantiene vendible durante esa fecha y vence el dia siguiente.

`InventoryAdjustmentRepository` administra documentos auditables de ajuste mediante `InventoryAdjustment`. Cada ajuste tiene `number` unico por tenant y anio con formato `AJ-YYYY-#####`, `branchId`, `productId`, `locationId` opcional, `InventoryAdjustmentType`, `reason`, `notes` opcional, `quantityBefore`, `quantityAfter`, `delta`, actor opcional y `createdAt`. `delta` se persiste como snapshot y es `quantityAfter - quantityBefore`: `manualIncrease` exige delta positivo, `manualDecrease` y `waste` exigen delta negativo, y `countCorrection` acepta delta positivo o negativo. El repositorio no modifica balances, no crea movimientos y no genera documentos externos; un application service futuro debe orquestar stock con un unico `InventoryMovement` referenciado por `referenceType = "inventoryAdjustment"` y `referenceId = adjustment.id`.

`InventoryTransferRequestRepository` administra solicitudes de transferencia entre sucursales. `requestingBranchId` es la sucursal que necesita el producto y `sourceBranchId` es la sucursal proveedora/origen futuro. Las solicitudes usan `InventoryTransferRequestStatus` y `InventoryTransferReason`; crear/aprobar/rechazar no mueve stock ni crea `InventoryMovement`. Los estados fisicos legacy de la solicitud se conservan solo por compatibilidad; una vez creado un `InventoryTransfer`, el lifecycle fisico canonico se consulta en `InventoryTransfer`. `receivedQuantity` es opcional y se completa solo cuando una recepcion futura confirme cantidades.

`InventoryTransferRepository` administra la ejecucion fisica canonica del traslado entre sucursales mediante `InventoryTransfer` e `InventoryTransferItem`. El traslado fisico tiene `number` unico por tenant y anio, `sourceBranchId`, `destinationBranchId`, estado `preparing/inTransit/received/cancelled`, actores operativos opcionales y fechas de despacho/recepcion/cancelacion. `getByNumber` requiere `tenantId` porque el numero no es global. Los items soportan multiples productos y separan `requestedQuantity`, `dispatchedQuantity` y `receivedQuantity`; `requestedQuantity` debe ser mayor que 0, `dispatchedQuantity` no puede superar lo solicitado y `receivedQuantity` no puede superar lo despachado. El repositorio no modifica balances, no crea movimientos y no genera documentos; esas operaciones pertenecen a application services futuros.

`SupplierProductRepository` administra la relacion producto-proveedor, incluyendo unidad de compra por proveedor, factor hacia unidad base, costo, minimo, lead time, preferred y `SupplierCostTier`. `SupplierProduct.leadTimeDays` es el dato especifico; el `Supplier.leadTimeDays` expuesto a consumidores agregados es una proyeccion read-only calculada como el maximo de las relaciones activas y queda `undefined` cuando no hay ninguna.

`CustomerPaymentMethodRepository` administra metodos de pago guardados del cliente. El contrato persiste solo datos seguros de referencia (`providerPaymentMethodId`, brand, last4, vencimiento, cardholderName, default y estado). No reemplaza `Payment`, que conserva el pago historico de una compra concreta.

`SavedPaymentMethod` y `SavedPaymentMethodRepository` son aliases legacy/de compatibilidad hacia `CustomerPaymentMethod` y `CustomerPaymentMethodRepository`. No deben usarse como contratos nuevos.

La logica de precio efectivo vive en `core/pricing` como funcion pura reutilizable por Catalog, Storefront, POS y app movil. No pertenece a Shared UI.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.
