# Module Ownership

## Maria

Modulo: `storefront`.

Responsabilidad: e-commerce publico y parte privada comercial: catalogo, detalle, ofertas, carrito, checkout, pedidos, seguimiento, favoritos, resenas y garantias cuando aplique.

## Andy

Modulos: `auth`, `customer`.

Responsabilidad: login, registro, recuperacion, sesion, perfil, direcciones, metodos de pago guardados, seguridad y perfil de empleado basico.

## Jose

Modulo: `administration`.

Responsabilidad: usuarios administrativos, roles/permisos, sucursales, business config, planes/facturacion, proveedores maestro, cuentas bancarias, reportes, auditoria y configuracion.

## Melbyn

Modulos: `catalog`, `inventory`, `purchasing`, `receiving`.

Responsabilidad: producto, categorias, unidades, atributos, stock, ubicaciones, movimientos, proveedores operativos, ordenes de compra, recepciones e incidencias.

## Riquelme

Modulos: `pos`, `logistics`.

Responsabilidad: POS, caja, pagos, devoluciones, picking, packing, dispatch e historial logistico.

## Yimmy

Responsabilidad: app movil en repositorio separado.

## Cross-Module Contract Coordinators

- Product: Melbyn
- Inventory: Melbyn
- Order: Maria + Riquelme
- Sale/Payment: Riquelme
- Customer: Andy + Maria
- User/Auth: Andy + Jose
- Supplier: Jose + Melbyn
- Branch: Jose

Coordinator no significa dueno exclusivo. Los contratos comunes pertenecen al proyecto y los cambios deben coordinarse.
