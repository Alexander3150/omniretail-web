# catalog

Responsable: Melbyn

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

## Contracts que consume

ProductRepository, CategoryRepository, UnitRepository, AttributeRepository, PromotionRepository

## Reglas

- No duplicar entities de `core/`.
- No acceder directamente a LocalStorage.
- Usar repositories desde `RepositoryProvider`.
- Derivar el tenant desde la sesion operativa y usar exclusivamente las operaciones tenant-scoped
  de Product, Category y Unit en rutas privadas.
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.

## Gestion de productos

Implementado en esta rama:

- Listado, busqueda, filtros, paginacion y detalle de productos.
- Creacion, edicion y archivo mediante `ProductRepository`.
- Listado, detalle, validacion de referencias y mutaciones fallan cerrados ante IDs de otro tenant.
- Hasta seis imagenes mediante `ProductMediaRepository`; acepta URLs legacy y uploads procesados en `CatalogImageAssetRepository`/IndexedDB, con principal, orden, alt, reemplazo, borrado y fallback visual.
- Opciones de categoria, unidad y capacidades de negocio desde repositories.
- Tracking adaptable por `BusinessCapabilitiesConfig`; productos `service` fuerzan tracking inactivo.
- Capacidades del negocio aplicadas de verdad, no solo mostradas: sin `supportsServices` o
  `supportsKits` no se puede crear ni convertir un producto a esos tipos; sin
  `supportsUnitsAndPackaging` la unidad de venta es siempre la de inventario y no se persisten
  equivalencias; sin `supportsProductAttributes` los atributos se ocultan y se descartan.
  `applyCapabilityRulesToEditor` es el unico lugar donde se proyectan esas reglas sobre el borrador,
  y los services la aplican antes de validar y persistir para que la regla valga aunque el borrador
  llegue desde otro consumidor.
- Rutas privadas `/catalogo/productos`, `/catalogo/productos/nuevo`, `/catalogo/productos/[id]` y `/catalogo/productos/[id]/editar`.

## Catalogo demo

Las bases mock nuevas reciben el catalogo coherente de **Ferreteria Los Simpson**: 10 categorias
principales y 30 productos fisicos, con atributos, precios por cantidad, proveedor, configuracion
de inventario, balance por ubicacion y una imagen principal estatica por producto. No crea kits ni
servicios, aunque esos contratos de dominio siguen disponibles. El cambio del seed no migra ni
reinicia automaticamente una base ya persistida en el navegador.

## Gestion de categorias

Implementado en esta rama:

- Listado, busqueda, filtro por estado, paginacion y panel contextual de categorias.
- Creacion, edicion, archivo y restauracion mediante `CategoryRepository`, incluida una imagen opcional que reutiliza el pipeline multimedia sin alterar slug ni jerarquia.
- Conteo real de productos asociados desde `ProductRepository`.
- Ruta privada `/catalogo/categorias`.

## Gestion de ubicaciones

Implementado en esta rama:

- Listado, busqueda, filtro por estado, paginacion y panel contextual de ubicaciones.
- Creacion, edicion, archivo y reactivacion mediante `InventoryRepository`.
- Conteo real de productos asociados desde `InventoryBalance.locationId`.
- Ruta privada `/catalogo/ubicaciones`.

## Gestion de unidades

Implementado en esta rama:

- Listado, busqueda, filtro por categoria canonica, filtro por estado, paginacion y panel contextual de unidades.
- Creacion, edicion, archivo y reactivacion mediante `UnitRepository`.
- Ruta privada `/catalogo/unidades`.
- `Unit.category` es la clasificacion canonica de la unidad; `code`, `symbol` y `name` no determinan la categoria.
- Esta feature no administra conversiones ni empaques.

## Estructura futura

```text
catalog/
|-- pages/
|-- components/
|-- application/
|   |-- dto/
|   |-- mappers/
|   `-- services/
|-- hooks/
|-- validation/
|-- navigation.ts
|-- permissions.ts
`-- index.ts
```
