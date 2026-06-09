# printing

Módulo ERPlora (declarativo + Web Component Lit). Repo independiente; se desarrolla dentro de un
workspace creado con `erplora startproject`.

- `module.json` — manifest (queries/commands/navigation/permissions).
- `ui/components/erp-printing-items/erp-printing-items.ts` — el Web Component (Lit) que usa `ok-data-table`.
- `queries/`, `commands/`, `migrations/` — SQL declarativo por dialecto.
- `fixtures/` — datos mock que usa `erplora dev` para previsualizar sin backend.
- `dist/printing.esm.js` — artefacto que va en el `module.zip` (lo genera `erplora build`).

```sh
erplora dev printing      # previsualiza
erplora build printing    # compila el WC
```
