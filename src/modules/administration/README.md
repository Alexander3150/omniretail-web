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
