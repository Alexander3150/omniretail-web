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
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.

## Gestion de productos

Implementado en esta rama:

- Listado, busqueda, filtros, paginacion y detalle de productos.
- Creacion, edicion y archivo mediante `ProductRepository`.
- Imagen principal mediante `ProductMediaRepository`, con fallback visual.
- Opciones de categoria, unidad y capacidades de negocio desde repositories.
- Tracking adaptable por `BusinessCapabilitiesConfig`; productos `service` fuerzan tracking inactivo.
- Rutas privadas `/catalogo/productos`, `/catalogo/productos/nuevo`, `/catalogo/productos/[id]` y `/catalogo/productos/[id]/editar`.

## Gestion de categorias

Implementado en esta rama:

- Listado, busqueda, filtro por estado, paginacion y panel contextual de categorias.
- Creacion, edicion, archivo y restauracion mediante `CategoryRepository`.
- Conteo real de productos asociados desde `ProductRepository`.
- Ruta privada `/catalogo/categorias`.

## Gestion de ubicaciones

Implementado en esta rama:

- Listado, busqueda, filtro por estado, paginacion y panel contextual de ubicaciones.
- Creacion, edicion, archivo y reactivacion mediante `InventoryRepository`.
- Conteo real de productos asociados desde `InventoryBalance.locationId`.
- Ruta privada `/catalogo/ubicaciones`.

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
