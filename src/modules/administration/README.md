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

- Listado de solo lectura sobre `AuditLogRepository.getAll()`, aislado por el `tenantId` de la
  sesion y ordenado por `createdAt` descendente dentro de `GetAuditLogsService`.
- Enforcement de `admin.audit.read` dentro del service; la pantalla tambien presenta un estado sin
  acceso cuando el permiso no esta disponible.
- Busqueda libre y filtros por accion, tipo de entidad y rango de fechas, aplicados en memoria por
  la ausencia de filtros en el contrato actual.
- Paginacion en cliente con `TablePagination` y detalle en `Modal` con metadata serializada de forma
  defensiva.
- Resolucion del actor al nombre del usuario del tenant, con fallback al identificador y a
  `Sistema` cuando no existe `actorUserId`.
- Refresco manual y sincronizacion reactiva mediante el evento `audit.changed`.
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

- `AuditLogRepository` no ofrece filtros ni paginacion server-side. La implementacion actual carga
  los registros y filtra en memoria; el backend futuro debera resolver el volumen real.
- `admin.audit.read` es un permiso nuevo. Se esperan colisiones de integracion en `permissions.ts`,
  `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con
  `feature/admin-branches`, `feature/admin-bank-accounts` y `feature/admin-suppliers`; deben
  resolverse conservando las entradas de todas las pantallas.

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
