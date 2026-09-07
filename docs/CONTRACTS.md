# Contratos

ENTITY: modelo compartido del dominio. Vive en `src/core/entities`.

DTO: forma de datos de una operacion especifica. Vive dentro del modulo que implementa esa operacion.

MAPPER: convierte DTO a Entity o API DTO a Entity. Tambien pertenece al modulo.

REPOSITORY: contrato de acceso a datos definido en `src/core/repositories`.

MOCK REPOSITORY: implementacion temporal frontend que usa `MockDatabaseStore`.

`ProductMediaRepository` es el contrato compartido para consultar y administrar referencias de imagenes de producto sin acoplar modulos a seeds, LocalStorage o assets fisicos.

No crear `StorefrontProduct`, `InventoryProduct` o `PosProduct`. Debe existir un unico `Product` compartido en `core/`.
