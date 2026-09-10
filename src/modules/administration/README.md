# administration

Responsable: Jose

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

El alcance completo del modulo, los contratos verificados, los bloqueantes y el orden de trabajo
estan en `SCOPE.md`.

## Contracts que consume

UserRepository, RoleRepository, BranchRepository, BusinessConfigRepository, TenantRepository, SupplierRepository, BankAccountRepository, CustomerRepository, AuditLogRepository, SalesRepository, PurchaseOrderRepository, InventoryRepository, PaymentRepository, ProductRepository

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

## Reportes

La ruta `/administracion/reportes` expone reportes agregados de ventas, compras, movimientos de
inventario y pagos. Se integra en la navegación como `administration-reports`, exige
`admin.reports.read` para consultar y `admin.reports.export` para descargar el resultado visible
como CSV. Se refresca ante `sale.changed`, `purchase-order.changed`, `inventory.changed` y
`payment.changed`.

La pantalla solo consulta contratos compartidos y agrega sus resultados en memoria. No persiste
reportes, no modifica las fuentes y no escribe auditoría. El helper CSV vive dentro de
`administration`; no se promovió a `shared` porque esta entrega no establece una API transversal.

### Contrato de integracion

La feature asume:

- `useCurrentSession()` para resolver `tenantId`, permisos y estado de sesión.
- `RepositoryRegistry.sales`, `purchaseOrders`, `inventory`, `payments`, `branches`, `suppliers`
  y `products` con sus contratos vigentes.
- `formatCurrency` y `formatDate` de `shared/utils` para presentar montos y fechas.

Decisiones y coordinación:

- Lee contratos de Riquelme (`sales`, `payments`) y Melbyn (`purchaseOrders`, `inventory`,
  `suppliers`, `products`). Si cambian, esta agregación debe revisarse.
- La generación y descarga de CSV permanecen como helpers module-local.
- La mayoría de fechas del seed son `2026-01-01`; hay que ajustar el rango de fechas para ver esos
  datos en la demo.
- `admin.reports.read` y `admin.reports.export` son permisos nuevos. Se esperan colisiones en
  `permissions.ts`, `demoSeed.ts`, `navigation.ts`, `serviceHelpers.ts`, `README.md` y `SCOPE.md`
  con las ocho ramas previas de administration; al integrarlas deben conservarse todas las
  entradas.

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
