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

## Proveedores

Implementado en esta rama:

- Listado del maestro de proveedores aislado por el `tenantId` de la sesion.
- Alta, edicion y archivado mediante services separados sobre `SupplierRepository`; el archivado
  usa el metodo de contrato `archive(id)` y conserva el historial.
- Enforcement de `admin.suppliers.manage` dentro de todos los services, tanto para leer como para
  mutar.
- Validacion del dato recibido antes de normalizarlo: nombre obligatorio, estado valido y formato
  de correo; los textos opcionales vacios se convierten a `undefined` y el correo a minusculas.
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
