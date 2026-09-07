# Guia de contribucion

1. `main` debe permanecer estable.

2. Cada funcionalidad debe desarrollarse en una rama `feature/*`.

Ejemplos:

- `feature/auth-login`
- `feature/storefront-home`
- `feature/inventory-stock`
- `feature/purchasing-orders`
- `feature/pos-terminal`
- `feature/logistics-picking`

3. No utilizar ramas gigantes llamadas `maria`, `andy`, `jose`, `melbyn` o `riquelme`.

4. Los PR deben ser pequenos y representar una funcionalidad concreta.

5. Antes de crear PR:

- actualizar la rama con `main`
- ejecutar `npm run lint`
- ejecutar `npm run build`
- probar funcionalmente la feature

6. Las carpetas `core/`, `infrastructure/`, `shared/`, `config/` y `styles/` son zonas comunes. No deben modificarse sin coordinacion cuando el cambio afecte a mas de un modulo.

7. No duplicar entities.

Ejemplo incorrecto:

- `modules/storefront/Product.ts`
- `modules/inventory/Product.ts`
- `modules/pos/Product.ts`

Posteriormente existira un unico contrato oficial:

- `core/entities/Product.ts`

8. No acceder directamente a LocalStorage desde componentes o paginas. Posteriormente se accedera mediante Repository / Infrastructure.

9. No crear componentes visuales globales dentro de modulos.

10. Si un componente solamente pertenece a un modulo, debe permanecer dentro de ese modulo.
