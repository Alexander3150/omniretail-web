# storefront

Responsable: Maria

## Territorio del modulo

Este modulo desarrolla su funcionalidad propia sin duplicar contratos compartidos.

## Contracts que consume

ProductRepository, InventoryRepository, OrderRepository, OrderPaymentConfirmationRepository, CustomerRepository

## Reglas

- No duplicar entities de `core/`.
- No acceder directamente a LocalStorage.
- Usar repositories desde `RepositoryProvider`.
- Usar `shared/` para componentes globales.
- Crear DTO, Mappers y Services propios dentro del modulo cuando empiece cada feature.
- El checkout con tarjeta simulada crea Order/Payment pending y usa el boundary de confirmacion para aprobar, confirmar y reservar atomicamente.

## Estructura futura

```text
storefront/
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
