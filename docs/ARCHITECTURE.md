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

## Navegacion Privada

Los modulos declaran sus entradas en `src/modules/*/navigation.ts`.
`src/config/navigation.ts` agrega esas listas junto con la navegacion base y
el layout privado entrega `navigationConfig` al `Sidebar`.

```text
modules/*/navigation.ts
-> config/navigation.ts
-> PrivateLayout
-> Sidebar
```

`Sidebar` renderiza `NavigationItem[]` sin importar modulos concretos. La
metadata de permisos se conserva en los items; cuando Auth este integrado, la
sesion podra filtrar la navegacion antes de renderizar el Sidebar.
