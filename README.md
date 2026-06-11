# printing

Módulo ERPlora (declarativo + Web Components Lit). Repo independiente; se desarrolla dentro de un
workspace creado con `erplora startproject`.

- `module.json` — manifest (queries/commands/navigation/permissions).
- `ui/components/erp-printing-settings/erp-printing-settings.ts` — ajustes de impresión
  (cabecera/pie, ancho de papel, auto-print/auto-cajón) + impresoras de red detectadas por el Bridge.
- `ui/components/erp-printing-routing/erp-printing-routing.ts` — enrutado categoría→estación
  (recibo/cocina/barra) con `ok-data-table`.
- `queries/`, `commands/`, `migrations/` — SQL declarativo por dialecto.
- `schemas/` — JSON Schemas de validación de los payloads de los commands.
- `fixtures/` — datos mock que usa `erplora dev` para previsualizar sin backend.
- `dist/printing.esm.js` — artefacto que va en el `module.zip` (lo genera `erplora build`).

```sh
erplora dev printing      # previsualiza
erplora build printing    # compila los WCs
```
