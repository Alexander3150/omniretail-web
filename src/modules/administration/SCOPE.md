# administration - Scope del modulo

Responsable: Jose

Ruta base: `/administracion`

Este documento define el territorio completo del modulo: pantallas, entidades propias,
contratos verificados, bloqueantes y orden de trabajo. El `README.md` registra lo ya
implementado; este archivo registra lo que falta.

Regla de jerarquia (`docs/SOURCE_OF_TRUTH.md`): el codigo TypeScript actual es la verdad
ejecutable. Todo lo verificado aqui se leyo del codigo, no del PDF de arquitectura.

---

## 1. Pantallas

Es el modulo mas grande del sistema: 14 pantallas contra 2-4 de los demas.

| Pantalla | Ruta | Responsabilidad | Estado |
| --- | --- | --- | --- |
| Configuracion del negocio | `/administracion/configuracion-negocio` | Capacidades del tenant y trazabilidad por defecto | Desbloqueada |
| Sucursales | `/administracion/sucursales` | CRUD de sedes y configuracion operativa | Desbloqueada |
| Proveedores | `/administracion/proveedores` | CRUD maestro de proveedores | Desbloqueada |
| Cuentas bancarias | `/administracion/cuentas-bancarias` | Cuentas del negocio para recibir transferencias | Desbloqueada |
| Diseno E-commerce | `/administracion/diseno-ecommerce` | Checkout invitado, metodos de pago y entrega | Parcial |
| Clientes | `/administracion/clientes` | Vista comercial de clientes y segmentos | Parcial |
| Auditoria | `/administracion/auditoria` | Bitacora de acciones sensibles | Parcial |
| Caja | `/administracion/caja` | Resumen y conciliacion de cierres del POS | Parcial |
| Dashboard | `/administracion/dashboard` | KPIs generales y accesos rapidos | Parcial |
| Reportes | `/administracion/reportes` | Reportes operativos y comerciales | Parcial |
| Roles y permisos | `/administracion/roles-permisos` | Crear roles y asignar permisos | Bloqueada |
| Usuarios | `/administracion/usuarios` | Empleados, rol y sucursal | Bloqueada |
| Planes y facturacion SaaS | `/administracion/planes-facturacion` | Plan contratado y facturacion del SaaS | Bloqueada |
| Sincronizacion | `/administracion/sincronizacion` | Estado simulado de integraciones | Bloqueada |

`Desbloqueada` = contrato completo, se puede construir hoy.
`Parcial` = falta algun metodo o campo; se puede construir con alcance recortado.
`Bloqueada` = requiere contract change o definicion de modelo antes de codear.

---

## 2. Ownership de entidades

CRUD propio de este modulo:

- `BusinessCapabilitiesConfig` - Configuracion del negocio
- `EcommerceConfig` - Diseno E-commerce
- `Branch` - Sucursales
- `Supplier` - Proveedores (Compras solo consulta la misma entidad)
- `BankAccount` - Cuentas bancarias (POS la consume para pagos por transferencia)
- `User` - Usuarios
- `Role` - Roles y permisos (contrato incompleto, ver seccion 4)
- `Tenant` - Configuracion y Planes (contrato incompleto, ver seccion 4)
- `CustomerSegment` - Clientes (sin contrato, ver seccion 4)

Solo lectura desde este modulo:

- `AuditLog` - append-only, lo emiten todos los modulos; aqui solo se lista y filtra
- `CashShift` / `CashMovement` - dueno real: `pos`; aqui solo se concilia
- `Product`, `Order`, `InventoryMovement`, `Payment` - solo agregados en Reportes
- `Permission` - catalogo global fijo; los roles se arman seleccionando de el
- `Notification` - infraestructura compartida, se muestra via `NotificationButton`

Regla que aplica a todo lo anterior: ningun modulo mantiene copia propia de una entidad
compartida. Todo pasa por los contratos de `src/core/repositories`.

---

## 3. Contratos verificados

Firmas leidas de `src/core/repositories/`:

| Repositorio | Metodos | Estado |
| --- | --- | --- |
| `BusinessConfigRepository` | `getCapabilities`, `updateCapabilities`, `getEcommerceConfig`, `updateEcommerceConfig` | Completo |
| `BranchRepository` | `getAll`, `getById`, `getActive`, `create`, `update` | Completo |
| `SupplierRepository` | `getAll`, `getById`, `getActive`, `getProductsBySupplier`, `create`, `update`, `archive` | Completo |
| `BankAccountRepository` | `getAll`, `getActive`, `getById`, `create`, `update` | Completo |
| `UserRepository` | `getAll`, `getById`, `getByEmail`, `create`, `update`, `updateStatus` | Completo |
| `AuditLogRepository` | `getAll`, `append` | Sin filtros server-side |
| `TenantRepository` | `getAll`, `getById` | Sin `create` ni `update` |
| `CustomerRepository` | `getAll`, `getById`, `getByUserId`, `getByEmail`, `create` | Sin `update` |
| `RoleRepository` | `getById` | Bloqueante |

Acceso: siempre via `useRepositories()` de `@/infrastructure/providers/RepositoryProvider`.
Nunca instanciar un `Mock*Repository` a mano ni tocar `localStorage`.

---

## 4. Bloqueantes y gaps

1. **`RoleRepository` solo expone `getById`.** No hay `getAll`, `create`, `update` ni `archive`.
   Bloquea la pantalla de Roles y permisos y, en cascada, la de Usuarios (no se puede asignar
   un rol que no se puede listar). Es la ruta critica del modulo.
   Contract change coordinado con **Andy** - `docs/MODULE_OWNERSHIP.md` asigna User/Auth a
   Andy + Jose. Seguir `.ai/skills/contract-change/SKILL.md`.

2. **`Branch` no tiene `schedule`.** Campos reales: `id`, `tenantId`, `code`, `name`, `type`,
   `address?`, `phone?`, `email?`, `status`. La pantalla de Sucursales no puede administrar
   horarios sin extender la entity.

3. **`EcommerceConfig` no tiene `theme`.** Campos reales: `enabled`, `storeName`,
   `requireAccountForCheckout`, `guestTrackingEnabled`, `allowedDeliveryMethods[]`,
   `allowedPaymentMethods[]`, `defaultBranchId?`. No hay branding ni secciones visibles de tienda.

4. **`Supplier` no tiene `contacts[]`, `paymentTerms`, `currency` ni `leadTimeDays`.**
   Campos reales: `name`, `legalName?`, `taxId?`, `email?`, `phone?`, `address?`, `notes?`,
   `status`. El lead time y el costo por proveedor viven en `SupplierProduct`, no en `Supplier`.

5. **Los estados de usuario estan partidos en dos enums.**
   `UserStatus` = `active`, `inactive`, `blocked`, `archived`.
   `AccountStatus` = `pending_verification`, `active`, `temporarily_locked`,
   `password_reset_required`, `disabled`, `archived` - pertenece al dominio de Auth.
   La pantalla de Usuarios necesita ambos, y no hay contrato expuesto para `AuthAccount`.
   Ademas `src/config/statuses.ts` no tiene etiqueta para los valores de `AccountStatus`:
   habra que agregarlas ahi, no hardcodearlas en la pantalla.

6. **`TenantRepository` no tiene `update`.** Bloquea escribir datos del negocio desde
   Configuracion o Planes.

7. **No existe `CustomerSegmentRepository`.** La entity `CustomerSegment` esta definida, el
   contrato no. La gestion de segmentos queda bloqueada.

8. **Planes y facturacion SaaS y Sincronizacion no tienen entity en el modelo canonico.**
   No inventar `Plan`, `Subscription`, `SaasInvoice` ni nodos por cuenta propia: hay que
   acordarlo con el equipo primero.

---

## 5. Discrepancias entre el PDF de arquitectura y el codigo

Tabla de traduccion. La columna derecha es la que vale.

| PDF | Codigo real |
| --- | --- |
| `BusinessCapabilitiesConfig.allow*` | `supports*`, y con 4 campos mas que el PDF no lista |
| `BankAccount.accountHolder` | `holderName` |
| `BankAccount.accountNumber` | `accountNumberMasked` |
| `Supplier.tradeName` | `name` |
| `Supplier.nit` | `taxId` |
| `AuditLog.userId` | `actorUserId` |
| `AuditLog.timestamp` | `createdAt` |
| `AuditLog.module` | no existe |
| permiso `admin.users.create` | `admin.users.manage` |

Campos reales de `BusinessCapabilitiesConfig`: `tenantId`, `preset`, `supportsInventory`,
`supportsLots`, `supportsExpiration`, `supportsSerials`, `supportsMultipleLocations`,
`supportsUnitsAndPackaging`, `supportsProductAttributes`, `supportsKits`, `supportsServices`,
`defaultProductTracking`.

`BankAccount` ademas tiene `transferInstructions?`, que el PDF no menciona.

---

## 6. Permisos

Declarados hoy en `permissions.ts` de este modulo:

`admin.users.read`, `admin.users.manage`, `admin.roles.read`, `admin.roles.manage`,
`admin.branches.read`, `admin.branches.manage`, `admin.business_config.manage`,
`admin.suppliers.manage`, `admin.bank_accounts.manage`.

No existen todavia y hay que declararlos cuando se construyan sus pantallas:
`admin.customers.read/manage`, `admin.audit.read`, `admin.cash.read`,
`admin.reports.read`, `admin.reports.export`, `admin.ecommerce_config.manage`,
`users.credentials.reset`.

Los permisos se agregan al catalogo global desde `src/config/permissions.ts`, que ya importa
`administrationPermissions`. La navegacion los usa para filtrar el Sidebar.

---

## 7. Componentes shared: disponibles y faltantes

El PDF afirma que todos existen. Verificado uno por uno en `src/shared/components/`:

Disponibles (tienen `index.tsx`): `Button`, `Input`, `Select`, `DataTable`, `Pagination`,
`StatusBadge`, `Modal`, `ConfirmDialog`, `PageHeader`, `Toast`, `SearchInput`, `FormField`.

Carpeta vacia, solo `.gitkeep` - hay que construirlos: `Accordion`, `Checkbox`, `ContextPanel`,
`CurrencyInput`, `DatePicker`, `Drawer`, `EmptyState`, `FileUpload`, `IconButton`, `KPICard`,
`LoadingState`, `NumberInput`, `RadioGroup`, `Tabs`, `Textarea`.

No existe ni la carpeta: `SectionCard`.

Impacto directo: el Dashboard necesita `KPICard`, los formularios complejos necesitan `Tabs`
y `Textarea`, y los paneles de detalle necesitan `ContextPanel` o `Drawer`. Ninguno existe.

Crear un componente en `shared/` es tocar area comun: seguir
`.ai/skills/shared-component/SKILL.md`, revisar consumidores y reportar impacto. Un componente
especifico de una sola pantalla se queda dentro del modulo.

---

## 8. Sistema visual

Tokens reales de `src/styles/tokens.css`. Usar siempre `var(--color-*)`, nunca hex literal.

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-app-background` | `#fff2d0` | Fondo de app |
| `--color-surface` | `#ffffff` | Superficies y tarjetas |
| `--color-structure` | `#3e668f` | Sidebar y estructura |
| `--color-topbar` | `#1e293b` | Barra superior |
| `--color-primary` | `#81a9ee` | Accion primaria |
| `--color-primary-hover` | `#6f99de` | Hover de accion primaria |
| `--color-title` | `#315d8c` | Titulos |
| `--color-text` | `#23364d` | Texto base |
| `--color-text-muted` | `#7488a6` | Texto secundario |
| `--color-border` | `#a8b8f2` | Bordes |
| `--color-success` | `#22a06b` | Exito |
| `--color-warning` | `#e0a11b` | Advertencia |
| `--color-danger` | `#d64545` | Peligro |

Divergencias con la paleta del PDF, ya verificadas:

- Advertencia: PDF `#D99A24`, token real `#e0a11b`.
- Peligro: PDF `#DC4C4C`, token real `#d64545`.
- El PDF define un gris de archivado `#6B7280`; **no existe token equivalente**. El estado
  `archived` se resuelve con el tono `neutral` de `StatusBadge`, no con un color propio.

Estados y etiquetas: nunca mostrar la key tecnica en la UI. `src/config/statuses.ts` mapea
key a `{ label, tone }` con tonos `neutral`, `info`, `success`, `warning`, `danger`.

Pantallas de creacion complejas (nuevo usuario, nuevo rol) van como pagina completa, no modal.

---

## 9. Reglas de plataforma

- R-P01 Aislamiento de tenant: ningun registro de una empresa se consulta o modifica desde otra.
- R-P02 Todo empleado pertenece a un tenant y tiene un rol principal.
- R-P03 Acceso efectivo = permiso del rol + alcance de sucursal + estado activo del usuario.
- R-P04 Toda accion sensible genera `AuditLog`.
- R-P05 Los `id` internos nunca sustituyen codigos comerciales visibles.
- R-P06 Datos con historial se archivan, no se eliminan.
- R-P07 Fechas en ISO 8601; se formatean solo en la UI.
- R-P08 Los mocks respetan exactamente los mismos tipos que las pantallas.

Sobre alcance de sucursal: `Role.branchScope` acepta `assigned`, `selected` o `all`, y `User`
tiene `branchId?` y `allowedBranchIds?`. Aunque el tenant tenga una sola sucursal y otras
pantallas oculten el selector, el modelo siempre conserva `branchId`.

No hardcodear logica del tipo `if (role === "gerente")`. El rol es solo una agrupacion de
permisos.

---

## 10. Orden de trabajo

De lo fundacional (de lo que dependen otros modulos) hacia lo periferico. Convencion de rama:
`feature/admin-<funcionalidad>` (`docs/GIT_WORKFLOW.md`).

| # | Rama | Estado |
| --- | --- | --- |
| 1 | `feature/admin-business-config` | En curso |
| 2 | `feature/admin-branches` | Lista para arrancar |
| 3 | `chore/admin-role-contracts` | Coordinar con Andy |
| 4 | `feature/admin-roles-permissions` | Depende de 3 |
| 5 | `feature/admin-users` | Depende de 4 |
| 6 | `feature/admin-suppliers` | Lista para arrancar |
| 7 | `feature/admin-bank-accounts` | Lista para arrancar |
| 8 | `feature/admin-ecommerce-design` | Parcial, sin theme |
| 9 | `feature/admin-customers` | Parcial, sin update ni segmentos |
| 10 | `feature/admin-dashboard` | Necesita `KPICard` en shared |
| 11 | `feature/admin-cash-reconciliation` | Depende de datos de POS |
| 12 | `feature/admin-audit-log` | Filtrado en cliente |
| 13 | `feature/admin-reports` | Agrega datos de otros modulos |
| 14 | Planes y facturacion / Sincronizacion | Bloqueadas por modelo |

Configuracion del negocio va primero porque el resto del sistema lee
`BusinessCapabilitiesConfig` para decidir que campos mostrar: Catalogo, Inventario, Compras,
Recepciones, POS y Logistica dependen de ella. `BusinessPreset` solo inicializa valores por
defecto desde `src/config/business-defaults.ts`; no bloquea que el dueno los cambie despues.

---

## 11. Preguntas abiertas para el equipo

1. `RoleRepository`: extender con `getAll`, `create`, `update` y `archive`. Coordinar con Andy.
2. `Branch.schedule`: se agrega a la entity o la pantalla no maneja horarios.
3. `EcommerceConfig.theme`: se agrega o Diseno E-commerce no incluye branding.
4. `Supplier`: se extiende con `contacts[]`, `paymentTerms`, `currency` y `leadTimeDays`, o la
   pantalla se limita a los campos actuales.
5. `TenantRepository.update` y `CustomerRepository.update`: se agregan o esas pantallas quedan
   de solo lectura.
6. `CustomerSegmentRepository`: se define o se pospone la gestion de segmentos.
7. Planes y facturacion SaaS: se define `Plan`/`Subscription`/`SaasInvoice` o se pospone.
8. Sincronizacion: mock estatico fijo o se define estructura de nodo/integracion.
9. Caja: la conciliacion admite ajuste con permiso superior o es 100% solo lectura.
10. Clientes: confirmar con Andy que campos y acciones son comerciales (administration) y
    cuales son de cuenta propia del cliente (customer), para no duplicar pantallas.

---

## 12. Seeds necesarios para demo

Escenarios que tocan directamente a este modulo:

- Administracion de personal: crear rol, asignar permisos y alcance, crear usuario, asignar rol
  y sucursal.
- Proveedor mantenido aqui y consultado por Compras, con `SupplierProduct` definiendo costos y
  unidades de compra.
- Empleado en primer acceso por invitacion y empleado sin acceso a correo con recuperacion
  asistida.
- Administrador con MFA habilitado.
- Al menos una cuenta `temporarily_locked` y una `disabled` o `archived`, para poder probar los
  estados en la pantalla de Usuarios.
