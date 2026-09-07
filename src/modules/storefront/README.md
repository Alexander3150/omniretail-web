# storefront

Responsable: Maria

## Alcance

Este modulo contendra la experiencia publica/comercial de la tienda web, vitrinas, listados visuales y flujos de compra cuando sean definidos.

## No colocar aqui

- Contratos compartidos de productos, carrito u ordenes.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica interna de inventario, compras, recepcion o POS.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
storefront/
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
