# Plan RBAC y Administración de Usuarios/Empleados

**Proyecto:** OmniRetail · **Responsable principal:** José

> Este documento reemplaza el plan original de RBAC. La sección 1 fue verificada contra el
> código real antes de aceptarlo -- varias piezas que el plan original asumía por crear ya
> existían, y se encontró un gap de seguridad real que el plan original no contemplaba. Ver
> `docs/SOURCE_OF_TRUTH.md`: donde este documento y el código difieran, manda el código.

---

## 0. Objetivo

Reducir el plan anterior a 5 PR nuevos, sin mezclar Customers con Users/Employees ni introducir
parches provisionales de permisos.

**Corrección clave:** el PR real **#45** es `feature/admin-customers`, alcance administración
comercial de Customers. NO se convierte en Admin Users/Employees, NO integra `inviteEmployee()`,
NO toca Auth, NO agrega parches provisionales de permisos. Si necesita autorización canónica,
espera la Fundación RBAC (PR1), se rebasea y adapta únicamente permisos/enforcement.

**Secuencia:**

| # | Rama | Objetivo |
|---|---|---|
| 1 | `feature/rbac-foundation` | Fundación de autorización (este PR) |
| 2 | `feature/admin-roles-employees` | UI Roles + Employees/Users, integra `inviteEmployee()` |
| 3 | `feature/rbac-backoffice-enforcement` | Enforcement real: Administration, Catalog, Inventory, Purchasing, Receiving |
| 4 | `feature/rbac-sales-operations-enforcement` | Enforcement real: POS, Picking, Dispatch |
| 5 | `feature/rbac-final-integration` | Sidebar, limpieza, QA matrix, casos adversariales, documentación |

PR #45 (Customers) queda independiente, se adapta después de PR1 solo si necesita autorización
canónica.

---

## 1. Estado real verificado antes de escribir código (2026-09-11)

El plan original describía PR1 como "crear la infraestructura única de autorización" asumiendo
que no existía nada. **Eso era falso.** El módulo `auth` (Andy) ya tiene construida buena parte
de la fundación:

| Pieza | Dónde vive | Estado real |
|---|---|---|
| `permissionsConfig` canónico (agrega 10 módulos) | `src/config/permissions.ts` | ✅ Ya existía |
| `useCurrentSession().hasPermission(permission)` | `src/modules/auth/providers/CurrentSessionProvider.tsx` | ✅ Ya existía |
| `useCurrentSession().canAccessBranch(branchId)` | idem, delega en `canUserAccessBranch` | ✅ Ya existía |
| `canUserAccessBranch(user, role, branchId)` (assigned/selected/all + cross-tenant deny) | `src/core/scopes/userBranchAccess.ts` | ✅ Ya existía |
| `RequirePermission` (guard de rutas, fail-closed, misma fuente que Sidebar) | `src/modules/auth/components/RequirePermission.tsx` | ✅ Ya existía |
| `AuthorizedPrivateShell` (Sidebar conectado a permisos reales) | `src/modules/auth/components/AuthorizedPrivateShell.tsx` | ✅ Ya existía |
| `filterNavigationItemsByPermissions` (set membership plano) | `src/shared/navigation/Sidebar/index.tsx` | ✅ Ya existía, sin manage→read |
| `inviteEmployee()` / `activateEmployeeAccount()` / `EmployeeInvitation` | `src/core/repositories/AuthRepository.ts`, `src/core/entities/EmployeeInvitation.ts` | ✅ Ya implementado por Auth. Docstring propio: *"todavía no existe el service administrativo (/administracion/usuarios) que la proveería"* |
| `RoleRepository` con solo `getById` | `src/core/repositories/RoleRepository.ts` | ⛔ Confirmado bloqueante (coincidía con SCOPE.md) |
| Resolución canónica manage→read | — | ⛔ No existía en ningún lado (ni Sidebar ni services) |
| `Role.status` / activar-desactivar | `src/core/entities/Role.ts` | ⛔ El modelo ni siquiera tiene el campo |

### Gap de seguridad real encontrado (no estaba en el plan original)

`CurrentSessionProvider.tsx` resuelve el rol así:

```ts
const resolvedRole = resolvedUser?.roleId
  ? await repositories.roles.getById(resolvedUser.roleId)
  : null;
```

`RoleRepository.getById` no filtra por tenant, y **en ningún punto se compara
`resolvedRole.tenantId` contra `resolvedUser.tenantId`** antes de usar `role.permissions` para
construir `hasPermission()`. Si un `roleId` corrupto o mal asignado apunta a un rol de otro
tenant, la sesión heredaría esos permisos sin ningún chequeo -- la misma clase de bug de
aislamiento que ya se corrigió en auditoría (`AuditLogRepository.getByTenant`), pero acá en el
punto que gatea todo el backoffice. `canUserAccessBranch` sí valida tenant; `hasPermission` no.

Además, como `Role` no tiene `status`, "Role inactivo => DENY" (criterio del plan original) es
hoy imposible de implementar: falta el campo antes que ningún código de enforcement.

**Decisión:** `CurrentSessionProvider.tsx` y el campo `Role.status` son territorio compartido
Auth+Administration (`docs/MODULE_OWNERSHIP.md`: *"User/Auth: Andy + Jose"*). No se tocan en esta
sesión sin coordinar con Andy primero. Quedan documentados acá como bloqueante prioritario para
el arranque de PR1 continuado.

**Pendiente de Andy / próxima coordinación:**
1. Agregar `Role.status: "active" | "inactive"` (o similar) a `src/core/entities/Role.ts`.
2. En `CurrentSessionProvider.tsx`, antes de exponer `permissions`/`hasPermission`, validar
   `resolvedRole.tenantId === resolvedUser.tenantId` y `resolvedRole.status === "active"` --
   fail-closed (rol inválido = permissions vacías, no error silencioso).
3. Una vez agregado el campo, `RoleRepository` puede sumar `archive`/`updateStatus` (mismo patrón
   que `SupplierRepository`).

---

## 2. Principios no negociables

- Customer y Employee son sujetos distintos. Customer no depende del Role operacional.
- Employee sí usa Role + permissions + branchScope.
- La UI NO es seguridad. Ocultar Sidebar, tabs o botones es solo UX.
- El enforcement real debe estar en Application Services / boundaries.
- `tenantId`, `branchId`, `roleId`, `customerId` e IDs enviados por UI son no confiables.
- `permissionsConfig` es la única fuente del catálogo de permisos. No duplicar listas de
  permisos en seeds, componentes o formularios.
- Los roles son configurables por negocio. Los seis perfiles sugeridos son perfiles de QA, no
  roles hardcodeados.
- `role-super-admin-qa` es solo local/dev y deriva dinámicamente de `permissionsConfig`.
- Auth sigue siendo responsabilidad del módulo de Andy. Administración autoriza y orquesta
  Employees; Auth administra credenciales, invitaciones, tokens y password.

---

## 3. Modelo objetivo

**EMPLOYEE:** Session → User activo (`UserType.employee`) → tenant → Role activo y del mismo
tenant → `Role.permissions` → permiso requerido → target branch → `branchScope` →
`canUserAccessBranch(...)` → Application Service → Repository scoped → operación.

`branchScope`: `assigned` | `selected` | `all`. `User.branchId` = sucursal base,
`User.allowedBranchIds` = sucursales autorizadas para `selected`.

**CUSTOMER:** Session → User Customer → `CustomerRepository.getByUserId(...)` → customerId real
→ tenant real → Application Service Customer → Repository scoped por tenant + customer. Customer
NO reutiliza el Role operacional de Employee.

---

## 4. Permission catalog

`permissionsConfig` (`src/config/permissions.ts`) es la única fuente canónica -- agrega los
arrays `*Permissions` de cada módulo, sin listas duplicadas.

Permisos aprobados para agregar **cuando realmente se implementen**: `catalog.locations.read`,
`catalog.products.archive`, `inventory.transfer_requests.create`,
`inventory.transfer_requests.review`. No agregar solo por granularidad
(`admin.suppliers.read`, `purchasing.orders.cancel`, permisos Customer redundantes).

La relación manage→read se resuelve canónicamente en `src/core/permissions/resolvePermission.ts`
(`hasPermission`), nunca con ifs dispersos por página/Sidebar/Customers.

---

## 5. PR1 — Fundación RBAC canónica (`feature/rbac-foundation`)

### Entregado en esta sesión (no toca `auth/`)

- `src/core/repositories/RoleRepository.ts` + `MockRoleRepository.ts`: `getByTenant(tenantId)`,
  `create`, `update` (sin `archive` -- ver gap de `Role.status` arriba).
- `src/core/types/events.types.ts`: nuevo evento `"role.changed"`.
- `src/core/permissions/resolvePermission.ts`: `hasPermission(granted, required)` (resolución
  canónica manage→read, fail-closed) y `requireEmployeePermission(granted, required)` (throw).
- `src/core/scopes/userBranchAccess.ts`: `requireBranchAccess(user, role, branchId)` (variante
  throw de `canUserAccessBranch`, ya existente).
- `src/config/permissions.ts`: `getAllPermissionKeys()` -- deriva la lista completa de
  `permissionsConfig`, sin lista manual.
- Seed demo: `role-super-admin-qa` (solo dev/local), permisos derivados de
  `getAllPermissionKeys()`. No asignado a ningún User -- se reasigna a mano (`user.roleId`)
  cuando se necesita QA con acceso total.
- `scripts/verify-rbac-foundation.ts`: harness de verificación manual (sin framework de tests en
  el repo, mismo patrón que `scripts/verify-ecommerce-payment-reservation.ts`). Cubre:
  manage→read, fail-closed, `canUserAccessBranch` (assigned/selected/all + cross-tenant),
  `RoleRepository` CRUD tenant-scoped, `role-super-admin-qa` == `getAllPermissionKeys()`.

### Explícitamente diferido (no forma parte de esta sesión)

- Cualquier cambio a `auth/` (`CurrentSessionProvider`, `RequirePermission`,
  `AuthorizedPrivateShell`) -- pendiente de coordinar con Andy (sección 1).
- `Role.status` / `RoleRepository.archive` -- depende de lo anterior.
- Metadata de agrupación (`group`/`label`) en `PermissionDefinition` -- se agrega en PR2 cuando
  el `RoleEditor` la necesite de verdad (no antes, para no construir infraestructura sin
  consumidor).
- Adopción de `hasPermission`/`requireEmployeePermission`/`requireBranchAccess` dentro de los
  services existentes (`ensureCanReadCustomers` y similares en `serviceHelpers.ts`) -- eso es
  PR3 (enforcement backoffice), no fundación.
- Pantalla de Roles, pantalla de Employees, `inviteEmployee` end-to-end, enforcement masivo.

### Criterios de aceptación (los que ya aplican hoy)

- `RoleRepository.getByTenant` nunca devuelve roles de otro tenant.
- `hasPermission`: permiso inexistente ⇒ DENY; `manage` resuelve su propio `read`; `manage`/`read`
  de recursos distintos nunca se cruzan.
- `role-super-admin-qa` == `getAllPermissionKeys()` siempre (lo verifica el script).
- `tsc --noEmit` / `lint` / `scripts/verify-rbac-foundation.ts` en verde.

---

## 6. PR2 — Administración de Roles + Employees/Users (`feature/admin-roles-employees`)

**Admin Roles:** listar/crear/editar (activar-desactivar solo si `Role.status` ya existe para
entonces). `RoleEditor` reutilizable: `name`, `description`, `branchScope`, `permissions`
(agrupados por módulo desde `permissionsConfig`, con metadata `group`/`label` agregada acá).
Reglas: Role pertenece al tenant actual, permisos desconocidos rechazados, `branchScope` válido,
nunca confiar en `tenantId` de UI. Perfiles manuales de QA (Propietario/Administrador, Gerente,
Inventario/Compras, Bodeguero, Cajero, Auditor) -- no hardcodeados como únicos válidos.

**Admin Employees/Users:** feature nueva, NO reutiliza PR #45 (Customers). Formulario: nombre,
email, role, sucursal base, sucursales permitidas si `branchScope = selected`, estado. Sin pedir
contraseña. Flujo: Admin autorizado → crea User tipo Employee (tenant, roleId, branchId,
allowedBranchIds) → llama `AuthRepository.inviteEmployee(userId)` (contrato **ya existe**, ver
sección 1) → `/activar-cuenta/[token]` (**ya existe**) → Employee define password → cuenta
activa. Auth sigue dueño de `AuthAccount`/`EmployeeInvitation`/token/password; Administration
dueño de `admin.users.manage`, datos organizacionales, role, branches, actor administrativo real.
Crear Role dentro del formulario Employee reutiliza `RoleEditor` (modal/drawer), no duplica
formulario. No toca Customers comerciales, credenciales ni password temporal manual.

---

## 7. PR3 — Enforcement Backoffice (`feature/rbac-backoffice-enforcement`)

Módulos: Administration, Catalog, Inventory, Purchasing, Receiving. Patrón: Session →
EmployeeAuthorizationContext → permission → branchScope → Application Service → scoped
Repository. Nunca depender de botón oculto, Sidebar, `role.name`, `tenantId` de formulario o
`branchId` de UI sin validar. Esta es la primera vez que `hasPermission`/
`requireEmployeePermission`/`requireBranchAccess` (PR1) se adoptan dentro de services reales,
reemplazando los ifs dispersos como `ensureCanReadCustomers`/`ensureCanReadBranches`.

Catalog: `read`/`manage` existentes, `catalog.locations.read` y `catalog.products.archive`
cuando existan las funciones reales. Inventory: lectura, ajustes, ubicaciones,
`inventory.transfer_requests.create`/`review`. Purchasing: órdenes y proveedores según contratos
existentes -- no inventar `purchasing.orders.cancel` sin necesidad real. Receiving: recepciones,
incidencias, branch access.

Criterios: URL directa no bypass, llamada directa a service no bypass, tenant cruzado DENY,
branch fuera de scope DENY, role sin permiso DENY, UI filtrada, services siguen siendo autoridad.

---

## 8. PR4 — Enforcement POS / Logística / Operación (`feature/rbac-sales-operations-enforcement`)

Módulos: POS, Picking, Dispatch/Logistics, migración del contexto POS, partes privadas Employee
del Storefront si existen. POS: venta, devoluciones, caja, branch, acciones sensibles. Picking:
cola por branch/tenant, iniciar/completar, no cross-branch. Dispatch: confirmar despacho,
transportista, branch, evitar doble transición si el dominio ya lo protege. Customer sigue
separado -- no convertir permisos Employee en autorización Customer. Storefront público usa
`PublicTenantProvider`, nunca `ActiveBranch` como tenant público. Storefront Customer privado:
ownership Customer separado, no depende del Role Employee.

---

## 9. PR5 — Integración final, Sidebar, QA y limpieza (`feature/rbac-final-integration`)

**Sidebar/navigation:** usar `permissionsConfig`, filtrar por permiso, respetar `branchScope`
cuando afecte UX, no duplicar reglas. **Limpieza:** eliminar checks por `role.name`, listas
manuales, bypass temporales, TODOs RBAC ya resueltos, arrays duplicados, superadmin hardcodeado
de producción, tenant/branch asumidos desde UI, helpers antiguos. **QA Matrix:** crear
manualmente desde UI los seis perfiles (Propietario/Administrador, Gerente, Inventario/Compras,
Bodeguero, Cajero, Auditor). **Casos adversariales:** Employee tenant A → recurso tenant B DENY;
Employee branch A → branch B sin scope DENY; Role inactivo DENY; User inactivo DENY; permiso
faltante DENY; URL directa DENY; service directo DENY; Customer → rutas Employee DENY; Employee →
rutas Customer privadas DENY salvo política explícita; Visitor → rutas privadas DENY. **Gates:**
tsc, lint, build, diff-check, tests específicos si existen. **Documentación:** actualizar
`permissionsConfig` como source of truth, flujo Employee, flujo Customer, `branchScope`, reglas
QA, permisos nuevos implementados.

---

## 10. Tratamiento del PR #45 actual — Admin Customers

`feature/admin-customers` permanece separado. NO mezclar Roles, Employees, Auth,
`inviteEmployee`, credenciales, passwords ni Employee branches.

1. No añadir parches RBAC provisionales.
2. Esperar PR1 (completo, incluida la parte de Andy) si necesita `manage→read` o autorización
   central.
3. Rebasear sobre `development` después de PR1.
4. Adaptar únicamente autorización al contrato canónico (`hasPermission`/
   `requireEmployeePermission` cuando PR3 los adopte -- Customers no se adelanta a eso).
5. Mantener Customers como administración comercial. Reauditar. Merge independiente.

Customer = entidad comercial/cliente. User/AuthAccount = identidad/credenciales. No fusionarlos
conceptualmente.

---

## 11. Orden final

1. `feature/rbac-foundation` (este documento, parte "entregado" ya en código; parte Auth
   pendiente de coordinación).
2. Rebase/adaptar `feature/admin-customers` si depende de RBAC.
3. `feature/admin-roles-employees`.
4. `feature/rbac-backoffice-enforcement`.
5. `feature/rbac-sales-operations-enforcement`.
6. `feature/rbac-final-integration`.

Si PR3 o PR4 se vuelven demasiado grandes o generan conflictos entre compañeros, se pueden
dividir en dos. No reducir más si eso vuelve los PR imposibles de revisar.

---

## 12. Definition of Done global

RBAC termina cuando: `permissionsConfig` es fuente única; no hay permission lists duplicadas;
manage/read se resuelve canónicamente; Employee usa User + Role + permissions + branchScope;
Role/tenant/branch se validan en boundary (incluida la validación tenant+status de Role dentro de
`CurrentSessionProvider`, hoy pendiente); Customer permanece separado; UI no es la única defensa;
Admin Roles funciona; Admin Employees crea/invita sin password administrativa; `inviteEmployee`
pertenece a Auth y se integra por contrato; Backoffice y POS/Logistics tienen enforcement real;
Sidebar refleja permisos pero no reemplaza autorización; no hay bypass temporales; los seis
perfiles QA se pueden configurar desde UI; `role-super-admin-qa` es solo dev/local y deriva de
`permissionsConfig`; tsc/lint/build pasan; pruebas adversariales tenant/branch/permission pasan.

---

## 13. Resumen ejecutivo

No adaptar PR #45 a Users/Employees -- PR #45 = Customers comerciales. La fundación RBAC ya
estaba construida en un 70% por Auth; PR1 la extiende (RoleRepository, resolución manage→read,
`role-super-admin-qa`) en vez de reconstruirla, y documenta -- sin implementar todavía -- un gap
de seguridad real en `CurrentSessionProvider` que requiere coordinar con Andy antes de tocar
`auth/`. Después: `feature/admin-roles-employees`, `feature/rbac-backoffice-enforcement`,
`feature/rbac-sales-operations-enforcement`, `feature/rbac-final-integration`. No implementar
excepciones temporales antes de la Fundación RBAC completa. No hardcodear los seis roles. No
duplicar `permissionsConfig`. No meter `inviteEmployee` en Customers. No usar Sidebar como
control de acceso. No confiar en `tenantId`/`branchId`/`roleId` enviados por UI.
