# administration

Responsable: Jose

## Alcance

Este modulo contendra administracion general del sistema, configuraciones, usuarios visuales y mantenimiento administrativo cuando sean definidos.

## No colocar aqui

- Contratos compartidos de usuarios, roles o permisos.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica especifica de inventario, compras, recepcion, POS o logistica.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
administration/
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
