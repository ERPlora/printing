# WORKFLOW — Impresión

Prefijo: PRINTING
Alcance MVP: nucleo

> Contrato de comportamiento del módulo (pm#620, pm#621). Se lee antes de tocar el código y se
> actualiza en la misma PR que cambie un comportamiento. Contrastado contra `origin/main` de
> `printing` v0.1.30 y `origin/develop` del hub el 05/10/2026. El detalle técnico vive en
> `architecture/modules/printing.md` y `architecture/hub/print-queue.md`.

## Para qué sirve y para quién

Impresión es la pantalla donde el negocio ve **si el papel está saliendo** y deja las impresoras
listas: dar de alta una impresora, decir para qué sirve (tique, cocina, barra, etiquetas), probarla,
elegir si el tique sale solo al cobrar y si el cajón se abre con él, y sacar del atasco un trabajo que
no salió. La usan el **administrador** y el **responsable** (montan y arreglan), y el **empleado** de
caja (consulta el estado y reimprime desde Ventas). Sirve a los dos negocios: la peluquería y el
restaurante imprimen el tique y las etiquetas igual; la comanda de cocina es solo del restaurante y la cuenta
(precuenta) sale del TPV común, con o sin mesa.

**Qué es del módulo y qué es del hub.** El módulo es pequeño: una pantalla («Impresoras»), una
consulta de ajustes, dos comandos (guardar ajustes, pedir una impresión) y un aviso
(`printing.print.due`). **No imprime.** Todo lo demás vive fuera:

| Pieza | Dónde vive |
|---|---|
| Cola de trabajos (`pendiente → imprimiendo → hecho / muerto / retirado`, 5 entregas, 90 s de arrendamiento, deduplicación por `jobId` solo en esta cola) | Hub, `crates/runtime/src/print_queue.rs` |
| Qué impresora de qué documento (mapa documento → estación, estaciones `receipt`, `kitchen`, `bar`, `label`) | Hub, `print_routes.rs` y `print_stations.rs` |
| Dispositivo que saca el papel (se da de alta solo como «host» de los roles de sus impresoras y reclama trabajos) | App instalada, `apps/web/src/lib/print-host*.ts`, `print-drain.ts` |
| Envío ESC/POS por red (puerto 9100), cola USB del sistema, Bluetooth (solo Android), página de prueba y cajón | Hub, `crates/peripherals`, y la app `apps/tauri` |
| Imprimir el tique al cobrar y abrir el cajón | Hub (shell), `apps/web/src/lib/print-on-sale.ts` |
| Imprimir la comanda al disparar el pedido | Hub (shell), `apps/web/src/lib/print-comanda.ts` |
| Qué lleva el tique (cabecera, pie, número fiscal, QR) | `sales` (el visor `erp-sales-document` y `document-mappers.ts`) |

La cola y los dispositivos que imprimen los describe el `WORKFLOW.md` del hub en `workflow/impresion.md` (HUB-F190 a HUB-F207); el envío al papel, `crates/peripherals/WORKFLOW.md` (HUB_PERIPHERALS) y `apps/tauri/WORKFLOW.md` (HUB_APP).
Imprimir el tique al cobrar y la comanda al disparar el pedido lo describe `apps/web/workflow/avisos-e-impresion.md` del hub (HUB_SHELL-F70 a HUB_SHELL-F77).

## Referencia adoptada

Ya contrastada en `.claude/agents/qa-hub-restaurant.md` §2 (10/08/2026) y su sección de hardware
(§16); no se rehace. De ella se adopta solo esto:

- [Square — recibos, pedidos y etiquetas por impresora](https://squareup.com/help/us/en/article/5530-set-up-a-printer)
  y [Toast — impresión y estaciones de cocina](https://doc.toasttab.com/doc/platformguide/platformKDSWorkflowUsingCourses.html):
  cada documento sale por la impresora de su estación (recibos, cocina, barra, etiquetas); la
  comanda no se desvía a la impresora de tiques.
- [Toast — modo offline](https://doc.toasttab.com/doc/platformguide/platformOfflineMode.html) y
  [Square — modo offline](https://squareup.com/help/es/es/article/7777-process-card-payments-with-offline-mode):
  la idea de que un trabajo que no puede salir **espera** y se avisa; lo que ERPlora hace hoy, y dónde no
  avisa, está en F07, F09, F10 y F12.
- [AEAT — SIF y VERI*FACTU](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu.html):
  el tique lleva el QR de cotejo; la reimpresión es copia (guion `L-04`, `L-05`).
- Cuenta de la mesa: papel no fiscal, sin serie ni QR y con aviso de que no es factura (guion `R-08`).

## Antes de empezar

- **Instalar Impresión** en el negocio. Sin el módulo, el tique no sale solo al cobrar ni se abre el
  cajón: el shell lee los ajustes de Impresión y, si no responden, no hace nada. La comanda de cocina
  **no** depende de este módulo (la imprime el shell sin leer sus ajustes).
- **Conceder el permiso de impresora** al módulo (Ajustes › Permisos): lo exige pedir impresiones por
  el asistente o un flujo (PRINTING-F16) y reintentar o retirar trabajos (PRINTING-F14).
- **La app de ERPlora instalada** en el dispositivo que está en la red de la impresora y abierta en
  ese puesto. Desde un navegador la pantalla dice que no llega a las impresoras y no se puede dar de
  alta ni probar ninguna.
- Una **impresora térmica** (ESC/POS) encendida y en la misma red; con otra red o sin búsqueda
  posible, la IP que sale en su hoja de configuración.

Configuración inicial, paso a paso:

1. Abre **Impresión → Impresoras** desde la app instalada y espera a que acabe «Escaneando…»
   (PRINTING-F02). Si no aparece, añádela por IP (PRINTING-F03).
2. A cada impresora asígnale su función: «Recibo» para la caja, «Cocina» y «Barra» para las
   comandas, «Etiqueta» para las etiquetas (PRINTING-F04).
3. Pulsa «Probar» en cada una y comprueba que sale la hoja (PRINTING-F05).
4. En «Ajustes del ticket» decide si el tique sale al cobrar y si se abre el cajón, y pulsa «Guardar
   ajustes» (PRINTING-F06).
5. Escribe la cabecera y el pie del tique en los ajustes de Ventas, no aquí (PRINTING-F15).
6. Cobra una venta de prueba y comprueba el papel, el cajón y que la cola queda «Todo al día»
   (PRINTING-F07, PRINTING-F13).

## Pantallas

### Impresoras
Menú **Impresión → Impresoras** (la entrada se llama «Impresoras»; es la única del módulo y la ve
cualquiera que tenga el módulo, sin filtro de permiso en el menú). Título «Impresoras» y la frase
«Configura la impresión de tickets y las impresoras encontradas en esta red.». Debajo, tres zonas en
este orden (desde la lectura de la cola se pintan solo las funciones con algún dispositivo dado de alta o
trabajos esperando: un negocio nuevo no ve ninguna tarjeta; si un refresco falla, lo anterior sigue a la
vista):

- **Cola de impresión**, con el botón «Refrescar» («Refrescando…» mientras lee). Se vuelve a leer sola
  cada 30 segundos mientras la pestaña está visible. Pinta:
  - un aviso naranja por cada función con trabajos esperando, sin ningún dispositivo conectado y
    con al menos un minuto de espera: «N trabajos de impresión de Cocina llevan 3 min esperando.»
    (o «1 trabajo … lleva …») seguido de la causa: si el dispositivo ya es la app instalada, «Ningún
    dispositivo cubre todavía este rol: asigna este rol a una impresora de la lista de abajo y este
    dispositivo lo imprimirá.»; si es un navegador, «Ningún dispositivo de este rol está conectado:
    instala la app de ERPlora en el dispositivo conectado a la impresora y abre tu negocio desde ahí.»;
  - una tarjeta por cada función que tenga algún dispositivo o trabajos (Recibo, Cocina, Barra, Etiqueta) con su estado «Listo», «En cola, sin
    impresora» o «Sin impresora conectada», «En cola: N · el más antiguo lleva 3 min» y «Imprime desde:
    Caja 1.» (o «Imprime desde N dispositivos.»);
  - cada trabajo atascado o en curso como «Recibo T-000123» (o «Recibo · 26/9/26, 23:05» si el
    documento no trae número) con su estado «Pendiente», «Imprimiendo» o «Muerto», la estación, «esperando 3 min»,
    «Último error: …» y «intentos: N»;
  - para quien administra el hub, los botones «Reintentar» y «Descartar» de cada trabajo, y debajo
    «Retirados recientemente» (los últimos 20, con «Retirado por Ana desde printing · fecha» y «Motivo: …»);
  - con la cola vacía: «Todo al día: la cola está vacía y hay N dispositivos conectados.» (o «…1
    dispositivo conectado.»), o, sin ningún dispositivo, «Ahora mismo no hay nada en cola. No hay ningún
    dispositivo de impresión conectado: los trabajos nuevos quedarán en la cola hasta que uno se
    conecte.»;
  - error de lectura: «No se pudo leer la cola de impresión.» y, entre paréntesis, el código. Mientras
    carga la primera vez no pinta nada de la cola.
- **Ajustes del ticket**: la nota «El encabezado y el pie del tique forman parte de los ajustes de
  Ventas, que es de donde sale el tique.» y el enlace «Abrir los ajustes del tique» (solo si Ventas está
  instalado y responde); si quedó texto antiguo de cabecera o pie, el recuadro «Esto lo escribiste aquí
  antes de que el tique pasara a los ajustes de Ventas, así que no sale en ningún papel. Llévalo allí
  para usarlo:» con el texto y el botón «Llevarlo a los ajustes del tique»; después, «Ancho de papel»
  (80 mm o 58 mm), el interruptor «Imprimir ticket al cobrar», el interruptor «Abrir cajón al cobrar»,
  el botón «Guardar ajustes» («Guardando…») y «✓ Guardado». Si no se pueden leer los ajustes, debajo del botón sale «No se pudieron cargar los ajustes»
  (o el mensaje del servidor). No hay indicador de carga: hasta que
  llegan los ajustes se ven los de fábrica (80 mm, tique al cobrar encendido, cajón apagado).
- **Impresoras en la red**, con «Re-escanear» («Escaneando…»). Dice «Este dispositivo puede llegar a
  las impresoras · vX.Y.Z.» o, en un navegador, «Desde el navegador, este dispositivo no puede llegar a
  las impresoras. Instala la app de ERPlora en el dispositivo conectado a la impresora y abre tu negocio
  desde ahí.» (en rojo). Vacía: «No se encontraron impresoras de red (puerto 9100) en esta subred.».
  Cada impresora es una tarjeta con su nombre, su estado («Lista», «Parada», «Desconocido»), su
  identificador, el desplegable «Rol» (Recibo, Cocina, Barra, Etiqueta) y «Probar». Al final, «Añadir
  impresora por IP» (solo en la app instalada).

Los errores del hardware (escaneo, rol, prueba) salen en rojo encima de la lista con el mensaje tal como
llega (con una impresora de red, la prueba no da error si la impresora no contesta: F05; si el sistema niega
el permiso de red local, sale «ERPlora no ha podido buscar en esta red: el sistema no le ha dado permiso a la app…», frase que pone el shell del hub); si no llega mensaje, «Error al escanear», «No se pudo asignar el rol» o «Falló la impresión de
prueba». Los fallos de guardar ajustes salen debajo del botón: el mensaje del servidor tal cual, o «No
se pudo guardar». No hay estado «cargando» propio de los ajustes (la clave «Cargando…» existe y la
pantalla no la usa).

## Qué comparten los verticales

| Pieza compartida | Flujos que la usan |
|---|---|
| Pantalla Impresoras: alta, función y prueba de cada impresora | PRINTING-F02, PRINTING-F03, PRINTING-F04, PRINTING-F05 |
| Ajustes del ticket (ancho, tique al cobrar, cajón al cobrar) | PRINTING-F06, PRINTING-F07, PRINTING-F13 |
| La cola de impresión y su recuperación (reintentar, descartar) | PRINTING-F01, PRINTING-F14 |
| La puerta de impresión del hub (`erplora.print`): impresora del rol, si no cola, si no aviso | PRINTING-F07, PRINTING-F08, PRINTING-F09, PRINTING-F10, PRINTING-F12 |
| Función «Recibo» (tique, factura, cuenta de mesa, cierre de caja) | PRINTING-F07, PRINTING-F08, PRINTING-F09, PRINTING-F17 |

Las `Vertical:` de cada flujo dicen cuál se rompe al tocarlo: tocar uno `comun` afecta a peluquería y a
restaurante; los `restaurante` (PRINTING-F10, PRINTING-F11) no deben afectar a
peluquería.

## Flujos

El detalle de cada flujo (pasos, datos, fallos, implicados y QA) vive en `workflow/`, con la misma
gramática y el mismo prefijo. Huecos (`parcial`, `no hecho`): el porqué está en la línea `Estado:`.

| ID | Flujo | Estado | Fichero |
|---|---|---|---|
| PRINTING-F01 | Ver cómo va la impresión | hecho | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F02 | Encontrar y dar de alta una impresora de la red | parcial | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F03 | Añadir una impresora por su IP | hecho | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F04 | Asignar qué sale por cada impresora | parcial | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F05 | Hacer una prueba de impresión | parcial | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F06 | Elegir cómo imprime el negocio | parcial | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F07 | Imprimir el tique al cobrar | parcial | [workflow/documentos.md](workflow/documentos.md) |
| PRINTING-F08 | Reimprimir un tique o una factura | parcial | [workflow/documentos.md](workflow/documentos.md) |
| PRINTING-F09 | Imprimir la cuenta de la mesa | parcial | [workflow/documentos.md](workflow/documentos.md) |
| PRINTING-F10 | Imprimir la comanda en cocina y barra | parcial | [workflow/cocina-y-cola.md](workflow/cocina-y-cola.md) |
| PRINTING-F11 | Reimprimir una comanda | no hecho | [workflow/cocina-y-cola.md](workflow/cocina-y-cola.md) |
| PRINTING-F12 | Imprimir la etiqueta de un código de barras | parcial | [workflow/documentos.md](workflow/documentos.md) |
| PRINTING-F13 | Abrir el cajón al cobrar | parcial | [workflow/documentos.md](workflow/documentos.md) |
| PRINTING-F14 | Sacar del atasco un trabajo de impresión | hecho | [workflow/cocina-y-cola.md](workflow/cocina-y-cola.md) |
| PRINTING-F15 | Llevar el texto antiguo del tique a Ventas | hecho | [workflow/impresoras.md](workflow/impresoras.md) |
| PRINTING-F16 | Mandar imprimir desde el asistente o un flujo | parcial | [workflow/cocina-y-cola.md](workflow/cocina-y-cola.md) |
| PRINTING-F17 | Imprimir el cierre de caja | no hecho | [workflow/documentos.md](workflow/documentos.md) |

## Cobertura contra la referencia

| Elemento de la referencia | Estado | Flujo |
|---|---|---|
| Buscar impresoras de red y darlas de alta | hecho | F02 |
| Añadir una impresora por IP | hecho | F03 |
| Impresora de red y Bluetooth emparejada (Android) | hecho | F02, F03 |
| Impresora USB (ordenador) | parcial: sale en la lista y recibe la hoja de prueba; no recibe tique, comanda ni cola | F02 |
| Una función por impresora (recibos, cocina, barra, etiquetas) | hecho | F04 |
| Qué documento sale por qué función | parcial: mapa del hub sin pantalla | F04 |
| Quitar la función de una impresora | no hecho | F04 |
| Hoja de prueba | parcial: con impresora de red apagada no da error | F05 |
| Tique automático al cobrar con interruptor por venta | hecho; impresora de red apagada, sin aviso | F06, F07 |
| Ancho de papel (58/80 mm) | parcial: se guarda y no cambia el papel | F06 |
| Tique con QR fiscal y leyenda | hecho (lo pone Ventas) | F07 |
| Reimpresión como duplicado | hecho desde Ventas; desde Facturas sin marca (y, en la app instalada, por la térmica) | F08 |
| Cuenta no fiscal (de mesa o de cliente) | parcial: no avisa si espera en cola sin impresora; impresa directa, cada pulsación saca papel | F09 |
| Comanda automática por estación | parcial: impresora de red apagada, sin aviso | F10 |
| Reimprimir la comanda | no hecho | F11 |
| Etiqueta de código de barras | parcial: sin impresora «Etiqueta», espera sin aviso | F12 |
| Cajón al cobrar | hecho para cualquier pago; solo efectivo no existe | F13 |
| Apertura manual del cajón («sin venta») con permiso y registro | no hecho | F13 |
| Aviso visible cuando el papel no sale | parcial: avisa si no hay impresora ni cola, si espera sin nadie que lo saque o si no se pudo componer; no avisa si la impresora de red del dispositivo está apagada, ni en cuenta de mesa en cola, etiqueta en cola y cajón | F07, F09, F10, F12, F13 |
| Cola con recuperación (reintentar, descartar con motivo y sello) | hecho | F14 |
| Cobertura por función («nadie imprime cocina») | hecho | F01 |
| Cierre de caja impreso | no hecho | F17 |
| Albarán y documento genérico | sin productor en `origin/main` | F16 |
| Impresión desde el asistente o un flujo | parcial | F16 |
| Dar de alta el dispositivo como impresor del negocio | hecho (automático al asignar función) | F04 |

## Datos: de quién es cada dato

- **Propios del módulo** (en la base del negocio, una fila por hub): los ajustes (ancho de papel, tique
  al cobrar, cajón al cobrar, y las dos columnas heredadas de cabecera y pie que nada imprime), el
  registro de peticiones de impresión (`printing_jobs`: identificador, tipo de documento, función y
  papel pedidos) y una tabla de enrutado retirada (`printing_routing`) que se conserva sin ninguna
  consulta ni comando que la alcance.
- **Del hub**: la cola de trabajos con el documento completo, las estaciones, el mapa documento →
  estación, los «hosts» de impresión y su latido. El módulo solo los lee por las consultas del hub
  (`hub.print.coverage`, `hub.print.jobs`) y mueve un trabajo con las dos acciones del SDK
  (reintentar, descartar); nunca toca la tabla de la cola.
- **De la app del dispositivo**: las impresoras encontradas o añadidas y la función de cada una; viven
  en el registro de la app de ese dispositivo, no en el hub.
- **De Ventas**: la cabecera y el pie del tique, el nombre fiscal del negocio y el contenido del
  tique; el módulo los lee con consultas opcionales (si Ventas no está, la pantalla sigue) y solo
  escribe en Ventas al trasladar el texto antiguo.
- **Datos personales** (inventario RGPD):
  - ajustes, peticiones de impresión y la tabla de enrutado retirada: solo qué empleado creó y cambió
    cada fila;
  - cabecera y pie heredados de los ajustes: texto libre del negocio (nombre y dirección), no de un
    cliente;
  - el aviso `printing.print.due` y la cola del hub llevan el **documento entero** que se imprime (un
    tique o una factura con el nombre, el NIF o la dirección del cliente, o la comanda con la mesa y el
    camarero): no se guarda en el módulo, vive en la cola del hub y en el registro de avisos del hub.
    Los trabajos de la cola, con el documento entero, se conservan sin límite y el borrado RGPD de un
    cliente no los toca; el aviso `printing.print.due` se borra a los 90 días;
  - la cola del hub guarda además, por trabajo retirado o reintentado, quién lo hizo (solo el
    identificador de la persona; el nombre se resuelve al leer) y el motivo escrito a mano, que puede
    contener datos personales;
  - el hub guarda también qué empleado dio de alta cada dispositivo de impresión y el nombre del
    dispositivo.

## Reglas que no se rompen

- **Aislamiento**: toda lectura y escritura del módulo va con el hub; el identificador de trabajo es
  único por hub (el mismo `jobId` en dos hubs son dos trabajos).
- **La cola del hub ignora un `jobId` repetido** (por hub). Es lo único que impide un duplicado: la
  impresión directa del dispositivo no deduplica, y un dispositivo que imprime y se cae antes de confirmar
  hace que el trabajo salga dos veces (la cola entrega «al menos una vez»).
- **Valores de los ajustes**: ancho 80 o 58, y los tres interruptores 0 o 1; el esquema los exige y los
  cuatro campos son obligatorios en cada guardado. El guardado no escribe nunca la cabecera ni el pie
  (el texto antiguo sobrevive hasta que se traslada a Ventas).
- **Permisos**: ver los ajustes exige ver ajustes, guardarlos exige gestionarlos, pedir una impresión
  exige imprimir; el empleado puede ver e imprimir, y al guardar ajustes la caja le pide la aprobación (PIN)
  del responsable. Reintentar y descartar exigen ser
  administrador del hub y que el módulo tenga concedido el permiso de impresora. El servidor lo aplica
  aunque la pantalla enseñe el control.
- **Permiso de impresora del módulo**: sin él concedido, un trabajo pedido por el asistente o un flujo no
  llega a la cola: queda en Sistema › Eventos caídos y se encola solo al conceder el permiso.
- **Fiscal**: el módulo no imprime ni inventa nada fiscal. El papel del cobro lo compone Ventas con la
  factura y el registro VeriFactu; la cuenta de la mesa se construye sin número, sin QR y sin pago, y
  con aviso de que no es una factura.
- **Una venta o una comanda no se caen por la impresión**: el cobro y el disparo del pedido siguen aunque
  el papel falle (el papel sí puede perderse sin aviso: F07, F10).
- **Solo imprime la caja que cobró o disparó**: con varias cajas abiertas, solo imprime la que cobró o
  disparó (el hub marca qué pestaña lo hizo).
- **Nada se borra de la cola**: reintentar y descartar sellan quién, cuándo y por qué; un trabajo
  retirado queda en el historial.

## Lo que NO hace, a propósito

- No imprime ni abre el cajón: lo hace el dispositivo con la app instalada. Un navegador no llega a las
  impresoras.
- No enruta por categoría de producto (se retiró en printing#25; las estaciones de cocina y su función de
  impresora viven en Cocina).
- No escribe la cabecera ni el pie del tique: son de Ventas.
- No guarda historial de lo que salió (la lista de la pantalla solo enseña lo pendiente, lo que se
  imprime, lo muerto y lo retirado).
- No tiene página de prueba del cajón ni un botón de abrirlo a mano.
- No imprime el cierre de caja, el albarán ni el documento genérico (el hub sabe pintarlos, ningún
  módulo los pide).
- No reimprime comandas.
- No emite aviso de «impreso» ni de «fallido»: nadie puede reaccionar al resultado de un trabajo, y una
  impresora de red apagada no deja rastro.
- No aprueba por sí solo los cambios de ajustes de quien no tiene permiso: lo hace el PIN del responsable.

## Dudas abiertas

Se resuelven con `market-decision`; no las decide el worker.

1. ¿El cajón al cobrar debe abrirse solo con efectivo (Square, Toast) y existir un «Abrir cajón / Sin
   venta» manual con permiso y registro, usando el permiso `printing.open_drawer`, que hoy no hace nada?
2. ¿Es el ancho de papel un ajuste global del negocio, un dato de cada impresora, o se detecta solo? Hoy
   está en los ajustes y no cambia nada.
3. ¿Quién puede dar de alta, asignar y probar impresoras: cualquiera que vea la pantalla (hoy), o solo el
   responsable y el administrador?
4. ¿Qué pantalla cambia el mapa documento → función (tique/factura a Recibo, comanda a Cocina, etiqueta a
   Etiqueta)? Hoy solo la API del hub.
5. ¿La cuenta de la mesa debe avisar cuando queda esperando sin impresora, como el tique y la factura?
6. ¿Cuenta la reimpresión de una comanda y el cierre de caja impreso dentro del MVP del restaurante?
7. ¿Hay que poder quitar la función de una impresora sin borrarla?
8. ¿Cuánto tiempo conserva el hub los trabajos impresos, con el documento (RGPD)?

## Fuentes contrastadas

Contra `origin/main` de `printing` v0.1.30 y `origin/develop` del hub (05/10/2026). Una línea por
discrepancia; manda el código.

- **`docs/overview.md`, `docs/limits.md` y `docs/screens.md`**: «No queue, no retry, no history», «It does not discover printers», «No printer discovery here» y «Assign the printer … is a property of that device» describen un módulo de antes de printing#28; la pantalla lee y pinta la cola, reintenta y descarta, busca impresoras y asigna la función (F01, F02, F04, F14).
- **`docs/overview.md`**: dice que el módulo guarda «which station each product category is routed to» y que nada depende de él; el enrutado se retiró en printing#25, y el shell y Ventas leen sus ajustes (F06, F07).
- **`docs/limits.md` y `docs/overview.md`**: «No label printing» (con un `TODO: verify` en el segundo); Inventario imprime etiquetas por la función «Etiqueta» (F12).
- **`docs/concepts.md` y `docs/limits.md`**: el ancho de papel «changes how the next receipt comes out»; ningún código lo lee (F06).
- **`docs/screens.md`, `docs/limits.md` y el manual**: «Print: printing.print» y «Open the cash drawer: printing.open_drawer»; ninguna pantalla ni comando exige esos permisos salvo el comando de pedir una impresión (F13, F16).
- **`hand-book/modulos/printing.md`** (paso 2 de la configuración inicial) dice que «80 mm o 58 mm» se elige «según el rollo real» y que cambia el papel; no cambia nada (F06). También dice que el personal de caja «abre el cajón cuando tiene permiso»: no hay acción manual de abrir el cajón (F13).
- **`architecture/modules/printing.md`** dice que `print_kitchen` sigue siendo contrato; el campo lo exige el esquema y lo lee nadie (F06).
- **Guion `qa-hub-restaurant` §10 y §2 («Cajón solo en efectivo»; «sin venta» con permiso y auditado)**: el cajón se abre con cualquier forma de pago y no existe «sin venta» (F13).
- **Guion `R-08`** («si no sale papel, el TPV lo dice»): no lo dice cuando la cuenta queda en la cola sin impresora (F09).
- **Guion `qa-hub-restaurant` §10** («impresora sin papel/offline: trabajo queda pendiente, reintenta una vez y UI informa estado»): con una impresora de red del propio dispositivo apagada o sin papel, el dispositivo lo intenta 3 veces con 2 s de pausa, solo lo apunta en su registro y la puerta lo da por entregado (si venía de la cola del hub, el hub además lo marca hecho; si salió directo, el hub ni lo conoce); no queda pendiente ni se informa (hub#2494). Las 5 entregas del hub solo cuentan fallos de antes del envío y desconexiones (F07, F10, F14).
- **Referencia de mercado** («lo que espera se avisa, recuperarlo no duplica»): la impresión directa no deduplica y la cola entrega «al menos una vez» (F07, F09, F12).
- **Inventario** (`ui/lib/barcode-print.ts`) da por buena la vía cola sin mirar si alguien la saca, y su botón está en el detalle del producto, no en la lista (F12).
- **Facturas** (`erp-invoice-list.ts`) manda la factura sin documento para la pantalla ni marca de duplicado; en la app instalada sale por la térmica, no en A4; en un navegador sin impresoras, la factura completa abre el diálogo A4 del navegador (F08).
- **Botones de solo icono**: «Imprimir cuenta» e «Imprimir» del TPV y del visor de Ventas son iconos con ese texto solo como etiqueta de accesibilidad (F08, F09).
- **Pestaña del hub «Impresoras y tique»** (`es.ts`) dice «Da de alta tu impresora y configura el tique impreso y digital» y lleva a Impresión; el tique se configura en Ventas (F15).
- **Retención**: `crates/runtime/src/retention.rs` borra a los 90 días `_event_outbox` y `_flow_runs`; no toca `_print_queue`, y el borrado RGPD tampoco (Datos).
- **Textos en inglés en la pantalla española**: la lista de impresoras pinta tal cual la palabra del estado cuando no es «ready», «stopped» o «unknown» (el hub documenta también `busy`, `error` y `offline`), y el error del hardware o del guardado se pinta con el mensaje que llega, sin traducir (pantalla Impresoras, F02, F05, F06).
- **SDK de módulos** (`packages/module-sdk/src/index.ts` del hub, el error de escaneo con el permiso de red local negado): su mensaje es «local network access denied (…)», en inglés, y así lo daba este fichero; el shell lo sustituye antes de que llegue a la pantalla (`apps/web/src/lib/bridge-transport.ts`, `withLocalisedDiscovery`) por la frase en español de `hardware.printersBlocked` (F02).
- **La clave `ui.loading` («Cargando…»)** existe en `locales/es.json` y la pantalla no la usa.
- **USB**: `crates/peripherals` y la app listan y registran las impresoras USB del sistema; `apps/web/src/lib/print.ts` solo resuelve como destino las de red y las Bluetooth con MAC, y el alta como host usa la misma regla (F02, F04, F13).
- **PRINTING-F12, oleada 2 (Inventario, 05/10/2026)**: decía que el aviso «Ninguna impresora tiene el rol «Etiqueta»…» sale cuando la cola rechaza la etiqueta dentro de la app instalada; ese caso da `via: none` en la puerta del hub (`apps/web/src/lib/print.ts`) y sale el aviso genérico; el específico solo lo pone Inventario con `via: browser`, que para una etiqueta no llega nunca (F12).
