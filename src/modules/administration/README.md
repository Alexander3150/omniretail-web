# administration

Responsable: Jose

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

El alcance completo del modulo, los contratos verificados, los bloqueantes y el orden de trabajo
estan en `SCOPE.md`.

## Contracts que consume

UserRepository, RoleRepository, BranchRepository, BusinessConfigRepository, TenantRepository, SupplierRepository, BankAccountRepository, CustomerRepository, AuditLogRepository

## Configuracion del negocio

Implementado en esta rama:

- Formulario de capacidades operativas y trazabilidad por defecto del tenant.
- Presets de ferreteria, farmacia, abarroteria y servicios, con ajustes personalizados.
- Coherencia entre control de inventario, capacidades dependientes y tracking de productos.
- Lectura y actualizacion mediante `BusinessConfigRepository`, resuelto por `RepositoryProvider`.
- Sincronizacion de cambios mediante el evento `business-config.changed`.
- Ruta privada `/administracion/configuracion-negocio` y entrada de navegacion con permiso de administracion.
- Enforcement del permiso `admin.business_config.manage`: `SaveBusinessConfigService` recibe los
  permisos de la sesion y rechaza el guardado sin ese permiso; la pantalla ademas no renderiza el
  formulario. Ocultar el menu no se considera enforcement porque la configuracion es tenant-wide.

## Auditoria

Implementado en esta rama:

- Listado de solo lectura sobre `AuditLogRepository.getByTenant(tenantId)`, que garantiza el
  aislamiento antes de entregar datos al service, y ordenado por `createdAt` descendente.
- Enforcement de `admin.audit.read` dentro del service; la pantalla tambien presenta un estado sin
  acceso cuando el permiso no esta disponible.
- Busqueda libre y filtros por accion, tipo de entidad y rango de fechas, aplicados en memoria por
  la ausencia de filtros en el contrato actual.
- Paginacion en cliente con `TablePagination` y detalle en `Modal` con metadata serializada de forma
  defensiva.
- Resolucion del actor al nombre del usuario del tenant, con fallback al identificador y a
  `Sistema` cuando no existe `actorUserId`.
- Refresco manual y sincronizacion reactiva mediante el evento `audit.changed`, ignorando eventos
  que no pertenecen al tenant activo.
- Ruta privada `/administracion/auditoria` y entrada de navegacion con el nuevo permiso
  `admin.audit.read`.
- La pantalla no expone ni ejecuta ninguna operacion de escritura sobre auditoria.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta `/administracion/auditoria` e item `administration-audit` en la navegacion de
  Administracion.
- Permiso de solo lectura `admin.audit.read`.
- Refresco reactivo ante `audit.changed`; no expone alta, edicion, archivado ni llamadas a
  `AuditLogRepository.append()`.

Lo que asume de la plataforma:

- `useCurrentSession()` entrega el `tenantId` y los permisos efectivos de la sesion.
- `RepositoryRegistry` expone `auditLogs` para la lectura y `users` para resolver el nombre del
  actor.
- `shared/utils/formatDate` define el formato comun de las fechas mostradas.

Decisiones abiertas y coordinacion:

- `AuditLogRepository` ofrece lectura tenant-scoped, pero no filtros funcionales ni paginacion
  server-side. El backend futuro debera resolver el volumen real dentro de cada tenant.
- `admin.audit.read` es un permiso nuevo. Se esperan colisiones de integracion en `permissions.ts`,
  `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con
  `feature/admin-branches`, `feature/admin-bank-accounts` y `feature/admin-suppliers`; deben
  resolverse conservando las entradas de todas las pantallas.

## Proveedores

Implementado en esta rama:

- Listado del maestro de proveedores aislado por el `tenantId` de la sesion.
- Alta, edicion y archivado mediante services separados sobre `SupplierRepository`; el archivado
  usa el metodo de contrato `archive(id)` y conserva el historial.
- Enforcement de `admin.suppliers.manage` dentro de todos los services, tanto para leer como para
  mutar.
- Normalizacion antes de validar: los textos opcionales vacios se convierten a `undefined`, el
  correo se recorta y pasa a minusculas, y luego se validan nombre, estado y formato de correo.
- `Supplier.leadTimeDays` se expone solo como rollup derivado de las relaciones activas de
  `SupplierProduct`; no forma parte del formulario ni del DTO de escritura administrativo.
- Auditoria append-only en alta, edicion y archivado mediante `AuditLogRepository`.
- Sincronizacion mediante el evento `supplier.changed` que emite `MockSupplierRepository`.
- Tabla con `DataTable`, formulario en `Modal`, confirmacion de archivado y estados resueltos con
  `StatusBadge`.
- Ruta privada `/administracion/proveedores` y entrada de navegacion con
  `admin.suppliers.manage`.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta `/administracion/proveedores` y el item `administration-suppliers` en la navegacion de
  Administracion.
- Acceso de lectura y escritura protegido por `admin.suppliers.manage`; no existe un permiso
  separado de lectura.
- Acciones de auditoria `supplier.created`, `supplier.updated` y `supplier.archived`, con
  `entityType: "Supplier"`.
- Recarga reactiva ante el evento `supplier.changed`.

Lo que asume de la plataforma:

- `useCurrentSession()` entrega un usuario con `tenantId` e `id`, ademas de los permisos efectivos.
- `RepositoryRegistry` expone `suppliers` y `auditLogs` con los contratos compartidos vigentes.
- `config/statuses.ts` contiene las etiquetas para los valores de `SupplierStatus`.

Decisiones abiertas y coordinacion:

- Compras mantiene una vista de solo lectura sobre la misma entidad `Supplier`; no debe duplicar el
  maestro ni sus contratos.
- El orden definitivo del item en el menu se resolvera al integrar las pantallas paralelas.
- Se esperan colisiones de integracion en el array de permisos de `role-admin`, `navigation.ts`,
  `serviceHelpers.ts`, `README.md` y `SCOPE.md` con `feature/admin-branches` y
  `feature/admin-bank-accounts`; deben resolverse conservando las entradas de las tres pantallas.

## Consumo de la configuracion en otros modulos

La configuracion no describe al negocio: lo restringe. Los modulos consumidores la leen por
`BusinessConfigRepository` y no pueden ofrecer lo que esta deshabilitado.

- `supportsServices` y `supportsKits` limitan los tipos de producto que catalog permite crear.
- `supportsUnitsAndPackaging` desactivado obliga a una unica unidad por producto: la unidad de
  venta es la de inventario y no se persisten equivalencias.
- `supportsProductAttributes` desactivado oculta y descarta los atributos del producto.
- `supportsInventory`, `supportsLots`, `supportsExpiration` y `supportsSerials` acotan el tracking.

Un producto ya guardado con un tipo que despues se deshabilito conserva su tipo y puede editarse;
lo que se bloquea es crear uno nuevo o cambiar un producto hacia un tipo deshabilitado.

## Sucursales

Implementado en esta rama:

- Listado aislado por el `tenantId` de la sesion y mapeado a un DTO propio del modulo.
- Alta, edicion y archivado mediante services separados; archivar cambia el estado a `archived`
  y conserva el registro y sus referencias.
- Enforcement de lectura en `GetBranchesService`: acepta `admin.branches.read` o
  `admin.branches.manage`. Las mutaciones exigen `admin.branches.manage` dentro del service.
- La UI distingue sin acceso, solo lectura y gestion completa según esos permisos.
- Navegacion y services comparten semantica: como `NavigationItem.permission` es un unico string y
  no hay mecanismo de "cualquiera de estos permisos", la entrada del menu se protege con
  `admin.branches.manage` (el permiso que tiene la audiencia real). El camino de solo lectura del
  service queda como capa defensiva para un futuro rol read-only.
- Auditoria obligatoria en alta, edicion y archivado mediante `AuditLogRepository`.
- Validacion del dato recibido antes de normalizar codigo, nombre y campos opcionales.
- Sincronizacion de la lista y del selector activo mediante el evento `branch.changed` que ya
  emite `MockBranchRepository`.
- Tabla con `DataTable`, formulario en `Modal` y estados resueltos mediante `StatusBadge`.
- Ruta privada `/administracion/sucursales` y entrada de navegacion con
  `admin.branches.manage`.

El tipo de una sucursal existente permanece editable porque el contrato actual no define una
restriccion adicional. Si inventario o usuarios asignados requieren bloquear ese cambio, debe
acordarse como una regla de dominio explicita antes de implementarla.

Reactivar una sucursal archivada desde la edicion es una accion soportada e intencional: se cambia
su `status` mediante `UpdateBranchService`, sin crear una operacion paralela. La auditoria conserva
la accion `branch.updated` y `metadata.previousStatus` permite distinguir cuando el estado anterior
era `archived`.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta privada `/administracion/sucursales` y un item de navegacion bajo "Administracion"
  protegido por `admin.branches.manage`.
- Permisos `admin.branches.read` y `admin.branches.manage`, declarados en `permissions.ts` y
  asignados a `role-admin` en el seed demo. Los services aceptan cualquiera de los dos para
  lectura; la navegacion se protege con `manage` (ver "Sucursales" arriba).
- Escrituras de auditoria con las acciones `branch.created`, `branch.updated` y `branch.archived`
  sobre `entityType: "Branch"`.
- Reutiliza el evento `branch.changed` que ya emite `MockBranchRepository`; cualquier consumidor
  del listado o del `BranchSelector` se sincroniza con ese evento.

Lo que esta pantalla asume de la plataforma:

- Sesion resuelta con `tenantId` y `user.id`; sin eso la pantalla queda en estado de error.
- `RepositoryRegistry` provee `branches` y `auditLogs`.
- `config/statuses.ts` define los estados `active`, `inactive` y `archived`.

Decisiones abiertas para la integracion con los demas modulos:

- Alcance de `admin.branches.read` en otros roles: por ahora solo `role-admin`; depende de la
  matriz de roles que consensue el equipo.
- Mecanismo canonico de navegacion multi-permiso: hoy `NavigationItem.permission` es un unico
  string. Soportar "cualquiera de estos permisos" (para que un rol read-only vea el item con solo
  `admin.branches.read`) es un cambio transversal en `src/shared` (tipo + `filterNavigationItemsByPermissions`)
  que afecta a todos los modulos; queda fuera de esta pantalla.
- Orden definitivo del item "Sucursales" dentro del grupo "Administracion" cuando aterricen las
  demas pantallas del modulo.
- Bloquear el cambio de `type` de una sucursal con inventario o usuarios asignados: es una regla
  de dominio cross-modulo y debe acordarse antes de implementarla.
- La sesion demo esta fijada a un cajero; recorrer la pantalla en la demo requiere un switcher de
  rol o de usuario, que es responsabilidad del shell/plataforma.

## Cuentas bancarias

Implementado en esta rama:

- Maestro de cuentas bancarias aislado por el `tenantId` de la sesion y mapeado a un DTO propio
  del modulo.
- Alta, edicion y archivado mediante services separados; archivar cambia el estado a `archived`
  y conserva el registro y sus referencias historicas.
- Enforcement en la capa de aplicacion: `admin.bank_accounts.manage` es el unico permiso que
  expone el repositorio, asi que lectura y mutaciones lo exigen dentro del service. La pantalla
  ademas no renderiza el maestro sin ese permiso.
- Auditoria obligatoria en alta, edicion y archivado mediante `AuditLogRepository`
  (`bank_account.created` / `bank_account.updated` / `bank_account.archived`). La metadata solo
  incluye `accountNumberMasked` (nunca `accountNumber` completo); tampoco viaja en el payload del
  evento `payment.changed`, que solo lleva `entityId` / `tenantId` / `action`.
- Validacion del dato recibido antes de normalizar banco, titular, alias, numero de cuenta,
  tipo, moneda, estado y `branchIds`.
- `accountNumber` es la fuente de verdad (numero completo, necesario para futuros flujos de
  transferencia/deposito). `accountNumberMasked` se deriva SIEMPRE de `accountNumber` mediante
  `maskAccountNumber` (conserva los ultimos 4 caracteres, p. ej. `123456789012` -> `********9012`):
  no es un input independiente ni se acepta desde el DTO de alta/edicion, para que nunca quede
  desincronizado del numero real.
- En alta, `accountNumber` es obligatorio. En edicion, dejarlo vacio conserva el numero actual (y
  su mascara) sin volver a mostrarlo en el formulario; el listado (`BankAccountTable`) solo
  renderiza `accountNumberMasked`, nunca el numero completo.
- El mock persiste `accountNumber` en texto plano porque el store es ficticio y los datos de
  `demoSeed` son inventados. En un backend real, `accountNumber` debe almacenarse
  protegido/cifrado, los endpoints de listado deben devolver solo `accountNumberMasked`/last4, y
  revelar el numero completo debe exigir autorizacion especifica y no registrarse nunca en logs o
  auditoria (ver punto de auditoria abajo). No se implementa cifrado de cliente en esta rama.
- `branchIds` se valida en `CreateBankAccountService` y `UpdateBankAccountService` contra el
  maestro real, no solo en la UI: cada sucursal debe existir y pertenecer al tenant; las nuevas
  ademas deben estar activas. Las sucursales que la cuenta ya tenia asignadas se conservan aunque
  hoy esten inactivas, pero no se puede agregar una sucursal inactiva o de otro tenant.
- Sincronizacion de la lista mediante los eventos `payment.changed` (que emite
  `MockBankAccountRepository`) y `branch.changed` (para refrescar las opciones de sucursal).
- Tabla con `DataTable`, formulario en `Modal` y estados resueltos mediante `StatusBadge`.
- Ruta privada `/administracion/cuentas-bancarias` y entrada de navegacion con
  `admin.bank_accounts.manage`.

La confirmacion de cada transferencia la hace el cajero en POS (Riquelme). Aca solo se administra
el maestro; no se duplica esa logica.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta privada `/administracion/cuentas-bancarias` y un item de navegacion bajo "Administracion"
  protegido por `admin.bank_accounts.manage`.
- El permiso `admin.bank_accounts.manage`, ya declarado en `permissions.ts`, ahora asignado a
  `role-admin` en el seed demo.
- Escrituras de auditoria con las acciones `bank_account.created`, `bank_account.updated` y
  `bank_account.archived` sobre `entityType: "BankAccount"`.

Lo que esta pantalla asume de la plataforma:

- Sesion resuelta con `tenantId` y `user.id`; sin eso la pantalla queda en estado de error.
- `RepositoryRegistry` provee `bankAccounts`, `branches` y `auditLogs`.
- `config/statuses.ts` define los estados `active`, `inactive` y `archived`.
- No existe un evento `bank-account.changed` dedicado: `MockBankAccountRepository` emite
  `payment.changed`, un evento compartido con otros repositorios de pago.

Decisiones abiertas para la integracion con los demas modulos:

- Si `branchIds` debe exigir al menos una sucursal: el contrato no lo define y hoy se permite
  vacio. POS lo necesita para asociar transferencias, asi que conviene acordarlo.
- Orden definitivo del item dentro del grupo "Administracion" cuando aterricen las demas
  pantallas del modulo (colision esperable en `navigation.ts` y en el array de permisos de
  `role-admin` con las otras ramas de administration).
- La sesion demo esta fijada a un cajero; recorrer la pantalla en la demo requiere un switcher
  de rol o de usuario, que es responsabilidad del modulo auth / shell.

## Reglas

- No duplicar entities de `core/`.
- No acceder directamente a LocalStorage.
- Usar repositories desde `RepositoryProvider`.
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.

## Estructura futura

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
