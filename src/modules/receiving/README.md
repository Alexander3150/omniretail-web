# receiving

Responsable: Melbyn

## Alcance

Este modulo contendra recepcion de mercaderia, verificacion visual y entradas derivadas de compras cuando sean definidas.

## No colocar aqui

- Contratos compartidos de recepciones, compras o inventario.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica completa de compras, inventario o logistica fuera de su responsabilidad.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
receiving/
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
