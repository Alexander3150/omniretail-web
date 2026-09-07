# inventory

Responsable: Melbyn

## Alcance

Este modulo contendra consultas y gestion visual de existencias, movimientos y niveles de stock cuando sean definidos.

## No colocar aqui

- Contratos compartidos de producto, stock o movimiento.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica de compras, recepcion, POS o logistica que pertenezca a sus modulos.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
inventory/
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
