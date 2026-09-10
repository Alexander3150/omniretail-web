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

## Diseno E-commerce

Implementado en esta rama:

- Formulario tenant-wide para habilitar la tienda, definir su nombre y configurar el acceso de
  clientes e invitados.
- Seleccion de metodos de pago y entrega basada exclusivamente en `PaymentMethod` y
  `DeliveryMethod`, con validacion previa a la normalizacion.
- Selector de sucursal predeterminada con las sucursales activas del tenant. Si la seleccion
  persistida ya no esta activa, se muestra y conserva hasta que el usuario la cambie.
- Lectura y actualizacion mediante `BusinessConfigRepository`, sin enviar `tenantId`, `createdAt`
  ni `updatedAt` en el payload de guardado.
- Enforcement de `admin.ecommerce_config.manage` dentro de los services de lectura y escritura.
- Auditoria mediante `ecommerce_config.updated` y refresco reactivo ante
  `business-config.changed`.
- Ruta privada `/administracion/diseno-ecommerce` y entrada de navegacion con el permiso nuevo.

### Contrato de integracion

Lo que esta pantalla expone al resto del sistema:

- Ruta `/administracion/diseno-ecommerce` e item `administration-ecommerce-config` en la
  navegacion de Administracion.
- Permiso `admin.ecommerce_config.manage` para leer y modificar la configuracion.
- Accion de auditoria `ecommerce_config.updated`, con `entityType: "EcommerceConfig"`.
- Refresco ante el evento compartido `business-config.changed`.

Lo que asume de la plataforma:

- `useCurrentSession()` entrega el `tenantId`, el `id` del actor y los permisos efectivos.
- `RepositoryRegistry` expone `businessConfig`, `branches` y `auditLogs`.
- La fila de `EcommerceConfig` del tenant ya existe en el seed; el contrato no ofrece `create`.

Decisiones abiertas y coordinacion:

- El branding sigue pendiente porque `EcommerceConfig` no tiene un campo `theme`. La trazabilidad
  pertenece a Configuracion del negocio y el diseño visual del storefront al modulo propietario.
- `business-config.changed` tambien se emite al cambiar capacidades; este over-refresh es
  inofensivo y el borrador local no se reemplaza cuando tiene cambios sin guardar.
- `SaveBusinessConfigService` no registra auditoria actualmente, una inconsistencia preexistente
  que debera resolverse por separado.
- `admin.ecommerce_config.manage` es un permiso nuevo. Se esperan colisiones en `permissions.ts`,
  `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con
  `feature/admin-branches`, `feature/admin-bank-accounts`, `feature/admin-suppliers` y
  `feature/admin-audit-log`; deben resolverse conservando las entradas de todas las pantallas.

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
