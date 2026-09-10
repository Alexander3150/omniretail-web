# administration

Responsable: Jose

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

El alcance completo del modulo, los contratos verificados, los bloqueantes y el orden de trabajo
estan en `SCOPE.md`.

## Contracts que consume

UserRepository, RoleRepository, BranchRepository, BusinessConfigRepository, TenantRepository, SupplierRepository, BankAccountRepository, CustomerRepository, AuditLogRepository, SalesRepository, OrderRepository, InventoryRepository, ReceiptRepository, IncidentTypeRepository

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

## Dashboard

La ruta `/administracion/dashboard` expone un resumen ejecutivo de solo lectura y se integra en la
navegación como `administration-dashboard`. Requiere el permiso nuevo
`admin.dashboard.read` y se refresca ante `sale.changed`, `order.changed`, `stock.changed` y
`receipt.changed`.

La pantalla agrega ventas del día y del mes calendario local, alertas simplificadas de stock,
pedidos pendientes y las cinco incidencias de recepción más recientes. No expone operaciones de
escritura. Esta rama también agrega `KPICard` como componente shared puramente presentacional;
su API acepta etiqueta, valor, texto secundario, tono y estado de carga.

### Contrato de integracion

La feature asume:

- `useCurrentSession()` para resolver `tenantId`, permisos y estado de sesión.
- `RepositoryRegistry.sales`, `orders`, `inventory`, `receipts` e `incidentTypes` con sus
  contratos vigentes.
- `formatCurrency` y `formatDate` de `shared/utils` para presentar montos y fechas.

Decisiones y coordinación:

- Lee contratos compartidos de Riquelme (`sales`), María (`orders`) y Melbyn (`inventory`,
  `receipts`). Si esos contratos cambian, esta agregación debe revisarse.
- Los umbrales del KPI de stock son un indicador simplificado. La regla autoritativa y la lista
  oficial de alertas pertenecen al módulo `inventory`.
- `KPICard` es un componente shared nuevo y presentacional; coordinar su evolución si otro equipo
  necesita ampliar la API.
- Con el seed actual, ventas de hoy y del mes muestran cero porque todos los `createdAt` son
  `2026-01-01T12:00:00.000Z`. No se reemplaza el calendario real por una ventana móvil.
- `admin.dashboard.read` es un permiso nuevo. Se esperan colisiones en `permissions.ts`,
  `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md` con las ramas
  previas de administration; al integrarlas deben conservarse todas las entradas.

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
