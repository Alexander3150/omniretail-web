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

## Integracion API de maestros

En modo `api`, categorias, ubicaciones, unidades y conversiones consumen los endpoints reales de
`/catalog` mediante `backendFetch`. Las listas paginadas se agregan dentro de los adapters para
mantener los contratos existentes. Categorias y ubicaciones conservan `parentId`; sus listados se
ordenan en preorden para reflejar la jerarquia. Inventory sigue en mock salvo las tres operaciones
del maestro de ubicaciones. La pantalla de unidades no agrega CRUD de conversiones: usa su listado
real para el read model existente y conserva las operaciones administrativas/globales en API.
Las lecturas y reemplazos de conversiones por producto siguen delegadas al repository original;
los flujos Product API del Bloque 1 no las invocan. Esta compatibilidad debe retirarse al integrar
conversiones en el Bloque 2.

## Integracion API de Products - Bloque 1

En modo `api`, Product core usa `ApiProductRepository` sin fallback a mocks. El listado
administrativo consume paginacion backend 1-based y enriquece unicamente la pagina actual con
categorias y unidades reales. Los consumidores legacy pueden agregar paginas del API de forma
temporal; el listado administrativo no usa ese camino.

Promociones, inventario, medios, atributos, conversiones, proveedores, tiers y componentes de kit
no se cruzan con UUID de Product del backend. El editor integral bloquea esa orquestacion hasta los
Bloques 2/3. Mientras el backend no exponga filtros de Product, la UI API conserva su estado pero
deshabilita busqueda y filtros para no presentar resultados parciales como globales.

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
