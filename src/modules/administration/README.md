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

## Clientes

Implementado en esta rama:

- Directorio comercial de clientes aislado por el `tenantId` de la sesion, con busqueda por codigo,
  nombre o correo y filtro por estado.
- Permisos separados `admin.customers.read` y `admin.customers.manage`: gestionar implica lectura,
  mientras que las mutaciones exigen `manage` dentro de los services.
- Alta de registros exclusivamente comerciales mediante `CustomerRepository`; no se crea `User`,
  `AuthAccount` ni ninguna credencial.
- Edicion completa para clientes sin `userId`. Para clientes vinculados a una cuenta, el service
  ignora cambios de datos personales y aplica unicamente `status`; la UI refleja el mismo limite.
- Unicidad de codigo y correo dentro del tenant, validada sobre valores normalizados.
- Archivado comercial mediante `update({ status: CustomerStatus.archived })`, conservando el
  registro y cualquier cuenta vinculada.
- Auditoria de alta, edicion y archivado, y refresco reactivo ante `customer.changed`.
- Segmentos visibles como bloqueados porque no existe `CustomerSegmentRepository`.
- Ruta privada `/administracion/clientes` y entrada de navegacion con permiso de lectura.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta `/administracion/clientes` e item `administration-customers` en la navegacion de
  Administracion.
- Permisos nuevos `admin.customers.read` y `admin.customers.manage`.
- Acciones de auditoria `customer.created`, `customer.updated` y `customer.archived`, con
  `entityType: "Customer"`.
- Refresco reactivo ante el evento `customer.changed`.

Lo que asume de la plataforma:

- `useCurrentSession()` entrega el `tenantId`, el `id` del actor y los permisos efectivos.
- `RepositoryRegistry` expone `customers` y `auditLogs`.
- Los flujos propietarios de identidad mantienen la relacion opcional `Customer.userId`.

Decisiones abiertas y coordinacion:

- El limite entre la vista comercial de Administration y la cuenta propia del cliente debe
  acordarse por escrito con el equipo propietario de Customer/Auth. Esta implementacion es
  conservadora: si existe `userId`, el administrador solo cambia el estado comercial.
- Si un cliente comercial se auto-registra luego con el mismo correo, la reconciliacion corresponde
  al flujo de registro, no a esta pantalla.
- Los segmentos permanecen fuera de alcance hasta contar con `CustomerSegmentRepository`.
- Los permisos de clientes son nuevos. Se esperan colisiones en `permissions.ts`, `demoSeed.ts`,
  `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con `feature/admin-branches`,
  `feature/admin-bank-accounts`, `feature/admin-suppliers`, `feature/admin-audit-log` y
  `feature/admin-ecommerce-config`; deben resolverse conservando todas las entradas.

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
