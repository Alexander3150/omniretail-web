# purchasing

Responsable: Melbyn

## Alcance

Este modulo contendra solicitudes, ordenes de compra y flujo visual de abastecimiento cuando los contratos sean definidos.

## No colocar aqui

- Contratos compartidos de proveedores, productos u ordenes.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica de recepcion fisica, POS o logistica.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
purchasing/
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
