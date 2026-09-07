# pos

Responsable: Riquelme

## Alcance

Este modulo contendra la terminal de punto de venta, flujos visuales de venta y operaciones de caja cuando sean definidos.

## No colocar aqui

- Contratos compartidos de ventas, pagos, productos o clientes.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Pasarelas de pago reales o integraciones externas.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
pos/
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
