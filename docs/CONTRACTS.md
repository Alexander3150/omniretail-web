# Contratos

ENTITY: modelo compartido del dominio. Vive en `src/core/entities`.

DTO: forma de datos de una operacion especifica. Vive dentro del modulo que implementa esa operacion.

MAPPER: convierte DTO a Entity o API DTO a Entity. Tambien pertenece al modulo.

REPOSITORY: contrato de acceso a datos definido en `src/core/repositories`.

MOCK REPOSITORY: implementacion temporal frontend que usa `MockDatabaseStore`.

`ProductRepository`, `CategoryRepository` y `UnitRepository` conservan sus operaciones globales
legacy por compatibilidad, pero todo flujo privado de Catalog debe usar sus variantes tenant-scoped
para listar, leer por identidad y mutar. Un ID de otro tenant se resuelve como inexistente y las
mutaciones scoped no permiten cambiar `tenantId`. Las conversiones de unidad por producto se leen y
reemplazan con el mismo scope del producto.

`BranchRepository.getActiveByTenant` y `getByIdScoped` son los boundaries operativos de sucursal.
`branchScope = all` significa todas las sucursales del tenant autenticado, nunca todas las globales;
`selected` aplica `allowedBranchIds` solo despues de verificar que User, Role y Branch pertenecen al
mismo tenant.

La sesion operativa Employee se reconstruye como
`Session -> User activo -> Tenant activo -> Role active del mismo tenant`. Login, finalizacion de
MFA y `CurrentSessionProvider` fallan cerrados si se rompe esa cadena. `CurrentSessionProvider`
escucha `role.changed` para revalidar una sesion ya publicada. Este requisito no rompe la resolucion
Customer cuando el usuario no utiliza Role ni crea roles o permisos nuevos.

`RoleRepository` expone `listByTenant`, `getByIdScoped`, `create`, `updateScoped` y `archiveScoped`.
Las fronteras de lectura y mutacion de Roles son tenant-scoped; no se expone un fallback global.
`Role.status` usa `RoleStatus` (`active`/`inactive`/`archived`) y `archiveScoped` lo fija en
`archived`. El payload mutable excluye `id`, `tenantId`, `isSystem`, `createdAt` y `updatedAt`.
La prohibicion de editar o archivar por completo un Role `isSystem` queda para los futuros
application services de Roles y permisos; el contrato compartido ya impide corromper el flag.

`ProductMediaRepository` es el contrato compartido para consultar y administrar referencias de imagenes de producto sin acoplar modulos a seeds, LocalStorage o assets fisicos. Acepta el `url` legacy y la fuente discriminada `url | mockAsset`; `isPrimary`, luego `sortOrder`, determina la seleccion publica entre fuentes validas.

`CatalogImageAssetRepository` persiste Blob y metadata (`id`, `tenantId`, MIME, bytes, dimensiones y fecha) fuera de `MockDatabaseStore`. `get` y `remove` exigen el tenant propietario. La implementacion frontend usa IndexedDB y los consumidores renderizan un `mockAsset` mediante Object URL temporal con revocacion al cambiar o desmontar.

`EcommerceConfig` conserva la configuración administrativa de la tienda y admite `contactPhone`/`contactEmail` opcionales. Su actualización usa un input explícito y el boundary administrativo reconstruye `Session -> User activo -> Tenant activo -> Role del mismo tenant`, exigiendo `admin.ecommerce_config.manage`; `tenantId`, actor y permisos nunca provienen del caller.

`GetPublicStorefrontConfigService.execute()` es el read model público mínimo del Storefront. Resuelve internamente el tenant por slug y solo publica nombre, estado, reglas públicas, contacto configurado y sucursales retornadas por `BranchRepository.getActiveByTenantAndType(tenantId, BranchType.store)`. No expone identificadores internos de configuración ni reutiliza esa consulta para fulfillment o disponibilidad operacional; `defaultBranchId` puede seguir apuntando a una sucursal `main`.

`PromotionRepository` es el contrato compartido para crear, editar y consultar promociones aplicables. La aplicabilidad debe considerar tenant, producto, fecha, canal y scope de sucursal; no basta con `status=active`. Los flujos privados de Catalog usan sus lecturas y actualizaciones tenant-scoped, y una promocion solo puede referenciar Products de su mismo tenant.

`ProductPriceHistoryRepository` es el contrato compartido para leer y registrar cambios de precio base de producto. El mock debe escribir historial cuando cambia `Product.salePrice` desde el flujo comun de `ProductRepository.update`.

`Product.baseUnitId` representa la unidad minima indivisible/canonica. `InventoryBalance`, `InventoryMovement`, reservas, lotes y seriales usan exclusivamente esa unidad. `Product.inventoryUnitId` es una presentacion preferida de inventario (display/input) y no crea otra fuente de stock; los datos legados sin este campo usan `baseUnitId` sin reescalar cantidades. `Product.saleUnitId` representa la presentacion de venta. `UnitConversion.factor` se define en direccion `fromUnitId` (presentacion) -> `toUnitId` (`baseUnitId`), por lo que `cantidadPresentacion * factor = cantidadBase`. Las operaciones fallan si falta la conversion o si el factor no es finito y positivo.

No se migra automaticamente un producto legacy cuya `baseUnitId` pueda haber representado un empaque grande: la direccion historica puede ser ambigua y reescalar balances, movimientos, reservas o lotes cambiaria su significado. Si ademas existen seriales, nunca se generan seriales sinteticos. Esa data debe corregirse mediante una migracion de dominio verificada o un reset explicito del entorno demo; hasta entonces, las operaciones que requieran la conversion fallan cerradas.

`UnitRepository` administra `Unit` y expone operaciones de consulta/reemplazo de `UnitConversion` por producto. `Unit.category` es la clasificacion canonica de la unidad (`unit`, `weight`, `length`, `volume`, `other`) y no depende de `code`, `name` ni `symbol`. `UnitConversion` no debe duplicarse en entidades de producto o proveedor.

`AttributeRepository.replaceValuesForProduct` permite persistir el conjunto completo de atributos key/value de un producto sin crear entidades paralelas de atributos.

`ProductSalesPriceTierRepository` administra precios mayoristas de venta por producto. Sus tiers usan `minQuantity` y `unitPrice`, son distintos de promociones y no representan costos de proveedor.

`ProductInventorySettings` administra configuracion operativa por `tenantId + productId + branchId`: `minStock`, `reorderPoint` opcional y `defaultLocationId` opcional. `InventoryRepository` es el owner del contrato mediante `getProductInventorySettings` y `upsertProductInventorySettings`. `InventoryBalance` sigue representando stock real; sus campos `minStock/reorderPoint` son compatibilidad legacy temporal.

`InventoryMovement` es historico append-only. `quantity` conserva la cantidad del movimiento y `type` define su direccion operacional. `quantityBefore` y `quantityAfter` son opcionales y solo deben escribirse cuando la operacion conoce esos valores en el momento de registrar el movimiento.

`InventoryRepository` tambien administra `InventoryReservation`, atribuida a `OrderItem` y compuesta por allocations que persisten el `InventoryBalance.balanceId` exacto. `reserveForOrderItem` y `releaseReservation` cambian solamente stock reservado; `consumeReservation` es atomica e idempotente por `operationId`, consume exclusivamente las allocations originales y crea un `InventoryMovement.out` por balance/ubicacion. La reserva no depende de POS, ecommerce, app movil, picking ni dispatch.

`OrderRepository` separa politica de creacion y transiciones existentes. `create` solo admite `pending | confirmed`; `createWithPayment` solo admite `pending`. Los estados avanzados, terminales y `cancelled` se rechazan antes de abrir la transaccion, por lo que no dejan Order, Payment ni reservas parciales. `create` con estado `confirmed`, y `updateStatus` desde `pending` hacia `confirmed`, reservan todos los items `physical` con `tracking.stock = true`; cancelar libera el remanente de las reservas existentes. `CreateOrderInput.idempotencyKey` es opcional y, cuando existe, se persiste en Order junto con el fingerprint del payload para impedir Orders y reservas duplicadas. Servicios, productos sin stock y kits sin resolucion de componentes no generan reservas.

`OrderRepository.create` y `createWithPayment` aplican la politica canonica `OrderSource + DeliveryMethod`: ecommerce/app solo permiten domicilio y POS permite inmediata, retiro o domicilio. `listByBranch(tenantId, branchId)` valida la sucursal del tenant y reduce el dataset dentro del repository; no requiere `getAll()` ni cargar un tenant completo para filtrar despues.

`AddressSnapshot.recipientPhone` es el telefono de contacto de quien recibe el pedido y no necesariamente del comprador. Se conserva opcional para leer Orders legacy y representar otros metodos de entrega, pero `OrderRepository.create` y `createWithPayment` lo exigen y validan con la politica canonica cuando `deliveryMethod = home_delivery`; tambien forma parte del fingerprint idempotente.

`StorePickupContactSnapshot` conserva nombre y telefono de quien retirara una Order `store_pickup`. Es obligatorio para esa modalidad, se prohibe para las demas, valida el telefono con `validatePhoneNumber()` y participa en los fingerprints de Order y confirmacion POS. No sustituye ni reutiliza `deliveryAddress`.

`OrderPaymentConfirmationRepository.confirm` es el boundary de aprobacion mock del pago de una Order e-commerce. Exige Payment y Order relacionados, mismo tenant, branch activa coincidente, importe total equivalente, un metodo persistido permitido por `ecommercePaymentPolicy` y el par de estados `pending/pending` o `approved/confirmed`. La reserva, `Payment.approved` y `Order.confirmed` se persisten en una sola transaccion; un fallo de stock no deja cambios parciales y un retry no duplica reservas. Ante disponibilidad insuficiente, la implementacion mock descarta como compensacion solamente la Order y Payment inmediatos que sigan `pending`, esten relacionados y no tengan reservas ni dependencias; metodos diferidos y errores inesperados no usan ese cleanup. La operacion solo incrementa `reservedQuantity`: el consumo fisico y `InventoryMovement.out` pertenecen a Picking.

`PickingRepository` exige `tenantId + branchId` en todas sus lecturas y mutaciones; esos IDs y el actor solo llegan despues de validarse en `PickingApplicationService`. `assign` resuelve competencia y cambia atomicamente `Order.confirmed -> preparing`; `release` conserva progreso y agrega `PickingAssignmentRelease` append-only. `updateItem` exige `operationId` cuando cambia `pickedQuantity`; el primer incremento real cambia `Order.preparing -> picking` dentro de la misma transaccion que consume el delta reservado, actualiza balance/reservado y crea `InventoryMovement.out`. Los reintentos identicos no duplican movimientos y reutilizar una operacion con otro payload produce conflicto. `complete` valida lineas, reservas e incidencias y cambia atomicamente a `PickingOrder.completed + Order.packing + Packing.in_progress`; `immediate` falla cerrado. Completion nunca vuelve a tocar inventario.

`PackingRepository` exige `tenantId + branchId`, actor, `operationId`, fingerprint y `expectedVersion` para cada mutacion. Persiste checklist y, solo para `home_delivery`, peso, cantidad de bultos y evidencia de generacion/impresion de etiqueta. Cambiar peso o bultos invalida la etiqueta vigente. Finalizar cambia atomicamente Packing y Order a `ready_for_dispatch` o `ready_for_pickup`; Packing nunca modifica reservas, balances ni `InventoryMovement`. Dispatch exige una Packing domiciliaria finalizada y materializa sus Packages desde esa fuente canonica, sin aceptar bultos autoritativos de React.

`Order.notificationContact` es un snapshot discriminado opcional: `send` exige email canonico normalizado, `not_applicable` prohibe email y `undefined` conserva semantica legacy/unknown. Forma parte del fingerprint de creacion. Checkout e-commerce siempre persiste `send` desde el formulario; POS acepta el contrato opcional sin exigirlo todavia a su UI.

`DispatchRepository.confirm` es el unico boundary de confirmacion de envio y reemplaza el CRUD generico como autoridad. Recibe scope confiable (`tenantId`, `branchId`, actor) desde `DispatchAuthorizationContext`, valida Order/Picking/reservas/incidencias y usa `Order.transportMode`. `third_party` exige carrier y tracking; `own_fleet` permite ambos opcionales. Persiste en una transaccion Dispatch+Order+operacion idempotente y, cuando aplica, una Notification email simulada deduplicada. `DispatchRepository.markDelivered` es el owner exclusivo de `Order.dispatched + Dispatch.dispatched -> delivered`: persiste `deliveredAt` atomicamente, permite retry coherente y rechaza cambios a carrier/tracking/transporte. Ninguna de las dos operaciones modifica inventario; markDelivered tampoco crea notificaciones. Sus lecturas son tenant scoped y opcionalmente branch scoped.

`StorePickupDeliveryRepository.confirm` confirma exclusivamente una Order `store_pickup` tenant+sucursal scoped en `ready_for_pickup`. Persiste una sola evidencia con actor y `deliveredAt`, cambia la Order a `delivered` en la misma transaccion y protege reintentos mediante `operationId` y fingerprint. Una segunda operacion o un estado parcial incoherente falla cerrado. No crea ni modifica inventario.

`InventoryRepository.getPickingAvailability` es la unica proyeccion de disponibilidad para Picking. Resuelve el `PickingOrder/Order/product` tenant+sucursal scoped y calcula por balance, ubicacion, lote y serie: existencia fisica elegible, reserva remanente propia, reservas ajenas, stock libre y cantidad utilizable. La cantidad utilizable suma reserva propia y libre, pero excluye reservas de otras Orders; Logistics consume esta proyeccion y no replica la formula.

`InventoryRepository.getPickingFulfillmentTrace` devuelve evidencia read-only scoped por tenant+sucursal+Order+Picking. Une PickingItems con sus reservas y movimientos OUT reales y resuelve ubicacion, lote/vencimiento y serie dentro del mismo scope. Las allocations retornadas representan movimientos persistidos, no metadata unica de `PickingItem`, y la lectura no altera planners, reservas, FEFO, balances o movimientos.

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

`SalesRepository.listByBranch` es el boundary de lectura para historiales operativos POS: reduce el
dataset dentro del repository a la coincidencia exacta de `tenantId + branchId`. Cuando el historial
necesita relacionar `Sale.sourceOrderId`, `OrderRepository.getByIdsScoped` resuelve en una sola
consulta solo los IDs solicitados que pertenecen al mismo tenant y sucursal; ignora duplicados,
inexistentes y referencias fuera de scope. Los filtros funcionales se aplican despues sobre este
dataset ya autorizado y ninguna de estas lecturas modifica ventas, pedidos o inventario.

`SaleReversalRepository` inspecciona cantidades retornables y elegibilidad y procesa
`processReturn`/`voidSale` de forma atomica e idempotente por
`tenantId + operation + idempotencyKey`. Una devolucion completada persiste `ReturnRequest` con
lineas e importe derivado, uno o varios `RefundTransaction` sobre los Payment originales,
movimientos IN cuando corresponden, salida de caja solo por el componente cash y una
`CreditNote` mock. El estado final de Sale se deriva: parcial usa `partially_returned`, agotamiento
de todas las lineas usa `returned` y solo una anulacion usa `cancelled`.

`ReceiptRepository.replaceLines` y `ReceiptRepository.replaceIncidents` persisten el estado completo de una recepcion en progreso. Las incidencias conservan su identidad al editarse y desaparecen del conjunto al eliminarse; `ReceiptLine.rejectedQuantity` es un snapshot derivado de la suma de `ReceiptIncident.quantityAffected`, no una entrada independiente.

`ReceiptRepository.confirmReceiptInventory` confirma atomicamente receipt, lineas, incidencias, orden de compra e inventario. `Receipt.confirmationId` es idempotente por tenant: la misma identidad y fingerprint devuelve el receipt original sin repetir movimientos; un payload distinto genera conflicto y una recepcion parcial posterior usa otra identidad. `StockLot.expirationDate` es una fecha comercial UTC `YYYY-MM-DD`: el lote se mantiene vendible durante esa fecha y vence el dia siguiente.

`PurchaseOrderItem.purchaseToBaseFactor` es el snapshot historico de conversion capturado al guardar la linea. Receiving usa exclusivamente ese valor para convertir cantidades de compra a unidades base; `MockDatabaseStore` completa una sola vez los registros legacy que no lo tengan.

`InventoryAdjustmentRepository` administra documentos auditables de ajuste mediante `InventoryAdjustment`. Cada ajuste tiene `number` unico por tenant y anio con formato `AJ-YYYY-#####`, `branchId`, `productId`, `locationId` opcional, `InventoryAdjustmentType`, `reason`, `notes` opcional, `quantityBefore`, `quantityAfter`, `delta`, actor opcional y `createdAt`. `delta` se persiste como snapshot y es `quantityAfter - quantityBefore`: `manualIncrease` exige delta positivo, `manualDecrease` y `waste` exigen delta negativo, y `countCorrection` acepta delta positivo o negativo. `registerStockAdjustment` es el boundary atomico para el flujo operativo: valida el scope y la trazabilidad canonica, actualiza balance/lote/series y agrega los `InventoryMovement` referenciados por `referenceType = "inventoryAdjustment"` en la misma transaccion.

`InventoryTransferRequestRepository` administra solicitudes de transferencia entre sucursales. `requestingBranchId` es la sucursal que necesita el producto y `sourceBranchId` es la sucursal proveedora/origen futuro. Las solicitudes usan `InventoryTransferRequestStatus` y `InventoryTransferReason`; crear/aprobar/rechazar no mueve stock ni crea `InventoryMovement`. Los estados fisicos legacy de la solicitud se conservan solo por compatibilidad; una vez creado un `InventoryTransfer`, el lifecycle fisico canonico se consulta en `InventoryTransfer`. `receivedQuantity` es opcional y se completa solo cuando una recepcion futura confirme cantidades.

`InventoryTransferRepository` administra la ejecucion fisica canonica del traslado entre sucursales mediante `InventoryTransfer` e `InventoryTransferItem`. El traslado fisico tiene `number` unico por tenant y anio, `sourceBranchId`, `destinationBranchId`, estado `preparing/inTransit/received/cancelled`, actores operativos opcionales y fechas de despacho/recepcion/cancelacion. `getByNumber` requiere `tenantId` porque el numero no es global. Los items soportan multiples productos y separan `requestedQuantity`, `dispatchedQuantity` y `receivedQuantity`; `requestedQuantity` debe ser mayor que 0, `dispatchedQuantity` no puede superar lo solicitado y `receivedQuantity` no puede superar lo despachado. El repositorio no modifica balances, no crea movimientos y no genera documentos; esas operaciones pertenecen a application services futuros.

`SupplierProductRepository` administra la relacion producto-proveedor, incluyendo unidad de compra por proveedor, factor hacia unidad base, costo, minimo, lead time, preferred y `SupplierCostTier`. `SupplierProduct.leadTimeDays` es el dato especifico; el `Supplier.leadTimeDays` expuesto a consumidores agregados es una proyeccion read-only calculada como el maximo de las relaciones activas y queda `undefined` cuando no hay ninguna.

`CustomerPaymentMethodRepository` administra metodos de pago guardados del cliente. El contrato persiste solo datos seguros de referencia (`providerPaymentMethodId`, brand, last4, vencimiento, cardholderName, default y estado). No reemplaza `Payment`, que conserva el pago historico de una compra concreta.

`resolveCustomerAuthorizationContext` es la resolucion estricta del Customer actual para autoservicio y `resolveOptionalCustomerAuthorizationContext` reutiliza la misma validacion en boundaries que admiten invitados. Ambas derivan identidad desde Auth/User/Customer, exigen User y Customer activos y coherencia de tenant; ningun caller aporta `customerId`. El checkout compara ese tenant autenticado con el tenant publico antes de persistir `Order.customerId`.

`SavedPaymentMethod` y `SavedPaymentMethodRepository` son aliases legacy/de compatibilidad hacia `CustomerPaymentMethod` y `CustomerPaymentMethodRepository`. No deben usarse como contratos nuevos.

La logica de precio efectivo vive en `core/pricing` como funcion pura reutilizable por Catalog, Storefront, POS y app movil. No pertenece a Shared UI.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.

`AuthRepository.getEmployeeAuthSummariesByUserIds(tenantId, userIds)` es la unica lectura administrativa batch del estado de cuenta de empleados (admin-users, administration). Devuelve `EmployeeAuthSummary[]` (`userId`, `status: AccountStatus`, `mfaEnabled: boolean`, `lastLoginAt?`) -- nunca `passwordHashMock`, historial de contraseñas, `failedLoginAttempts`, secretos MFA, recovery codes, `MfaChallenge` ni tokens de invitacion. `userIds` se deduplica; un userId de otro tenant, inexistente, o sin `AuthAccount` todavia queda simplemente ausente del resultado, sin distinguir el motivo. Pensado para evitar N+1 en la tabla de Usuarios: una sola llamada batch, nunca `getById` en loop.

`AuthRepository.revokeAllSessionsByUserId(tenantId, userId)` revoca (marca `Session.revokedAt`, igual que `logout()`) todas las sesiones activas de un empleado, nunca solo la que origino el pedido. Idempotente: revocar sesiones ya revocadas no falla. Tenant-scoped: un userId de otro tenant no revoca nada. No recibe la identidad del actor que la dispara -- por eso no genera su propia entrada de auditoria (misatribuiria la accion); el caller administrativo que si conoce al actor real (`UpdateEmployeeService`) deja la entrada de auditoria correspondiente con una nota de que ademas revoco sesiones.

`UserRepository` gano `listByTenant(tenantId)` y `getByIdScoped(tenantId, id)` (mismo patron que `RoleRepository`/`BranchRepository`) y `updateScoped(tenantId, id, input)`, cuyo tipo excluye `tenantId`/`type`/`customerId` del payload editable -- administration nunca puede convertir un Employee en Customer ni mudarlo de tenant editando un usuario existente. `getAll`/`getById`/`update`/`updateStatus`/`getByEmail` se conservan sin cambios; `getByEmail` sigue siendo global a proposito porque es la misma fuente de unicidad de email que usa `login()` (Employee/Admin se resuelven sin restriccion de tenant ahi).

`ResendInvitationService` (administration) reintenta la invitacion de un empleado ya existente reutilizando `AuthRepository.inviteEmployee(userId)` tal cual -- no se extendio el contrato de Auth porque `inviteEmployee` ya es idempotente/seguro para reintentar (sin `AuthAccount`: crea una; en `password_reset_required`: reutiliza la misma cuenta y emite una invitacion nueva; `active` o cualquier otro estado: rechaza). `inviteEmployee(userId)` no recibe `tenantId` y no valida tenant internamente -- es seguro en `CreateEmployeeService` porque se llama justo despues de crear el User (ya tenant-scoped), pero `ResendInvitationService` recibe un `employeeId` arbitrario desde la tabla, asi que resuelve el empleado con `users.getByIdScoped(tenantId, employeeId)` ANTES de tocar Auth (mismo patron que `UpdateEmployeeService`), cerrando el gap cross-tenant que el propio `inviteEmployee` no cierra.

`CreateEmployeeService.execute()` y `ResendInvitationService.execute()` devuelven `EmployeeInvitationResult` (`{ employee: EmployeeDto; invitationToken: string | null }`) en vez de `EmployeeDto` a secas. `invitationToken` es el mismo `AuthRepository.InviteEmployeeResult.invitationToken` de ESA llamada puntual -- invitation-scoped, igual criterio que `RegisterCustomerResult.emailVerificationToken` (existe solo porque este entorno no envia correos reales). Nunca se agrega a `EmployeeDto`: esa interfaz sigue documentando explicitamente que jamas expone tokens, porque viaja en listados (`GetEmployeesService`) y eventos (`user.changed`/`auth.changed`), mientras que el token de invitacion no debe quedar recuperable por ningun medio salvo la respuesta de la accion que lo genero. La UI (`EmployeesPage`) lo guarda en estado local efimero para ofrecer "Copiar invitacion" una unica vez (flujo: Crear empleado -> Invitacion generada correctamente -> [copiar invitacion]) y lo descarta al cerrar el modal -- no se persiste en `localStorage` ni en ninguna tabla nueva.

`TenantOnboardingRepository.onboard()` (feature/tenant-onboarding) es el UNICO boundary infraestructural para dar de alta un Tenant nuevo -- Tenant + Branch inicial + Role admin (`isSystem: true`, catalogo canonico completo de permisos) + User admin + AuthAccount + BusinessCapabilitiesConfig + EcommerceConfig (`enabled: false` por default) + TenantSubscription se persisten como una unidad atomica REAL, en un solo `store.transact()` dentro de `MockTenantOnboardingRepository` que muta las 8 tablas directamente (mismo patron que `MockPickingRepository.assign()` para `db.pickingOrders`/`db.orders`). Esto es deliberado: `RepositoryRegistry` no expone `MockDatabaseStore`, y cada `Mock*Repository.create()` abre su propio `store.mutate()` independiente -- encadenar `tenants.create()` + `branches.create()` + `roles.create()` + ... desde `TenantOnboardingService` (Application) NO seria atomico. `TenantOnboardingService` es responsable de la politica (validar slug/email disponibles, resolver el Plan activo, calcular permisos canonicos) y nunca acepta como autoridad `tenantId`, `roleId`, la lista de permisos, `allowedBranchIds` ni el status de Subscription/AuthAccount -- todo se deriva server-side. `TenantRepository.create`, `BusinessConfigRepository.createCapabilities`/`createEcommerceConfig` y `AuthRepository.bootstrapEmployeeAccount` tambien se agregaron como capacidad minima de foundation (mismo patron `create` de Branch/Role/User), pero el flujo atomico real NO los usa por la misma razon de atomicidad -- `bootstrapEmployeeAccount` crea un AuthAccount YA `active` (nunca `password_reset_required` como `inviteEmployee`) y es el boundary narrow exclusivo de onboarding, nunca expuesto a UI. Este PR solo crea/asocia la TenantSubscription (status/dates/trial reales, nunca inventados) -- NO implementa entitlement enforcement, `/contratar`, pagos SaaS ni copia datos de `tenant-demo`; el nuevo Tenant nace limpio salvo defaults tecnicos minimos (BusinessCapabilitiesConfig con `supportsInventory`/`supportsUnitsAndPackaging` en true, resto en false).
