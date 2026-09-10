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

`ReceiptRepository.replaceLines` y `ReceiptRepository.replaceIncidents` persisten el estado completo de una recepcion en progreso. Las incidencias conservan su identidad al editarse y desaparecen del conjunto al eliminarse; `ReceiptLine.rejectedQuantity` es un snapshot derivado de la suma de `ReceiptIncident.quantityAffected`, no una entrada independiente.

`InventoryAdjustmentRepository` administra documentos auditables de ajuste mediante `InventoryAdjustment`. Cada ajuste tiene `number` unico por tenant y anio con formato `AJ-YYYY-#####`, `branchId`, `productId`, `locationId` opcional, `InventoryAdjustmentType`, `reason`, `notes` opcional, `quantityBefore`, `quantityAfter`, `delta`, actor opcional y `createdAt`. `delta` se persiste como snapshot y es `quantityAfter - quantityBefore`: `manualIncrease` exige delta positivo, `manualDecrease` y `waste` exigen delta negativo, y `countCorrection` acepta delta positivo o negativo. El repositorio no modifica balances, no crea movimientos y no genera documentos externos; un application service futuro debe orquestar stock con un unico `InventoryMovement` referenciado por `referenceType = "inventoryAdjustment"` y `referenceId = adjustment.id`.

`InventoryTransferRequestRepository` administra solicitudes de transferencia entre sucursales. `requestingBranchId` es la sucursal que necesita el producto y `sourceBranchId` es la sucursal proveedora/origen futuro. Las solicitudes usan `InventoryTransferRequestStatus` y `InventoryTransferReason`; crear/aprobar/rechazar no mueve stock ni crea `InventoryMovement`. Los estados fisicos legacy de la solicitud se conservan solo por compatibilidad; una vez creado un `InventoryTransfer`, el lifecycle fisico canonico se consulta en `InventoryTransfer`. `receivedQuantity` es opcional y se completa solo cuando una recepcion futura confirme cantidades.

`InventoryTransferRepository` administra la ejecucion fisica canonica del traslado entre sucursales mediante `InventoryTransfer` e `InventoryTransferItem`. El traslado fisico tiene `number` unico por tenant y anio, `sourceBranchId`, `destinationBranchId`, estado `preparing/inTransit/received/cancelled`, actores operativos opcionales y fechas de despacho/recepcion/cancelacion. `getByNumber` requiere `tenantId` porque el numero no es global. Los items soportan multiples productos y separan `requestedQuantity`, `dispatchedQuantity` y `receivedQuantity`; `requestedQuantity` debe ser mayor que 0, `dispatchedQuantity` no puede superar lo solicitado y `receivedQuantity` no puede superar lo despachado. El repositorio no modifica balances, no crea movimientos y no genera documentos; esas operaciones pertenecen a application services futuros.

`SupplierProductRepository` administra la relacion producto-proveedor, incluyendo unidad de compra por proveedor, factor hacia unidad base, costo, minimo, lead time, preferred y `SupplierCostTier`.

`CustomerPaymentMethodRepository` administra metodos de pago guardados del cliente. El contrato persiste solo datos seguros de referencia (`providerPaymentMethodId`, brand, last4, vencimiento, cardholderName, default y estado). No reemplaza `Payment`, que conserva el pago historico de una compra concreta.

`SavedPaymentMethod` y `SavedPaymentMethodRepository` son aliases legacy/de compatibilidad hacia `CustomerPaymentMethod` y `CustomerPaymentMethodRepository`. No deben usarse como contratos nuevos.

La logica de precio efectivo vive en `core/pricing` como funcion pura reutilizable por Catalog, Storefront, POS y app movil. No pertenece a Shared UI.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.
