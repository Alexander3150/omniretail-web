# customer

Responsable: Andy

## Alcance

Este modulo contendra funcionalidades orientadas a clientes, perfiles, historial visual y datos de cliente cuando los contratos sean definidos.

## No colocar aqui

- Contratos compartidos de clientes.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Funcionalidades de catalogo, inventario o POS.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
customer/
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
