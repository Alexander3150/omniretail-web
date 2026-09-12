# Módulo `administration` — Especificación técnica

**Responsable:** José · **Ruta base:** `/administracion` · **14 pantallas**

> Documento de referencia único del módulo. Fusiona la especificación funcional derivada de
> `Arquitectura_Frontend_SaaS.pdf` con los contratos **verificados contra el código**.
>
> Regla de jerarquía (`docs/SOURCE_OF_TRUTH.md`): el código TypeScript actual es la verdad
> ejecutable. Donde el PDF y el código difieren, **manda el código** y la diferencia queda
> registrada en la sección 6. El `README.md` del módulo registra lo ya implementado; este
> documento registra el territorio completo.

---

## 1. Orientación rápida

- No hay backend. Todo vive detrás de los `Repository contracts` de `src/core/repositories`,
  implementados por `Mock*Repository` sobre `MockDatabaseStore` → `localStorage`.
- Se programa **siempre** contra los contratos. Nunca contra `localStorage`, seeds ni assets.
- Este módulo no inventa entidades. Lo que otro módulo posee (`Product`, `Order`) se **lee**
  por su repositorio compartido, jamás se copia.
- Dos pantallas (**Planes y facturación**, **Sincronización**) no tienen modelo definido. Van al
  final; no frenan el resto.
- El acceso a datos se resuelve con `useRepositories()` de
  `@/infrastructure/providers/RepositoryProvider`. El `tenantId` sale de `useCurrentSession()`
  (`@/modules/auth/hooks/useCurrentSession`), montado en `src/app/(private)/layout.tsx`.

---

## 2. Tabla maestra de pantallas

| #   | Pantalla                  | Ruta                                    | Entidad principal             | Estado                              |
| --- | ------------------------- | --------------------------------------- | ----------------------------- | ----------------------------------- |
| 1   | Configuración del negocio | `/administracion/configuracion-negocio` | `BusinessCapabilitiesConfig`  | ✅ **Implementada**                 |
| 2   | Sucursales                | `/administracion/sucursales`            | `Branch`                      | ✅ **Implementada**                 |
| 3   | Proveedores               | `/administracion/proveedores`           | `Supplier`                    | ✅ **Implementada**                 |
| 4   | Cuentas bancarias         | `/administracion/cuentas-bancarias`     | `BankAccount`                 | ✅ **Implementada**                 |
| 5   | Diseño E-commerce         | `/administracion/diseno-ecommerce`      | `EcommerceConfig`             | ✅ **Implementada** — sin branding  |
| 6   | Clientes                  | `/administracion/clientes`              | `Customer`, `CustomerSegment` | ✅ **Implementada** — sin segmentos |
| 7   | Auditoría                 | `/administracion/auditoria`             | `AuditLog`                    | ✅ **Implementada**                 |
| 8   | Caja                      | `/administracion/caja`                  | `CashShift`, `CashMovement`   | ⚠️ Parcial — solo lectura           |
| 9   | Dashboard                 | `/administracion/dashboard`             | Agregación                    | ⚠️ Necesita `KPICard`               |
| 10  | Reportes                  | `/administracion/reportes`              | Agregación                    | ⚠️ Necesita datos de otros módulos  |
| 11  | Roles y permisos          | `/administracion/roles-permisos`        | `Role`, `Permission`          | ⛔ **Bloqueada** — contrato         |
| 12  | Usuarios                  | `/administracion/usuarios`              | `User` (+ `AuthAccount`)      | ⛔ Bloqueada — depende de #11       |
| 13  | Planes y facturación SaaS | `/administracion/planes-facturacion`    | _(sin definir)_               | ⛔ Bloqueada — modelo               |
| 14  | Sincronización            | `/administracion/sincronizacion`        | _(sin definir)_               | ⛔ Bloqueada — modelo               |

---

## 3. Estructura del módulo

Convención **plana**, igual que `catalog` e `inventory`. No carpetas por pantalla.

```text
src/modules/administration/
├── application/
│   ├── dto/            BusinessConfigDto.ts, CreateUserDto.ts, ...
│   ├── mappers/        BusinessConfigMapper.ts, UserMapper.ts, ...
│   └── services/       GetXService.ts, SaveXService.ts, serviceHelpers.ts
├── components/         BusinessConfigForm.tsx, BusinessConfigToggle.tsx, ...
├── hooks/              useBusinessConfig.ts, useUsers.ts, ...
├── pages/              BusinessConfigPage.tsx, UsersPage.tsx, ...
├── validation/         businessConfig.validation.ts, ...
├── navigation.ts       entradas del acordeón "Administración"
├── permissions.ts      define PermissionDefinition[] del módulo
├── index.ts            barrel: exporta solo las pages
├── README.md           registro de lo implementado por rama
└── SCOPE.md            este documento
```

**Nombres:** `Get<X>Service` / `Save<X>Service` / `Create|Update|Archive|Restore<X>Service` ·
`use<X>` · `<X>Page` · `<x>.validation.ts`.

### Patrón obligatorio (three-layer)

```text
Page → Hook → Service → Repository contract → MockRepository → MockDatabaseStore
```

```ts
// Service: recibe el registry por constructor, expone execute()
export class GetBusinessConfigService {
  constructor(private readonly repositories: RepositoryRegistry) {}
  async execute(tenantId: string): Promise<BusinessConfigDto> { ... }
}

// Hook: resuelve el registry del contexto, instancia con useMemo, escucha eventos
const repositories = useRepositories();
const service = useMemo(() => new GetBusinessConfigService(repositories), [repositories]);
useDataEvent("business-config.changed", reload);

// Page: solo consume hooks y compone components/. No toca repositorios ni services.
```

**Regla aprendida en la rama 1:** las invariantes de negocio van en el **service**, no solo en la
página. La UI es una de las formas de entrar al dominio, no la única. Y cuidado con encadenar
normalización + validación: si normalizás primero, la validación no puede fallar nunca.

---

## 4. Contratos verificados

Firmas reales leídas de `src/core/repositories/`.

| Repositorio                 | Métodos                                                                                        | Estado                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `BusinessConfigRepository`  | `getCapabilities` · `updateCapabilities` · `getEcommerceConfig` · `updateEcommerceConfig`      | ✅ Completo                                         |
| `BranchRepository`          | `getAll` · `getById` · `getActive` · `create` · `update`                                       | ✅ Completo                                         |
| `SupplierRepository`        | `getAll` · `getById` · `getActive` · `getProductsBySupplier` · `create` · `update` · `archive` | ✅ Completo                                         |
| `BankAccountRepository`     | `getAll` · `getActive` · `getById` · `create` · `update`                                       | ✅ Completo                                         |
| `UserRepository`            | `getAll` · `getById` · `getByEmail` · `create` · `update` · `updateStatus`                     | ✅ Completo                                         |
| `AuditLogRepository`        | `getByTenant` · `append`                                                                       | Sin filtros funcionales ni paginacion server-side   |
| `TenantRepository`          | `getAll` · `getById`                                                                           | Sin `create` ni `update`                            |
| `CustomerRepository`        | `getAll` · `getById` · `getByUserId` · `getByEmail` · `create` · `update`                      | Sin segmentos                                       |
| `RoleRepository`            | `getById`                                                                                       | ⛔ **Bloqueante**                                   |
| `CustomerSegmentRepository` | —                                                                                               | ⛔ **No existe**                                    |

---

## 5. Entidades reales

Copiadas del código, no del PDF. Todas viven en `src/core/entities/`.

### 5.1 CRUD propio de este módulo

```ts
interface Tenant {
  id: string;
  name: string;
  legalName?: string;
  slug: string;
  status: TenantStatus;
  defaultCurrency: CurrencyCode;
  timezone: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface Branch {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: BranchType; // main | store | warehouse
  address?: string;
  phone?: string;
  email?: string;
  status: BranchStatus; // active | inactive | archived
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
// NO existe `schedule`.

interface BusinessCapabilitiesConfig {
  tenantId: string; // no tiene id ni timestamps
  preset: BusinessPreset;
  supportsInventory: boolean;
  supportsLots: boolean;
  supportsExpiration: boolean;
  supportsSerials: boolean;
  supportsMultipleLocations: boolean;
  supportsUnitsAndPackaging: boolean;
  supportsProductAttributes: boolean;
  supportsKits: boolean;
  supportsServices: boolean;
  defaultProductTracking: ProductTrackingConfig; // { stock, lot, expiration, serial }
}

interface EcommerceConfig {
  tenantId: string;
  enabled: boolean;
  storeName: string;
  requireAccountForCheckout: boolean;
  guestTrackingEnabled: boolean;
  allowedDeliveryMethods: DeliveryMethod[];
  allowedPaymentMethods: PaymentMethod[];
  defaultBranchId?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
// NO existe `theme`.

interface User {
  id: string;
  tenantId: string;
  customerId?: string;
  employeeCode?: string;
  name: string;
  email: string;
  phone?: string;
  type: UserType; // customer | employee
  status: UserStatus; // active | inactive | blocked | archived
  roleId?: string;
  branchId?: string;
  allowedBranchIds?: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

type BranchScope = "assigned" | "selected" | "all";

interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: string[];
  branchScope: BranchScope;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
// `branchScope` vive en Role, NO en User. Role no tiene `preset` ni `status`.

interface Permission {
  key: string;
  module: string;
  name: string;
  description: string;
}

interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  leadTimeDays?: number; // rollup derivado/read-only de SupplierProduct activos
  status: SupplierStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
// NO existen contacts[], paymentTerms ni currency.
// SupplierProduct.leadTimeDays es el dato específico; Supplier.leadTimeDays es su rollup MAX.

type BankAccountType = "monetary" | "savings";
type BankAccountStatus = "active" | "inactive" | "archived";

interface BankAccount {
  id: string;
  tenantId: string;
  bankName: string;
  holderName: string; // NO accountHolder
  accountNumber: string; // fuente de verdad; NO input editable en Update, no viaja en DTOs de listado
  accountNumberMasked: string; // SIEMPRE derivado de accountNumber (maskAccountNumber), no es input
  accountType: BankAccountType;
  currency: CurrencyCode;
  alias: string; // obligatorio
  branchIds: string[]; // obligatorio
  transferInstructions?: string;
  status: BankAccountStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface CustomerSegment {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  active: boolean; // booleano, NO status
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

`BusinessPreset` es un **enum** en `src/core/enums`, no una entity:
`hardware_store | pharmacy | grocery | services | custom`.
Sus valores por defecto viven en `src/config/business-defaults.ts` (`custom` excluido).

### 5.2 Compartidas o de solo lectura

```ts
interface Customer {
  id: string;
  tenantId: string;
  userId?: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  segmentId?: string;
  status: CustomerStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
// NO existe `type: registered|b2b|guest` ni `taxId`.

interface AuditLog {
  id: string;
  tenantId: string;
  actorUserId?: string; // NO userId
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: ISODateString; // NO timestamp
}
// NO existe `module`.

interface CashShift {
  id: string;
  tenantId: string;
  branchId: string;
  userId: string; // NO cashierUserId
  registerCode: string; // NO registerId
  status: CashShiftStatus; // open | closed | closed_with_difference
  openedAt: ISODateString;
  openingAmount: number;
  closedAt?: ISODateString;
  expectedAmount?: number;
  countedAmount?: number;
  difference?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface CashMovement {
  id: string;
  cashShiftId: string;
  type: CashMovementType; // in | out
  amount: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdByUserId: string;
  createdAt: ISODateString;
}

interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  customerId?: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  status: NotificationStatus;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: ISODateString;
  readAt?: ISODateString;
}
```

### 5.3 Dominio de Auth (Andy) — solo referencia

La pantalla de Usuarios dispara acciones sobre esto, pero no lo implementa.

```ts
interface AuthAccount {
  id: string;
  userId: string;
  email: string;
  passwordHashMock: string;
  status: AccountStatus; // pending_verification | active |
  // temporarily_locked | password_reset_required |
  // disabled | archived
  failedLoginAttempts: number;
  lockedUntil?: ISODateString;
  passwordChangedAt?: ISODateString;
  lastLoginAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

interface MfaEnrollment {
  id: string;
  userId: string;
  enabled: boolean;
  method: "totp" | "email";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
```

**Importante:** MFA es una entidad aparte, no un campo de `AuthAccount`. Y los estados que el PDF
pide para Usuarios (`disabled`, `password_reset_required`, `temporarily_locked`) viven en
`AccountStatus`, no en `UserStatus`. La pantalla necesita ambos, y hoy **no hay contrato expuesto
para `AuthAccount`**.

Políticas ya definidas: `src/config/auth-policy.ts` (`maxLoginAttempts: 5`,
`lockDurationMinutes: 15`, `passwordResetTokenMinutes: 30`, `emailVerificationTokenHours: 24`,
override `demoMode`) y `src/config/session-policy.ts` (`normalSessionHours: 8`,
`rememberMeDays: 30`).

---

## 6. Bloqueantes y gaps

1. **`RoleRepository` solo expone `getById`.** Bloquea Roles y permisos y, en cascada, Usuarios.
   **Es contrato tuyo**: el ownership te asigna el CRUD de `Role`, y `docs/MODULE_OWNERSHIP.md`
   aclara que _"Coordinator no significa dueno exclusivo"_. Abrís vos el PR
   `chore/admin-role-contracts` con `getAll`, `create`, `update` y `archive`, y le avisás a Andy
   por ser área común. No se espera autorización, se informa impacto.
2. **`Branch` sin `schedule`.** Sucursales no puede manejar horarios sin extender la entity.
3. **`EcommerceConfig` sin `theme`.** Diseño E-commerce no incluye branding.
4. **`Supplier` sin `contacts[]`, `paymentTerms` ni `currency`; `leadTimeDays` es derivado.**
5. **Sin contrato para `AuthAccount` ni `MfaEnrollment`.** Invitación, activación asistida y MFA
   quedan bloqueadas. Esto **sí** es dominio de Andy.
6. **`TenantRepository` sin `update`.** Bloquea escritura de datos del negocio.
7. **Sin `CustomerSegmentRepository`.**
8. **`AuditLogRepository` sin filtros funcionales ni paginacion.** La lectura esta aislada por
   tenant en el repositorio; los filtros de la pantalla se aplican en cliente sobre ese subconjunto.
9. **Planes y facturación / Sincronización sin entity.** No inventar; definir en equipo.
10. **El filtro de permisos del Sidebar no está conectado.** `filterNavigationItemsByPermissions`
    existe y funciona, pero `PrivateShell` nunca pasa `allowedPermissions`, así que hoy se ve
    todo el menú. Cae en tu dominio (permisos) y es `shared/`: coordinar.

---

## 7. Discrepancias PDF vs. código

Tabla de traducción. **La columna derecha es la que vale.**

| PDF / guía previa                                       | Código real                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Tenant.tradeName` / `.taxId` / `.defaultBranchId`      | no existen; hay `name`, `slug`, `timezone`                                                             |
| `BusinessCapabilitiesConfig.allow*`                     | `supports*` (y 4 campos más)                                                                           |
| `defaultProductTraceability`                            | `defaultProductTracking`                                                                               |
| `BusinessPreset` como entity                            | enum en `core/enums` + `config/business-defaults.ts`                                                   |
| `EcommerceConfig.guestCheckoutEnabled` / `.theme`       | `guestTrackingEnabled`; `theme` no existe                                                              |
| `EcommerceConfig.enabled*Methods`                       | `allowedDeliveryMethods` / `allowedPaymentMethods`                                                     |
| `Branch.schedule`                                       | no existe                                                                                              |
| `User.displayName` / `.assignedBranchId` / `.branchIds` | `name` / `branchId` / `allowedBranchIds`                                                               |
| `User.branchScope`                                      | vive en `Role.branchScope`                                                                             |
| `Role.preset` / `.status`                               | no existen; hay `isSystem`                                                                             |
| `Permission.action`                                     | `name`                                                                                                 |
| `Supplier.tradeName` / `.nit`                           | `name` / `taxId`                                                                                       |
| `BankAccount.accountHolder`                             | `holderName`                                                                                           |
| `BankAccount.accountNumberMasked` como input editable   | se deriva SIEMPRE de `accountNumber` (`maskAccountNumber`); el DTO de alta/edición usa `accountNumber` |
| `Customer.type` / `.taxId`                              | no existen; hay `code`                                                                                 |
| `AuditLog.userId` / `.timestamp` / `.module`            | `actorUserId` / `createdAt` / no existe                                                                |
| `CashShift.registerId` / `.cashierUserId`               | `registerCode` / `userId`                                                                              |
| `CashShiftStatus: balanced \| discrepancy`              | `open \| closed \| closed_with_difference`                                                             |
| `AuthAccount.mfaRequired` / `.mfaEnabled`               | entity aparte `MfaEnrollment`                                                                          |
| `admin.users.create`                                    | `admin.users.manage`                                                                                   |
| Tipografía Inter                                        | la app usa **Geist** (`src/app/layout.tsx`)                                                            |
| Rama `feature/administration-<tarea>`                   | `feature/admin-<funcionalidad>`                                                                        |

---

## 8. Permisos

Declarados hoy en `permissions.ts` de este módulo (9):

`admin.users.read` · `admin.users.manage` · `admin.roles.read` · `admin.roles.manage` ·
`admin.branches.read` · `admin.branches.manage` · `admin.business_config.manage` ·
`admin.suppliers.manage` · `admin.bank_accounts.manage`

**No existen** y hay que declararlos al construir sus pantallas:
`admin.customers.read/manage` · `admin.audit.read` · `admin.cash.read` ·
`admin.reports.read/export` · `admin.ecommerce_config.manage` · `users.credentials.reset`

La granularidad del repo es `read` / `manage`, no `create/update/archive`. Mantenerla.

`src/config/permissions.ts` ya agrega `administrationPermissions` al catálogo global.

**Regla dura:** nunca `if (role === "gerente")`. Todo pasa por los `permissions[]` del rol activo.
El rol es una agrupación de permisos, nada más.

---

## 9. Componentes shared: verificado uno por uno

**Disponibles** (tienen `index.tsx`):
`Button` · `Input` · `Select` · `SearchInput` · `FormField` · `DataTable` · `Pagination` ·
`StatusBadge` · `Modal` · `ConfirmDialog` · `PageHeader` · `Toast`

**Carpeta vacía — hay que construirlos:**
`Accordion` · `Checkbox` · `ContextPanel` · `CurrencyInput` · `DatePicker` · `Drawer` ·
`EmptyState` · `FileUpload` · `IconButton` · `KPICard` · `LoadingState` · `NumberInput` ·
`RadioGroup` · `Tabs` · `Textarea`

**No existen ni como carpeta:** `SectionCard` · `FilterChip` · `Breadcrumbs`

Impacto: Dashboard necesita `KPICard`; los formularios complejos necesitan `Tabs` y `Textarea`;
los paneles de detalle necesitan `ContextPanel` o `Drawer`. Ninguno existe.

**Decisión tomada:** un componente que solo usa este módulo se construye en
`administration/components/`. Promoverlo a `shared/` es área común: requiere
`.ai/skills/shared-component/SKILL.md` y coordinación previa. Así se resolvió el toggle de
Configuración del negocio.

---

## 10. Sistema visual

Tokens reales de `src/styles/tokens.css`. Usar siempre `var(--color-*)`, nunca hex literal.

| Token                    | Valor     | Uso                    |
| ------------------------ | --------- | ---------------------- |
| `--color-app-background` | `#fff2d0` | Fondo de app           |
| `--color-surface`        | `#ffffff` | Superficies y tarjetas |
| `--color-structure`      | `#3e668f` | Sidebar y estructura   |
| `--color-topbar`         | `#1e293b` | Barra superior         |
| `--color-primary`        | `#81a9ee` | Acción primaria        |
| `--color-primary-hover`  | `#6f99de` | Hover primario         |
| `--color-title`          | `#315d8c` | Títulos                |
| `--color-text`           | `#23364d` | Texto base             |
| `--color-text-muted`     | `#7488a6` | Texto secundario       |
| `--color-border`         | `#a8b8f2` | Bordes                 |
| `--color-success`        | `#22a06b` | Éxito                  |
| `--color-warning`        | `#e0a11b` | Advertencia            |
| `--color-danger`         | `#d64545` | Peligro                |

Divergencias con la paleta del PDF: advertencia (`#D99A24` → `#e0a11b`), peligro
(`#DC4C4C` → `#d64545`), y el gris de archivado `#6B7280` **no tiene token**: `archived` se
resuelve con el tono `neutral` de `StatusBadge`.

**Tipografía:** la app carga **Geist** en `src/app/layout.tsx`. No cargar otra fuente desde un
módulo — la tipografía es decisión global.

**Layout:** pantallas de creación complejas (Nuevo usuario, Nuevo rol) van como **página
completa**, nunca modal.

**Estados:** nunca mostrar la key técnica. `src/config/statuses.ts` mapea key → `{ label, tone }`
con tonos `neutral | info | success | warning | danger`. Ya cubre `active`, `inactive`,
`archived`, `blocked`, `open`, `closed`, `closed_with_difference`, entre otros.
**Faltan** las etiquetas de `AccountStatus` (`temporarily_locked`, `password_reset_required`,
`disabled`, `pending_verification`): agregarlas ahí, no en la pantalla.

---

## 11. Reglas de plataforma

- **R-P01** Aislamiento de tenant: ningún registro de una empresa se ve o edita desde otra.
- **R-P02** Todo empleado pertenece a un tenant y tiene un rol principal.
- **R-P03** Acceso efectivo = permiso del rol + alcance de sucursal + estado activo.
- **R-P04** Toda acción sensible genera `AuditLog`. No condicional: siempre.
- **R-P05** Los `id` internos nunca sustituyen códigos comerciales visibles.
- **R-P06** Datos con historial se archivan, no se eliminan.
- **R-P07** Fechas en ISO 8601; se formatean solo en la UI.
- **R-P08** Los mocks respetan exactamente los mismos tipos que las pantallas.
- **R-P09** El storefront usa la marca del tenant. "FerrePharma" es un tenant de ejemplo, no el
  nombre del SaaS.

Sobre alcance de sucursal: aunque el tenant tenga una sola sucursal y otras pantallas oculten el
selector, el modelo **siempre** conserva `branchId`.

---

## 12. Especificación pantalla por pantalla

### 12.1 Configuración del negocio ✅ implementada

Rama `feature/admin-business-config`. Selector de preset + 9 toggles de capacidades + 4 de
trazabilidad por defecto. `BusinessPreset` solo **inicializa** valores (R-C13): el dueño puede
cambiarlos después. Tocar una capacidad a mano manda el preset a `custom`.

Coherencia: con `supportsInventory` apagado, lotes, vencimiento, series y ubicaciones se apagan y
deshabilitan, y toda la trazabilidad queda en `false`. La invariante se valida en
`SaveBusinessConfigService`, no solo en el formulario.

Fuera de alcance: `AttributeDefinition` / `ProductAttributeValue` se gestionan en
`/inventario/atributos` (Melbyn). Acá solo se prende o apaga `supportsProductAttributes`.

### 12.2 Sucursales ✅ implementada

Tabla: `code`, `name`, `type`, `address`, `status`, acciones. Formulario: `code`, `name`, `type`
(`main`/`store`/`warehouse`), `address`, `phone`, `email`, `status`.
Sin `schedule` hasta que se extienda la entity.
Impacto: toda sucursal creada debe aparecer en `BranchSelector` y en el alcance de Usuarios.

### 12.3 Proveedores ✅ implementada

Tabla: `name`, `taxId`, `email`, `phone`, `status`. Formulario: `name`, `legalName`, `taxId`,
`email`, `phone`, `address`, `notes`, `status`.
Un proveedor con historial se **archiva** (R-I06) — `SupplierRepository.archive` ya existe.
Compras (Melbyn) tiene vista de solo consulta sobre la **misma** entity. No duplicar el CRUD.

### 12.4 Cuentas bancarias ✅ implementada

⚠️ El diseño viejo (código/país/contacto de banco) quedó descartado. Modelo vigente: sección 5.1.
Tabla: `bankName`, `holderName`, `alias`, `accountType`, `accountNumberMasked`, `status`. Nunca
`accountNumber` completo en el listado.
Formulario: todos los anteriores + `accountNumber` (número completo, fuente de verdad —
`accountNumberMasked` se deriva automáticamente, no es un campo editable), `branchIds` (sucursales
habilitadas), `transferInstructions`.
Obligatorios: banco, titular, número (solo en alta; en edición vacío = conservar el actual), tipo,
moneda y estado.
Límite: acá se administra el maestro. La confirmación de cada transferencia la hace el cajero en
POS (Riquelme).

### 12.5 Diseño E-commerce ✅ implementada

Campos reales: `enabled`, `storeName`, `requireAccountForCheckout`, `guestTrackingEnabled`,
`allowedPaymentMethods[]`, `allowedDeliveryMethods[]`, `defaultBranchId`.
Sin branding hasta que se agregue `theme`.
No se configura acá la trazabilidad (eso es 12.1) ni el diseño visual del storefront (María).

### 12.6 Clientes ✅ implementada

Vista comercial. Tabla: `code`, `name`, `email`, segmento, `status`.
El self-service del cliente (registro, login, direcciones, pedidos propios) vive en el módulo
`customer` de Andy. No duplicar.
Segmentos bloqueados hasta que exista `CustomerSegmentRepository`.

### 12.7 Auditoría ✅ implementada

Tabla filtrable: `createdAt`, actor, `action`, `entityType`, `entityId`, `metadata`.
Sin campo `module`: si se necesita agrupar por módulo, se deriva de `action` o `entityType`.
Filtrado en cliente (`getAll`). Nunca se escribe desde acá: lo emiten los demás módulos (R-P04).

### 12.8 Caja

Solo consulta y conciliación sobre `CashShift` / `CashMovement` (dueño: POS).
Estados reales: `open`, `closed`, `closed_with_difference`.
Reglas a reflejar, no reimplementar: conteo ciego y comparación contra lo esperado (R-PS06); toda
diferencia requiere motivo y queda auditada (R-PS07).
**GAP:** ¿permite ajuste con permiso superior o es 100% solo lectura? Preguntar antes de diseñar.

### 12.9 Dashboard

KPIs agregados: ventas del día/mes, alertas de stock, pedidos pendientes, últimas incidencias.
Sin reglas propias: 100% agregación vía repositorios ajenos. Necesita `KPICard`, que no existe.

### 12.10 Reportes

Agrega `Sale`, `PurchaseOrder`, `InventoryMovement`, `Payment` vía repositorios compartidos.
Nunca crear un almacén paralelo de reportes. Dejar para el final.

### 12.11 Roles y permisos ⛔

Listado: `name`, cantidad de permisos, `branchScope`, `isSystem`.
Editor: selector de permisos agrupado por dominio, con checkbox por permiso — nunca texto libre.
Presets sugeridos como plantillas de partida (Propietario, Gerente, Inventario/Compras,
Bodeguero, Cajero, Auditor); no es lista cerrada.
Validación: un rol no puede quedar sin nombre ni sin permisos.
**Bloqueada** hasta extender `RoleRepository`.

### 12.12 Usuarios ⛔

La más compleja. Tabla: `name`, `email`, rol, sucursal/alcance, estado, última conexión.

Alta (R-A07/R-A08): nombre, `employeeCode`, correo laboral opcional, rol principal, sucursales
autorizadas, estado inicial.

- Con correo → invitación de un solo uso, **24 h** (R-A09).
- Sin correo → activación asistida, código temporal de un solo uso, **15 min** (R-A10).
- El administrador **nunca** ve ni define la contraseña final (R-A11). Una credencial usada o
  vencida deja la cuenta en `password_reset_required` (R-A12).

Recuperación asistida (4.9): requiere `users.credentials.reset`; genera código de 15 min; ni
gerente ni administrador conocen la nueva contraseña, solo autorizan el mecanismo.

MFA (4.12): obligatorio para roles con permisos sensibles, configurable para el resto.

Alcance de sucursal (4.17): `assigned` / `selected` / `all` en `Role.branchScope`; el formulario
cambia según la elección y escribe `User.branchId` o `User.allowedBranchIds`.

Auditoría: cada alta, cambio de rol, activación o archivado genera `AuditLog`. Siempre.

**Bloqueada** por `RoleRepository` y por la ausencia de contrato para `AuthAccount`/`MfaEnrollment`.

### 12.13 Planes y facturación SaaS ⛔ GAP

Sin entity en el modelo canónico. Propuesta a discutir, no spec cerrada:

```ts
interface SaasPlan {
  id: string;
  tenantId: string;
  planName: string;
  modulesEnabled: string[];
  billingCycle: string;
  status: string;
}
```

### 12.14 Sincronización ⛔ GAP

"Vista simulada del estado de integraciones/nodos", sin entity. Lo más barato para esta fase es
un mock estático hasta que el equipo defina algo real.

---

## 13. Flujos transversales

```text
Administración de personal
  Admin → crea rol → asigna permisos/alcance → crea usuario → asigna rol y sucursal

Proveedor
  Administración mantiene Supplier → Compras lo consulta
    → SupplierProduct define costos/unidades → una OC usa esos acuerdos

Transferencia POS (solo poseés el maestro)
  Cajero elige transferencia → cuenta bancaria habilitada (tu maestro)
    → registra boleta/referencia y monto → confirma comprobante → venta pagada
```

---

## 14. Plan de trabajo

Convención de rama: `feature/admin-<funcionalidad>` (`docs/GIT_WORKFLOW.md`), siempre desde
`development`, PR de vuelta a `development`.

| #   | Rama                                | Pantalla                  | Depende de                  |
| --- | ----------------------------------- | ------------------------- | --------------------------- |
| 1   | `feature/admin-business-config`     | Configuración del negocio | — ✅ hecha                  |
| 2   | `feature/admin-branches`            | Sucursales                | —                           |
| 3   | `chore/admin-role-contracts`        | _(contrato)_              | avisar a Andy               |
| 4   | `feature/admin-roles-permissions`   | Roles y permisos          | 3                           |
| 5   | `feature/admin-users`               | Usuarios                  | 2, 4 + contrato AuthAccount |
| 6   | `feature/admin-suppliers`           | Proveedores               | —                           |
| 7   | `feature/admin-bank-accounts`       | Cuentas bancarias         | 2                           |
| 8   | `feature/admin-ecommerce-design`    | Diseño E-commerce         | 1                           |
| 9   | `feature/admin-customers`           | Clientes                  | contrato de segmentos       |
| 10  | `feature/admin-audit-log`           | Auditoría                 | que otros emitan AuditLog   |
| 11  | `feature/admin-cash-reconciliation` | Caja                      | datos de POS                |
| 12  | `feature/admin-dashboard`           | Dashboard                 | 1-9 + `KPICard`             |
| 13  | `feature/admin-reports`             | Reportes                  | casi todos los módulos      |
| 14  | —                                   | Planes / Sincronización   | modelo sin definir          |

Antes de cada PR: `npm run lint`, `npm run build`, `git status`. Sin commit, push ni merge salvo
instrucción explícita.

---

## 15. Seeds necesarios para demo

- Un rol con permisos completos y uno limitado, para probar la matriz de permisos.
- Usuarios cubriendo `active`, `inactive`, `blocked`, `archived` en `UserStatus`, y
  `temporarily_locked`, `disabled`, `password_reset_required` en `AccountStatus`.
- Un empleado en primer acceso (invitación) y uno sin correo (activación asistida).
- Un administrador con `MfaEnrollment` habilitado.
- Al menos 2 sucursales, para probar `branchScope: "selected"`.
- Al menos 1 proveedor con historial de compras, para ver archivado en vez de borrado.
- Al menos 1 cuenta bancaria habilitada para más de una sucursal.
- `AuditLog` con datos suficientes para que la pantalla no se vea vacía.

Estado actual del seed (`src/infrastructure/mock/seeds/demoSeed.ts`): tenant `tenant-demo`
(FerrePharma Demo) con `businessCapabilities` completas; roles `role-admin`, `role-inventory`,
`role-cashier`, `role-warehouse`; la sesión demo resuelve al **cajero**
(`cajero@ferrepharma.demo`), cuyo rol no tiene permisos de administración.

---

## 16. Preguntas abiertas para el equipo

1. `RoleRepository`: confirmar que abrís vos el `chore/` con `getAll`, `create`, `update`,
   `archive`. **Ruta crítica del módulo.**
2. `AuthAccount` / `MfaEnrollment`: ¿Andy expone contrato para invitación, activación asistida y
   MFA, o la pantalla de Usuarios se recorta?
3. `Branch.schedule`: ¿se agrega o Sucursales no maneja horarios?
4. `EcommerceConfig.theme`: ¿se agrega o Diseño E-commerce va sin branding?
5. `Supplier`: ¿se extiende con contactos, términos de pago, moneda y lead time, o la pantalla se
   limita a los campos actuales? Confirmar con Melbyn que `SupplierProduct` y `SupplierCostTier`
   son de su lado.
6. `TenantRepository.update` y `CustomerRepository.update`: ¿se agregan o esas pantallas quedan de
   solo lectura?
7. `CustomerSegmentRepository`: ¿se define o se pospone la gestión de segmentos? Delimitar por
   escrito con Andy qué es "vista comercial" (tuya) y qué es "cuenta propia del cliente" (suya).
8. Caja: ¿admite ajuste con permiso superior o es 100% solo lectura?
9. Planes y facturación: ¿se define `SaasPlan`/`Subscription` o se pospone la pantalla?
10. Sincronización: ¿mock estático o estructura mínima de nodo/integración?
11. Filtro de permisos del Sidebar: ¿quién conecta `allowedPermissions` en `PrivateShell`?
