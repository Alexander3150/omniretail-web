# logistics

Responsable: Riquelme

## Alcance

Este modulo contendra preparacion, despacho, picking y seguimiento operativo cuando los contratos sean definidos.

## No colocar aqui

- Contratos compartidos de pedidos, envios o inventario.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica de POS, compras o recepcion que pertenezca a sus modulos.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
logistics/
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
