# Contratos

ENTITY: modelo compartido del dominio. Vive en `src/core/entities`.

DTO: forma de datos de una operacion especifica. Vive dentro del modulo que implementa esa operacion.

MAPPER: convierte DTO a Entity o API DTO a Entity. Tambien pertenece al modulo.

REPOSITORY: contrato de acceso a datos definido en `src/core/repositories`.

MOCK REPOSITORY: implementacion temporal frontend que usa `MockDatabaseStore`.

`ProductMediaRepository` es el contrato compartido para consultar y administrar referencias de imagenes de producto sin acoplar modulos a seeds, LocalStorage o assets fisicos.

`PromotionRepository` es el contrato compartido para crear, editar y consultar promociones aplicables. La aplicabilidad debe considerar tenant, producto, fecha, canal y scope de sucursal; no basta con `status=active`.

`ProductPriceHistoryRepository` es el contrato compartido para leer y registrar cambios de precio base de producto. El mock debe escribir historial cuando cambia `Product.salePrice` desde el flujo comun de `ProductRepository.update`.

La logica de precio efectivo vive en `core/pricing` como funcion pura reutilizable por Catalog, Storefront, POS y app movil. No pertenece a Shared UI.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.
