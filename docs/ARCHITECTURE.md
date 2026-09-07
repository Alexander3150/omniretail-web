# Arquitectura OmniRetail

`app/` contiene rutas y layouts de Next.js. `core/` define entities, enums, types y repository contracts sin React. `infrastructure/` implementa persistencia mock, LocalStorage encapsulado, repositories mock y eventos. `modules/` contiene las features por integrante. `shared/` contiene UI, hooks y utilidades comunes. `config/` centraliza navegacion, permisos, estados y politicas.

Flujo actual:

```text
UI
-> module service / mapper
-> Repository contract
-> MockRepository
-> MockDatabase
```

Flujo futuro:

```text
UI
-> Repository contract
-> ApiRepository
-> Backend
```
