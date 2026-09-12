# OmniRetail Source Of Truth

Este documento es la fuente funcional autoritativa. El codigo TypeScript actual sigue siendo la verdad ejecutable de firmas y estructuras exactas.

## Jerarquia Documental

1. Codigo TypeScript actual.
2. `docs/SOURCE_OF_TRUTH.md`.
3. `docs/ARCHITECTURE.md`.
4. `docs/CONTRACTS.md`.
5. `docs/GIT_WORKFLOW.md`.
6. `docs/MODULE_OWNERSHIP.md`.
7. `docs/AI_WORKFLOW.md`.
8. `AGENTS.md` y `CLAUDE.md`.

Si dos documentos contradicen el codigo actual, no corregir silenciosamente el codigo. Reportar la inconsistencia antes de cambiar contratos compartidos.

## Multi-Tenant

Jerarquia: Platform -> Tenant / negocio -> Branch / sucursal. Las entidades de negocio pertenecen a tenant; las operativas relevantes tambien pertenecen a branch. El aislamiento entre tenants es obligatorio conceptualmente.

## Producto

Existe una sola Entity `Product`. No crear `StorefrontProduct`, `InventoryProduct` ni `PosProduct`. Product es consumido por Catalog, Storefront, Inventory, POS, Logistics y Purchasing cuando corresponde.

Termino visible estandar: Codigo / SKU. Diferenciar `id`, `sku`, `barcode` opcional y `supplierSku` en `SupplierProduct`.

## Product Media

`Product` y `ProductMedia` son conceptos separados. Product no contiene imagenes directamente; ProductMedia guarda referencias URL/path y permite cero, una o multiples imagenes por producto. Solo una imagen debe ser primaria y `sortOrder` define el orden visual.

Las imagenes demo actuales viven en `public/images/products/`. Los modulos deben consultar `ProductMediaRepository`; no deben importar `demoSeed` ni resolver logica leyendo `public/` directamente. `placeholder-product.webp` se usa solo como fallback de UI.

En una feature futura, Catalog / Crear-Editar Producto podra usar `FileUpload -> preview local -> ProductMediaRepository`. Durante el frontend mock no guardar imagenes grandes/base64 en LocalStorage. Con backend real el flujo sera `FileUpload -> API -> Storage/CDN -> URL -> ProductMedia`.

## Trazabilidad Adaptable

`BusinessCapabilitiesConfig` define capacidades/defaults del negocio. `Product.tracking` define el comportamiento real por producto: `stock`, `lot`, `expiration`, `serial`.

Ejemplos: taladro usa stock y serial; tornillos usan stock; medicamento usa stock, lote y vencimiento; servicio no usa inventario ni trazabilidad. No mostrar lote/vencimiento/serie cuando el producto no los utiliza. Aplica a Catalog, Receiving, Inventory y Picking.

## Product Type

`physical` puede requerir inventario y logistica. `service` no requiere inventario/picking. `kit` eventualmente resuelve componentes.

## Catalogo E Inventario

`Product` describe que es el producto. `InventoryBalance` describe cuanto existe y donde. No almacenar stock oficial dentro de Product.

Stock es por tenant, branch y location. Catalogo es global dentro del tenant. Precios son globales por tenant durante esta fase. `Product.baseUnitId` es la unidad base de inventario. `Product.saleUnitId` es la unidad/presentacion normal de venta y, si falta en datos legados, se interpreta como `baseUnitId`. `Product.salePrice` es el precio base; cualquier precio promocional se deriva y no se guarda como campo mutable en `Product`.

`Unit.category` es la clasificacion canonica de una unidad (`unit`, `weight`, `length`, `volume`, `other`). No depende de `Unit.code`, `Unit.name` ni `Unit.symbol`: cambiar el codigo o el simbolo no debe cambiar la categoria. `Unit.code` sigue siendo identificador interno, `Unit.symbol` sigue siendo representacion corta y `Unit.allowsDecimals` sigue indicando si permite cantidades fraccionarias.

`ProductInventorySettings` representa configuracion operativa por producto+sucursal. Es la fuente canonica para `minStock`, `reorderPoint` opcional y `defaultLocationId` opcional. La unicidad conceptual es `tenantId + productId + branchId`. `InventoryBalance.minStock/reorderPoint` se conserva solo como compatibilidad legacy temporal y no debe usarse como nueva fuente de verdad.

`defaultLocationId` no crea stock, no mueve stock y no crea `InventoryBalance`. Al asignarse debe apuntar a una `StorageLocation` existente, activa, del mismo tenant y de la misma sucursal. Archivar posteriormente una ubicacion no mueve stock ni borra historial; la referencia de settings se conserva como dato historico hasta que una operacion explicita la cambie.

`ProductSalesPriceTier` representa precios mayoristas de venta por producto usando `minQuantity` y `unitPrice`. No mezclar estos precios de venta con costos por volumen de proveedor.

OmniRetail reconoce tres canales comerciales: POS (`pos`), e-commerce/web (`ecommerce`) y app movil (`mobileApp`). `Product.channels` define en que canales puede publicarse un producto.

Promociones V1 soporta descuento porcentual (`percentage`), descuento fijo (`fixedDiscount`) y precio promocional fijo (`fixedPrice`). Una promocion puede aplicar a uno o varios productos, a uno o varios canales y puede tener scope por sucursal. `branchIds: []` significa todas las sucursales del tenant; valores explicitos limitan la promocion a esas sucursales. No se permiten promociones solapadas para el mismo tenant, producto, canal, scope de sucursal y rango de fechas. `untilStockEnds` conserva la intencion contractual, pero la aplicacion efectiva contra stock debe validarla el servicio consumidor usando inventario, sin duplicar stock en Promotion.

`ProductPriceHistory` registra automaticamente cambios de `Product.salePrice` con precio anterior, precio nuevo, producto, tenant, fecha y `actorUserId` opcional para integracion futura con Auth. `AuditLog` puede registrar el mismo cambio como auditoria generica. `OrderItem` y `SaleItem` deben conservar snapshot de precio y descuento al crear la transaccion para no recalcular historia con promociones actuales.

## Inventory Movements

`InventoryMovement` es append-only. No modificar historia. Todo ajuste, entrada, salida o transferencia debe generar movimiento. Evitar doble registro de stock entre POS, Receiving, Picking y Dispatch. `quantityBefore` y `quantityAfter` son opcionales para registrar auditoria de stock cuando la operacion conoce esos valores en el momento de persistir el movimiento; no deben reconstruirse para movimientos historicos desde el balance actual.

`InventoryReservation` pertenece a un `OrderItem` y conserva allocations por `InventoryBalance`, incluyendo su `balanceId` y ubicacion. La reserva puede abarcar multiples ubicaciones y es agnostica al canal de origen. Reservar o liberar solo modifica `InventoryBalance.reservedQuantity` y no crea movimientos; consumir reduce `quantity` y `reservedQuantity` en el mismo balance y genera un `InventoryMovement` de salida por allocation consumida. Reserve es idempotente por tenant y linea de pedido, mientras consume exige un `operationId` idempotente persistido. En el seed demo, cada `reservedQuantity` esta respaldado por el remanente de reservas activas del balance.

En recepcion de mercaderia, la cantidad rechazada se deriva de la suma de incidencias activas de la linea. `Recibido ahora` representa la cantidad fisicamente recibida, `Aceptado ahora = Recibido ahora - Rechazado`, y solo lo aceptado genera entrada de inventario. Las incidencias justifican por tipo, observacion y evidencia el rechazo; no existe un ingreso manual paralelo de cantidad rechazada.

`InventoryAdjustment` representa el documento auditable de un ajuste de inventario con numero operativo `AJ-YYYY-#####` unico por tenant y anio. El documento conserva `quantityBefore`, `quantityAfter` y `delta` como snapshot de auditoria; `delta` es `quantityAfter - quantityBefore`. `InventoryAdjustmentRepository` solo persiste el documento y emite `inventory-adjustment.changed`; no modifica `InventoryBalance` ni crea `InventoryMovement`. La aplicacion futura que aplique stock debe registrar el movimiento una sola vez y relacionarlo con `referenceType = "inventoryAdjustment"` y `referenceId = adjustment.id`.

`InventoryTransferRequest` representa la solicitud operativa entre sucursales antes del movimiento fisico: una sucursal solicitante pide producto a una sucursal origen/proveedora. Crear, aprobar o rechazar una solicitud no modifica `InventoryBalance` ni crea `InventoryMovement`. Sus estados fisicos legacy se conservan solo por compatibilidad; una vez creado un `InventoryTransfer`, el estado fisico canonico vive en el traslado. `InventoryRepository.transferStock()` conserva su semantica actual de transferencia inmediata entre ubicaciones y no debe usarse para solicitudes pendientes.

`InventoryTransfer` representa la ejecucion fisica canonica de un traslado entre sucursales. Tiene numero operativo legible unico por tenant y anio, sucursal origen, sucursal destino, estado fisico e items. `getByNumber` debe buscar por `tenantId + number`, ya que distintos tenants pueden compartir el mismo correlativo. `InventoryTransferItem` conserva por producto cantidades solicitadas, despachadas y recibidas como conceptos separados; no debe asumirse que son iguales. `requestedQuantity` debe ser mayor que 0, `dispatchedQuantity` debe ser no negativa y menor o igual a lo solicitado, y `receivedQuantity` debe ser no negativa y menor o igual a lo despachado. Un traslado fisico puede relacionarse con una o varias solicitudes aprobadas mediante referencias a `InventoryTransferRequest`, sin convertir la solicitud monoproducto en multiproducto. El lifecycle fisico minimo es `preparing -> inTransit -> received`, con `cancelled` para cancelacion operativa desde `preparing` o `inTransit`. El repositorio de transferencias solo persiste el traslado y sus transiciones; no modifica `InventoryBalance`, no crea `InventoryMovement` y no genera PDF. Despacho y recepcion futuros deberan orquestar transferencia, movimientos y balance desde application services.

## Supplier

`Supplier` es entidad maestra comun. Administracion mantiene el CRUD maestro y Purchasing consume el mismo Supplier. `SupplierProduct.leadTimeDays` es la fuente de verdad del plazo para una relacion proveedor-producto. `Supplier.leadTimeDays` es un rollup derivado, read-only, con el maximo de las relaciones activas; cuando no existen relaciones activas es `undefined`. `SupplierProduct` tambien contiene supplierSku, costos, unidad de compra, factor hacia unidad base, minimos y proveedor preferido por producto. La unidad de compra depende del proveedor. `SupplierCostTier` representa costos por volumen de proveedor y no se mezcla con precios mayoristas de venta. No crear proveedores independientes por modulo.

## Customer

`Customer` puede estar asociado a `User`. Perfil y autenticacion son dominios relacionados pero distintos. Andy administra perfil, direcciones, metodos guardados y seguridad; Maria consume Customer para compras.

La identidad Customer autenticada se resuelve siempre desde la sesion persistida: Session -> User activo de tipo customer -> Customer activo asociado y del mismo tenant. El checkout no acepta `customerId` ni el tenant de identidad desde la UI. Una compra en el mismo tenant del Storefront guarda `Order.customerId`; una sesion de empleado o de otro tenant no se vincula y el aislamiento de "Mis pedidos" usa el Customer resuelto desde esa misma sesion.

## Customer Payment Methods

`CustomerPaymentMethod` representa un metodo de pago guardado y reutilizable del cliente. `Payment` representa un pago historico de una compra concreta; eliminar un metodo guardado no modifica pagos historicos.

`SavedPaymentMethod` es un alias legacy/de compatibilidad de `CustomerPaymentMethod`, no una segunda definicion de dominio.

Solo simulacion frontend. Nunca guardar full card number, CVV ni PIN. Guardar solo providerPaymentMethodId, brand, last4, vencimiento, cardholderName, estado e isDefault. Backend/pasarela real vendra despues.

## Ecommerce

Guest checkout permitido por defecto. `requireAccountForCheckout` permite al tenant decidir si exige cuenta. En compra invitado, email es obligatorio conceptualmente para seguimiento/envios; telefono no necesariamente. Guest tracking usa `trackingToken`. No existe correo real todavia.

El tenant publico continua resolviendose por `PublicTenantProvider`; una sesion Customer solo complementa ese contexto. Si ambos tenants no coinciden, la Order no se atribuye al Customer autenticado. Una sesion Customer invalida o inactiva falla cerrada, mientras que la ausencia de sesion conserva el checkout invitado cuando la configuracion lo permite.

El checkout publico actual solo ofrece tarjeta simulada como metodo de aprobacion inmediata. `ecommercePaymentPolicy` es la fuente canonica de metodos inmediatos y el boundary valida el metodo del Payment persistido, no un valor del caller. Primero persiste `Order.pending` y `Payment.pending`; luego confirma atomica e idempotentemente la pareja como `Order.confirmed` y `Payment.approved` junto con sus reservas. Cada `OrderItem.id` incorpora el `idempotencyKey` normalizado del checkout: es estable al reintentar la misma Order y distinto entre Orders. Si no hay stock suficiente, la confirmacion completa se revierte y la pareja inmediata pending se elimina mediante compensacion segura para no dejar basura operacional. Efectivo, transferencia y mixto no deben aprobarse ni limpiarse automaticamente sin un lifecycle explicito.

## Order

`Order` representa pedido, preparacion y entrega. Puede provenir de ecommerce o POS. Puede ser de cliente registrado o invitado. Es compartido por Storefront, POS cuando aplica, Logistics y Customer Tracking.

`OrderStatus.pending` representa el estado previo a confirmacion. Una Order confirmada o en un estado posterior no puede regresar a `pending`. Crear una Order directamente como `confirmed` (incluido `createWithPayment`), o transicionar una Order `pending` a `confirmed`, reserva atomica e idempotentemente cada item cuyo Product sea `physical` y tenga `tracking.stock = true`. Servicios, productos sin stock y kits sin resolucion de componentes no crean reservas. Cancelar libera solamente el remanente de las reservas existentes, sin modificar stock fisico ni crear movimientos. Esta regla es identica para `ecommerce`, `mobileApp` y `pos`; el canal no decide la semantica de inventario.

La creacion de Order admite `idempotencyKey` opcional. Cuando se proporciona, la key es unica por tenant y se persiste junto con un fingerprint determinista del payload; un retry identico devuelve la misma Order y un payload diferente produce conflicto. El fingerprint incluye tenant, branch, source, identidad customer/guest, estado, entrega/transporte/direccion, snapshots de items, cantidades, importes, numero operativo y tracking token; excluye IDs y timestamps generados por el repositorio.

## Sale

`Sale` representa una venta POS. Order y Sale no son sinonimos. Una venta inmediata puede terminar sin logistica; una venta con retiro/envio puede generar Order.

Una Sale sin `sourceOrderId` conserva la salida directa de inventario. Una Sale con `sourceOrderId` solo omite esa salida cuando la Order coincide en tenant, branch, productos y cantidades, no esta cancelada y sus items fisicos con stock estan respaldados por reservas `active` o `consumed` coherentes. Picking sigue siendo quien consume esas reservas y genera los movimientos OUT; confirmar la Sale no modifica la Order ni duplica la salida.

## Delivery

`DeliveryMethod`: immediate, store_pickup, home_delivery. `TransportMode`: none, customer, own_fleet, third_party. No mezclar ambos conceptos.

## POS

Metodos: cash, card, transfer, mixed. Transferencia simula validacion manual de comprobante. No existe modulo independiente `bank_validator` ni integracion bancaria real.

Las devoluciones calculan la cantidad retornable como cantidad vendida menos cantidades de
Return completados. El caller elige lineas y cantidades, pero no el refund ni el estado final.
Devoluciones sucesivas terminan en `SaleStatus.returned` al agotar todas las lineas; no se
representan como cancelacion. Una anulacion es una operacion total separada, solo para una Sale
completada sin devoluciones previas y, en POS normal, dentro de su turno original aun abierto.

Los refunds se distribuyen sobre los Payment concretos persistidos. Solo cash genera
`CashMovement.out`; card y transfer son refunds mock sin movimiento de efectivo. Payment pasa a
`refunded` unicamente al agotarse todo su importe. Para inventario se reutiliza la huella OUT de
la Sale y se crea IN en la ubicacion historica. Servicios/no-stock no mueven inventario. Hasta que
la venta conserve huella historica suficiente por linea, lote, serial y kit se bloquean de forma
explicita. Cada operacion exitosa produce una nota de credito mock, no un documento fiscal real.

## Cash Shift

Solo puede existir un `CashShift` abierto por `tenantId + userId + branchId`; un mismo usuario
puede operar otra sucursal accesible mediante un turno independiente. Apertura, movimientos y
cierre validan tenant, relaciones, actor y estado dentro de la mutacion autoritativa.

`CashMovement` usa montos positivos y `type` (`in`/`out`) define la direccion. Los pagos POS se
descomponen en metodos concretos incluso cuando el checkout es mixto. La confirmacion de una venta
crea un unico movimiento `in` por la suma de sus pagos `cash`; card y transfer no crean movimientos
de caja. Por ello `CashMovement` es la fuente canonica del efectivo posterior a la apertura y no se
deben sumar `Sale` o `Payment` nuevamente.

El efectivo esperado se calcula en centavos como apertura + movimientos IN - movimientos OUT. El
resumen y el cierre usan la misma funcion pura; el caller del cierre solo entrega el efectivo
contado y nunca un expected cash arbitrario.

## Logistics

Flujo: Order -> Picking -> Packing -> Dispatch -> Tracking. Productos service no pasan por Picking. Trazabilidad debe respetar `Product.tracking`.

Cada incremento confirmado de `PickingItem.pickedQuantity` consume solamente el delta desde las allocations persistidas de su `InventoryReservation`, respetando su orden original. El consumo es atomico con la actualizacion del item e idempotente por `operationId`; una reserva multi-ubicacion genera un movimiento OUT por balance/ubicacion consumida. Completar el `PickingOrder` solo valida que los items fisicos y sus reservas esten completos y no vuelve a descontar inventario. Disminuir cantidades ya recogidas, reasignar ubicaciones, resolver kits y conectar lotes o seriales quedan pendientes.

## Auth

Frontend simula auth; no es seguridad real. Diferenciar `temporarily_locked` de bloqueo/deshabilitacion administrativa. Nunca mostrar o almacenar password en texto plano. No usar preguntas de seguridad tradicionales.

## Branch Scope

Empleado puede tener assigned branch, selected branches o all branches. Branch selector solo aparece cuando puede cambiar de sucursal.

## Delete / Archive

Elementos nunca usados podrian eliminarse fisicamente en el futuro. Elementos con historial deben archivarse.

## Frontend Vs Backend

Frontend actual simula emails, pagos, persistencia, auth, notificaciones e integraciones mediante Repository, MockRepository, MockDatabase, LocalStorage y EventBus.

Backend futuro: API, DB, seguridad real, correo, pasarelas, SAT/FEL, transportistas y bancos.

## Prevencion De Drift Documental

- Si cambia una decision funcional, actualizar este documento.
- Si cambia estructura tecnica, actualizar `docs/ARCHITECTURE.md`.
- Si cambia un patron conceptual de Entity/Repository, actualizar codigo primero y `docs/CONTRACTS.md` si aplica.
- Si cambia flujo Git, actualizar `docs/GIT_WORKFLOW.md`.
- Si cambia ownership, actualizar `docs/MODULE_OWNERSHIP.md`.
- `AGENTS.md` y `CLAUDE.md` deben seguir siendo entry points, no historial acumulado.
