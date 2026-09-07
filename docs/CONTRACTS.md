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

`UnitRepository` administra `Unit` y expone operaciones de consulta/reemplazo de `UnitConversion` por producto. `UnitConversion` no debe duplicarse en entidades de producto o proveedor.

`AttributeRepository.replaceValuesForProduct` permite persistir el conjunto completo de atributos key/value de un producto sin crear entidades paralelas de atributos.

`ProductSalesPriceTierRepository` administra precios mayoristas de venta por producto. Sus tiers usan `minQuantity` y `unitPrice`, son distintos de promociones y no representan costos de proveedor.

`SupplierProductRepository` administra la relacion producto-proveedor, incluyendo unidad de compra por proveedor, factor hacia unidad base, costo, minimo, lead time, preferred y `SupplierCostTier`.

La logica de precio efectivo vive en `core/pricing` como funcion pura reutilizable por Catalog, Storefront, POS y app movil. No pertenece a Shared UI.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.
