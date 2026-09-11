# administration

Responsable: Jose

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

El alcance completo del modulo, los contratos verificados, los bloqueantes y el orden de trabajo
estan en `SCOPE.md`.

## Contracts que consume

UserRepository, RoleRepository, BranchRepository, BusinessConfigRepository, TenantRepository, SupplierRepository, BankAccountRepository, CustomerRepository, AuditLogRepository, CashShiftRepository

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

## Caja

La pantalla `/administracion/caja` expone un visor de conciliación de turnos de caja. Se integra
en la navegación como `administration-cash`, exige el permiso nuevo `admin.cash.read` y se
actualiza cuando recibe el evento `cash-shift.changed`.

La consulta muestra apertura, monto esperado, conteo, diferencia y estado. No abre ni cierra
turnos, no registra movimientos, no ajusta conciliaciones y no escribe auditoría. El desglose de
movimientos tampoco está disponible porque el contrato actual no expone lectura de
`CashMovement`.

### Contrato de integracion

La feature asume:

- `useCurrentSession()` para resolver `tenantId`, permisos y estado de sesión.
- `RepositoryRegistry.cashShifts` como fuente principal, más `branches` y `users` únicamente
  para resolver nombres dentro del mismo tenant.
- `formatCurrency` y `formatDate` de `shared/utils` para presentar montos y fechas.

Decisiones y coordinación:

- Caja es 100% solo lectura por decisión de producto. Un eventual ajuste necesita un método nuevo
  en `CashShiftRepository`, acordado con Riquelme como dueño del dominio de caja.
- El contrato actual no permite consultar el desglose de movimientos.
- `admin.cash.read` es un permiso nuevo. Se esperan colisiones en `permissions.ts`,
  `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con las ramas
  `feature/admin-branches`, `feature/admin-bank-accounts`, `feature/admin-suppliers`,
  `feature/admin-audit-log`, `feature/admin-ecommerce-config` y `feature/admin-customers`; al
  integrarlas deben conservarse todas las entradas.

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
