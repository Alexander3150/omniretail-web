# catalog

Responsable: Melbyn

## Alcance

Este modulo contendra gestion visual de catalogo, productos, categorias y atributos cuando los contratos oficiales sean definidos.

## No colocar aqui

- Contratos compartidos de productos o categorias.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica propia de inventario fisico, compras, recepcion o POS.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

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
