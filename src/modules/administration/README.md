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

## Sucursales

Implementado en esta rama:

- Listado aislado por el `tenantId` de la sesion y mapeado a un DTO propio del modulo.
- Alta, edicion y archivado mediante services separados; archivar cambia el estado a `archived`
  y conserva el registro y sus referencias.
- Enforcement de lectura en `GetBranchesService`: acepta `admin.branches.read` o
  `admin.branches.manage`. Las mutaciones exigen `admin.branches.manage` dentro del service.
- La UI distingue sin acceso, solo lectura y gestion completa según esos permisos.
- Auditoria obligatoria en alta, edicion y archivado mediante `AuditLogRepository`.
- Validacion del dato recibido antes de normalizar codigo, nombre y campos opcionales.
- Sincronizacion de la lista y del selector activo mediante el evento `branch.changed` que ya
  emite `MockBranchRepository`.
- Tabla con `DataTable`, formulario en `Modal` y estados resueltos mediante `StatusBadge`.
- Ruta privada `/administracion/sucursales` y entrada de navegacion con
  `admin.branches.read`.

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
  protegido por `admin.branches.read`.
- Permisos `admin.branches.read` y `admin.branches.manage`, declarados en `permissions.ts` y
  asignados a `role-admin` en el seed demo.
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
- Orden definitivo del item "Sucursales" dentro del grupo "Administracion" cuando aterricen las
  demas pantallas del modulo.
- Bloquear el cambio de `type` de una sucursal con inventario o usuarios asignados: es una regla
  de dominio cross-modulo y debe acordarse antes de implementarla.
- La sesion demo esta fijada a un cajero; recorrer la pantalla en la demo requiere un switcher de
  rol o de usuario, que es responsabilidad del shell/plataforma.

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
