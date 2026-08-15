# Módulo `printing` — configuración de impresión

Guarda **qué se imprime y cómo**: cabecera/pie del recibo, ancho de papel, auto-impresión al cobrar,
apertura de cajón y el enrutado **categoría → estación** (`receipt`/`kitchen`/`bar`).

> ⚠️ **Aquí NO se imprime.** La impresión real y la apertura del cajón las ejecuta **el dispositivo**
> (la app de ERPlora que tiene la impresora), no el hub. Si no sale el papel, casi nunca es un
> problema de estos ajustes. Y **no hay cola, ni reintento, ni historial** de impresión.

<!-- -->

> **Module id:** `printing`. **Depende de:** nada — y nada depende de él. No emite ni escucha eventos.
> Módulo declarativo puro (SQL + Web Components), sin handler WASM.

## Documentación de usuario — [`docs/`](docs/)

Viaja **dentro** del módulo y se versiona con él: el asistente del hub (ADR-0282) la indexa por
versión instalada y cita la de TU versión, no la de la última publicada. En inglés (idioma fuente).

| Fichero | Para qué |
| ------- | -------- |
| [`docs/overview.md`](docs/overview.md) | Qué hace y qué NO hace; el vocabulario |
| [`docs/screens.md`](docs/screens.md) | Printers y Routing: configurar el recibo y enrutar categorías |
| [`docs/concepts.md`](docs/concepts.md) | Los ajustes viven en el hub, **imprimir ocurre en el dispositivo**; el recibo **no es** el documento fiscal; si hay `kitchen`, mandan SUS estaciones |
| [`docs/limits.md`](docs/limits.md) | Valores aceptados, permisos por acción y por qué «no imprime» casi nunca es de aquí |

## Ojo con la superposición

| | `printing` | `kitchen` |
| --- | ---------- | --------- |
| Concepto | categoría (string libre) → `receipt`/`kitchen`/`bar` | **estaciones reales** con `destination` (display/printer/both) y **rol de impresora** |
| Quién imprime | el dispositivo | el **shell** (`print-comanda.ts`), agrupando por rol de impresora |
| Conoce productos | no | sí (enrutado por producto) |

Con `kitchen` instalado, la impresión de cocina la gobiernan **sus** estaciones. Y el TPV (`sales`)
tiene **su propia** cabecera/pie de recibo en sus ajustes.

## Qué expone hoy

| Tipo | Nombre | Permiso |
| ---- | ------ | ------- |
| query | `printing.settings.get` | `view_settings` |
| query | `printing.routing.list` | `view_routing` |
| command | `printing.settings.update` (snapshot completo, 7 campos requeridos) | `manage_settings` |
| command | `printing.routing.set` / `.remove` | `manage_routing` |
| permiso | `printing.print` · `printing.open_drawer` (acciones del dispositivo, gateadas en el hub) | — |
| emite / escucha | — | — |

Navegación: `erp-printing-settings` («Printers») y `erp-printing-routing` («Routing»).

## Layout

```text
module.json                   # manifest (contrato técnico)
migrations/postgres/          # esquema §2.5 (hub_id + soft-delete + auditoría)
queries/*.sql                 # lecturas declarativas (:hub_id inyectado)
commands/*.sql                # escrituras declarativas
schemas/*.json                # JSON Schemas de input (draft 2020-12)
ui/                           # Web Components (Lit/Ionic/OutfitKit)
fixtures/                     # datos mock de `erplora dev` (no viajan en dist)
docs/                         # documentación de usuario + corpus del asistente
```

```sh
erplora dev printing      # previsualiza
erplora build printing    # compila los WCs
```

## Estado y trabajo abierto

El estado vive en las **Issues de este repo**, no aquí. Limitaciones documentadas en
`docs/limits.md`: sin cola/reintento/historial, la categoría del enrutado es **texto libre sin
validar**, y no hay impresión de etiquetas pese a la keyword.

Doc de arquitectura: `architecture/modules/printing.md` (cargarlo antes de tocar el módulo).
