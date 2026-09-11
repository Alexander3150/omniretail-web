# OmniRetail Admin Branch Maintenance

## Cuando Usar

Para actualizar una rama `feature/admin-*` (u otra feature branch con PR abierto) contra
`development` y aplicar correcciones de code review, cuando el flujo es: sincronizar -> corregir
-> verificar -> commitear -> pushear, posiblemente varias rondas por PR.

## Encontrar La Rama De Un PR Por Numero

`gh` no esta instalado en este entorno. Si el usuario da solo el numero de PR:

1. `git remote -v` para confirmar owner/repo.
2. `WebFetch` a `https://github.com/<owner>/<repo>/pull/<numero>` pidiendo titulo y head branch.
3. Confirmar la rama existe local o remota antes de hacer checkout.

## Workflow De Sincronizacion

1. `git status --short` -- debe estar limpio antes de cambiar de rama.
2. `git fetch origin`.
3. `git checkout feature/admin-x`.
4. `git log --oneline feature/admin-x..origin/development | wc -l` -- cuantifica el atraso.
5. `git merge origin/development --no-edit`.
6. Resolver conflictos (ver abajo).
7. `grep -rln "^<<<<<<<\|^=======$\|^>>>>>>>" src/ docs/` -- debe devolver vacio antes de stagear.
8. `git add <archivos resueltos>` y commitear el merge (mensaje `merge: sync feature/admin-x with development`).
9. Correr gates (ver abajo) antes de pushear.
10. Nunca commitear, pushear ni mergear sin pedido explicito del usuario, ni siquiera despues de
    terminar un fix pedido -- confirmar cada vez.

## Conflictos Recurrentes En `administration/*`

Cada rama `feature/admin-x` agrega su propia pantalla en los mismos puntos de insercion de un
grupo fijo de archivos compartidos:

- `src/infrastructure/mock/seeds/demoSeed.ts` (permisos de `role-admin`)
- `src/modules/administration/index.ts` (barrel de paginas)
- `src/modules/administration/navigation.ts` (item del acordeon)
- `src/modules/administration/application/services/serviceHelpers.ts` (funciones `ensure*`)
- a veces `README.md` y `SCOPE.md` del modulo

**Regla:** resolver siempre por **union** (conservar ambos lados), nunca elegir uno. Un `id` de
otra pantalla que "gana" el conflicto borra una feature ya aprobada.

- `serviceHelpers.ts` con marcadores muy entrelazados (funciones de dos pantallas mezcladas dentro
  del mismo bloque): mas rapido y seguro reescribir el archivo completo con `Write` combinando
  ambos lados que editar fragmento por fragmento -- despues verificar contra los archivos que
  importan de ahi (`grep` de `from ".../serviceHelpers"`) que cada funcion esperada sigue existiendo.
- `README.md` con dos secciones agregadas en el mismo punto de anclaje: git a veces separa el
  `### Contrato de integracion` comun (texto identico en ambos lados) en un **segundo** bloque de
  conflicto aparte del titulo `## Seccion`. Hay que reconstruir cada seccion completa con su propio
  subtitulo -- no fusionar el contrato de una pantalla con el cuerpo de la otra.

## Patron De Permiso Read/Manage En `navigation.ts`

`NavigationItem.permission` es un unico string, no existe "cualquiera de estos permisos". Si una
pantalla declara `admin.x.read` + `admin.x.manage` (split de lectura/gestion):

- El item de navegacion se protege con el permiso **manage** (el que tiene la audiencia real),
  igual que Sucursales (`admin.branches.manage`, con comentario explicando por que).
- El service (`ensureCanReadX`) sigue aceptando `read` OR `manage` de forma defensiva, para un
  futuro rol de solo lectura.
- No inventar un mecanismo nuevo de implicacion permiso-por-permiso dentro de un modulo -- copiar
  el patron ya establecido, no parchear localmente.
- Pantallas con un solo permiso (sin split, ej. Caja con `admin.cash.read`) no necesitan este
  patron.

## Tenant Isolation

No confiar en ningun id que venga del cliente (`productId`, `branchId`, `orderId`, `supplierId`,
`supplierProductId`, etc.), ni siquiera si la UI ya lo filtra.

- **Orden de validacion:** comparar `tenantId` ANTES de disparar una carga costosa. Ej: en
  `GetProductEditorDataService`, buscar el producto en la lista ya filtrada por tenant antes de
  llamar a `GetProductDetailService`, no al reves.
- **Mismo mensaje para "no existe" y "de otro tenant":** nunca confirmar la existencia de un
  registro de otro tenant con un mensaje distinto.
- **Mutaciones tenant-scoped en el repository:** agregar `tenantId` como primer parametro
  explicito del metodo de escritura (precedente ya en el codigo:
  `ProductKitComponentRepository.replaceForKit(tenantId, kitProductId, ...)`), filtrar por
  `id && tenantId` antes de mutar, y solo entonces delegar. No alcanza con que las lecturas ya
  sean tenant-scoped si las mutaciones (`update`/`archive`/`setPreferred`/etc.) siguen operando por
  id global.
- Revisar TODAS las mutaciones de una entidad relacionada cuando se corrige una (ej. si se corrige
  `update`/`archive`, revisar tambien `setPreferred`, `replaceCostTiers` y cualquier otro metodo de
  escritura del mismo repository -- suelen tener el mismo hueco).

## Gates

Delegar siempre a un subagente (`fork`) -- el output es grande y no vale la pena en el contexto
principal:

```
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

- Si `tsc` falla por un `.next/types` viejo (de haber corrido el dev server en otra rama en el
  mismo working directory): correr `npx next typegen`, nunca borrar `.next` sin regenerar.
- Pedirle al subagente que lea el diff final y confirme que coincide exactamente con lo descrito
  (nada fuera de alcance, ninguna UI nueva si no se pidio).
- Warnings preexistentes y ajenos al diff no bloquean.
