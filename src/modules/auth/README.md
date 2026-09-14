# auth

Responsable: Andy

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

## Contracts que consume

AuthRepository, UserRepository, TenantRepository, RoleRepository, BranchRepository

## Reglas

- No duplicar entities de `core/`.
- No acceder directamente a LocalStorage.
- Usar repositories desde `RepositoryProvider`.
- Para Employee exigir Tenant activo y Role `active` del mismo tenant antes de publicar o crear
  una sesion operativa; login, MFA y revalidacion de sesion fallan cerrados.
- `CurrentSessionProvider` escucha `role.changed` para retirar permisos cuando un Role se vuelve
  `inactive` o `archived`; el scope de Branch se aplica despues de reducir por tenant.
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.

## Estructura futura

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
