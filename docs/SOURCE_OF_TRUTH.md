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

`InventoryMovement` es append-only. No modificar historia. Todo ajuste, entrada, salida o transferencia debe generar movimiento. Evitar doble registro de stock entre POS, Receiving, Picking y Dispatch.

`InventoryTransferRequest` representa la solicitud operativa entre sucursales antes del movimiento fisico: una sucursal solicitante pide producto a una sucursal origen/proveedora. Crear, aprobar o rechazar una solicitud no modifica `InventoryBalance` ni crea `InventoryMovement`. `InventoryRepository.transferStock()` conserva su semantica actual de transferencia inmediata entre ubicaciones y no debe usarse para solicitudes pendientes. El lifecycle canonico de solicitud es `requested -> approved/rejected/cancelled -> inTransit -> received`; despacho/recepcion futura debera coordinar explicitamente balance y movimiento cuando exista la regla operativa final.

## Supplier

`Supplier` es entidad maestra comun. Administracion mantiene el CRUD maestro y Purchasing consume el mismo Supplier. `SupplierProduct` contiene supplierSku, costos, unidad de compra, factor hacia unidad base, lead time, minimos y proveedor preferido por producto. La unidad de compra depende del proveedor. `SupplierCostTier` representa costos por volumen de proveedor y no se mezcla con precios mayoristas de venta. No crear proveedores independientes por modulo.

## Customer

`Customer` puede estar asociado a `User`. Perfil y autenticacion son dominios relacionados pero distintos. Andy administra perfil, direcciones, metodos guardados y seguridad; Maria consume Customer para compras.

## Customer Payment Methods

`CustomerPaymentMethod` representa un metodo de pago guardado y reutilizable del cliente. `Payment` representa un pago historico de una compra concreta; eliminar un metodo guardado no modifica pagos historicos.

`SavedPaymentMethod` es un alias legacy/de compatibilidad de `CustomerPaymentMethod`, no una segunda definicion de dominio.

Solo simulacion frontend. Nunca guardar full card number, CVV ni PIN. Guardar solo providerPaymentMethodId, brand, last4, vencimiento, cardholderName, estado e isDefault. Backend/pasarela real vendra despues.

## Ecommerce

Guest checkout permitido por defecto. `requireAccountForCheckout` permite al tenant decidir si exige cuenta. En compra invitado, email es obligatorio conceptualmente para seguimiento/envios; telefono no necesariamente. Guest tracking usa `trackingToken`. No existe correo real todavia.

## Order

`Order` representa pedido, preparacion y entrega. Puede provenir de ecommerce o POS. Puede ser de cliente registrado o invitado. Es compartido por Storefront, POS cuando aplica, Logistics y Customer Tracking.

## Sale

`Sale` representa una venta POS. Order y Sale no son sinonimos. Una venta inmediata puede terminar sin logistica; una venta con retiro/envio puede generar Order.

## Delivery

`DeliveryMethod`: immediate, store_pickup, home_delivery. `TransportMode`: none, customer, own_fleet, third_party. No mezclar ambos conceptos.

## POS

Metodos: cash, card, transfer, mixed. Transferencia simula validacion manual de comprobante. No existe modulo independiente `bank_validator` ni integracion bancaria real.

## Logistics

Flujo: Order -> Picking -> Packing -> Dispatch -> Tracking. Productos service no pasan por Picking. Trazabilidad debe respetar `Product.tracking`.

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
