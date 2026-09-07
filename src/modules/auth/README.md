# auth

Responsable: Andy

## Alcance

Este modulo contendra funcionalidades relacionadas con acceso, sesiones simuladas, pantallas de entrada y flujos visuales de autenticacion cuando sean definidos.

## No colocar aqui

- Contratos compartidos de usuarios o sesiones.
- Acceso directo a LocalStorage desde paginas o componentes.
- Componentes visuales globales.
- Logica de otros modulos.

Los contratos compartidos de `core/` no deben duplicarse. LocalStorage no debe ser utilizado directamente por las pantallas; posteriormente se accedera mediante Repository / Infrastructure. `shared/` contiene componentes globales.

## Plantilla futura

```text
auth/
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
