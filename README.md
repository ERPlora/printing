# Módulo `printing` — configuración de impresión

Guarda **qué se imprime y cómo**: cabecera/pie del recibo, ancho de papel, auto-impresión al cobrar
y apertura de cajón.

> 🪦 **El enrutado categoría → estación se RETIRÓ** (printing#25). Existió una pestaña «Routing» con
> su tabla, su query y sus dos commands, y **nadie leía nada de eso** desde ADR-0144. Enrutar por
> categoría se hace en `kitchen` → **Estaciones**, que es el módulo dueño de las estaciones y al que
> la categoría de la línea le llega de verdad (sales#12, verificado en kitchen#32). La tabla
> `printing_routing` se conserva (no se destruye configuración del comerciante) pero ya no es
> alcanzable.

> ⚠️ **Aquí NO se imprime.** La impresión real y la apertura del cajón las ejecuta **el dispositivo**
> (la app de ERPlora que tiene la impresora), no el hub. Si no sale el papel, casi nunca es un
> problema de estos ajustes. La **cola** de impresión vive en el hub (ADR-0196 §6) y este módulo
> la alimenta solo por una puerta: el command `printing.jobs.create` (ver abajo).

<!-- -->

> **Module id:** `printing`. **Depende de:** nada — y nada depende de él. No escucha eventos; **emite
> uno**: `printing.print.due` (la intención de impresión que consume el listener-host `host.print`
> del runtime — ADR-0349, hub#957). Módulo declarativo puro (SQL + Web Components), sin handler WASM.
> Pide la capability **`printer`**: sin concederla, ningún trabajo llega a la cola.

## Documentación de usuario — [`docs/`](docs/)

Viaja **dentro** del módulo y se versiona con él: el asistente del hub (ADR-0282) la indexa por
versión instalada y cita la de TU versión, no la de la última publicada. En inglés (idioma fuente).

| Fichero | Para qué |
| ------- | -------- |
| [`docs/overview.md`](docs/overview.md) | Qué hace y qué NO hace; el vocabulario |
| [`docs/screens.md`](docs/screens.md) | Printers: configurar el recibo y asignar impresora |
| [`docs/concepts.md`](docs/concepts.md) | Los ajustes viven en el hub, **imprimir ocurre en el dispositivo**; el recibo **no es** el documento fiscal; **este módulo no enruta nada** — eso es `kitchen` |
| [`docs/limits.md`](docs/limits.md) | Valores aceptados, permisos por acción y por qué «no imprime» casi nunca es de aquí |

## Ya no hay superposición

Había dos mecanismos de enrutado y solo uno funcionaba. Desde printing#25 queda uno:

| | `kitchen` (vivo) | `printing` (retirado en #25) |
| --- | ---------------- | ---------------------------- |
| Concepto | **estaciones reales** con `destination` (display/printer/both) y **rol de impresora** | categoría (string libre) → `receipt`/`kitchen`/`bar` |
| Conoce productos | sí — estación explícita → producto → **categoría** | no |
| Quién imprime | el **shell** (`print-comanda.ts`), agrupando por rol de impresora | nadie. Ese era el problema |

Y el TPV (`sales`) tiene **su propia** cabecera/pie de recibo en sus ajustes.

## Qué expone hoy

| Tipo | Nombre | Permiso |
| ---- | ------ | ------- |
| query | `printing.settings.get` | `view_settings` |
| command | `printing.settings.update` (snapshot completo, 7 campos requeridos) | `manage_settings` |
| command | `printing.jobs.create` — `{jobId, documentType, document, role?, format?}` → registra la petición y **emite `printing.print.due`**; el runtime la encola en `_print_queue` (idempotente por `jobId`). Es la puerta por la que un **flujo** (step `command`) o cualquier módulo saca papel | `print` |
| permiso | `printing.print` · `printing.open_drawer` (acciones del dispositivo, gateadas en el hub) | — |
| capability | `printer` — la exige `deliver_host_print` (declarada **y** concedida) antes de encolar | — |
| emite | `printing.print.due` (`events.emits`; declarado ANTES de que nadie lo emita — regla hub#240/2b) | — |
| escucha | — | — |

`printing.job.printed` / `printing.job.failed` **no se declaran**: el desenlace lo conoce el runtime
(`print_ws.rs`/`print_drain.rs`) y hoy no tiene puente hacia los eventos de este módulo; declarar un
evento que nadie emite es un flujo que nunca se dispara.

Navegación: `erp-printing-settings` («Printers»). Y nada más — `erp-printing-routing` se retiró
en printing#25.

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
