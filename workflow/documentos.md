# WORKFLOW — Impresión · Documentos que salen

Prefijo: PRINTING

## Flujos

### PRINTING-F07 Imprimir el tique al cobrar
Estado: parcial — si la impresora de red del dispositivo está apagada o sin papel, el papel se pierde sin ningún aviso; si el tique venía de la cola del hub, además lo marca impreso (hub#2494)
Vertical: comun
Actor: empleado, sistema
Pantalla: Ventas: Cobro
Pasos:
1. En la hoja de cobro, deja el interruptor «Imprimir tiquet» como esté (arranca con el ajuste de
   PRINTING-F06) o cámbialo para esta venta; el que deja la persona manda sobre el ajuste, en los dos
   sentidos.
2. Cobra la venta.
3. En la caja que cobró, y solo en ella, el sistema espera hasta unos 10 segundos al número fiscal y al código
   QR de la factura y compone el tique con ellos.
4. El tique sale por la impresora con función «Recibo» de ese dispositivo (de red o Bluetooth); si ese
   dispositivo no llega a ninguna, se encola en el hub y lo imprime el dispositivo que tenga esa función.
Entra: el cobro (de Ventas); el ajuste «Imprimir ticket al cobrar»; el documento lo compone Ventas con
sus ajustes (cabecera, pie), la factura y el registro VeriFactu.
Sale: el papel, o un trabajo en la cola del hub (clave `sale-<id>`: la cola ignora un `jobId` repetido; la
impresión directa del dispositivo no deduplica nada). El
QR fiscal y la leyenda `VERI*FACTU` los pone Ventas con el dato del registro fiscal: este módulo no los
pone ni los cambia (PRINTING-F08 recoge lo que va en el papel). Una venta hecha por la API o por un flujo
no la imprime ninguna caja.
Si falla: la venta nunca se cae por la impresión, pero el papel sí puede perderse sin aviso. Con la
impresora de red del propio dispositivo apagada o sin papel, el dispositivo solo deja el trabajo en una
cola suya, lo intenta 3 veces con 2 s de pausa y, si fallan, lo apunta en su registro: la puerta lo da por
entregado, no sale aviso y, si venía de la cola del hub, el hub lo marca hecho. Los avisos solo saltan
cuando no hay impresora ni cola, cuando el papel espera sin nadie que lo saque o cuando el tique no se pudo
componer. Las 5 entregas del hub solo cuentan fallos anteriores al envío (sin impresora con esa función en
el dispositivo, Bluetooth caído) y desconexiones del dispositivo. La persona ve un aviso: «El tique NO se imprimió. Vuelve
a imprimirlo desde la pantalla del tique.»; «El tique está en espera: aún no hay ninguna impresora dada de
alta. Da una de alta y saldrá solo.» (el trabajo no se pierde, sale al dar de alta una);
«El tique no se pudo preparar y NO se imprimió. Imprímelo desde la pantalla del tique.»; o, si salió antes
de que estuviera el QR (la AEAT tardó), «El tique salió antes de que estuviera listo su QR de VeriFactu.
Vuelve a imprimirlo desde la pantalla del tique para darle al cliente el completo.». Se recupera
reimprimiendo (PRINTING-F08) o dando de alta la impresora (PRINTING-F02). Sin el módulo Impresión
instalado no sale nada y no se avisa.
Implicados: INVOICE-F20, SALES-F01, VERIFACTU-F19, REC_FISCAL-F07
Pendiente de enlazar: hub — impresión automática del tique al cobrar
QA: R-09, L-04, qa-hub §8

### PRINTING-F08 Reimprimir un tique o una factura
Estado: parcial — desde Facturas la reimpresión no lleva marca de duplicado, y en la app instalada la factura completa sale por la impresora térmica de «Recibo» (o la cola), no en A4; la impresora de red apagada pierde el papel sin aviso (F07)
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Ventas: lista de ventas
Pasos:
1. En la lista de ventas pulsa «Reimprimir» en la fila (o abre el tique o la factura y pulsa
   «Imprimir»).
2. El sistema vuelve a componer el documento con el número fiscal y el QR y lo envía a la impresora de
   «Recibo»; una factura completa pedida desde Ventas va como A4 al diálogo de impresión del sistema (la
   impresora láser o «Guardar como PDF»). Desde Facturas, en la app instalada no hay diálogo A4 (la
   factura va sin su documento para la pantalla): sale por la térmica de «Recibo» del dispositivo o, si
   no hay, por la cola; abierta en un navegador, que no llega a las impresoras, una factura completa abre
   el diálogo de impresión del navegador en A4 y un tique va a la cola (INVOICE-F18).
3. Desde Ventas sale el papel con la marca de duplicado; desde Facturas, sin ella.
Entra: la venta o la factura elegida.
Sale: el papel; ninguna venta ni registro fiscal nuevo. La reimpresión usa un trabajo nuevo cada vez
(clave distinta por intento): imprimir otra vez siempre saca papel.
Si falla: con una impresora de red del dispositivo apagada no hay aviso (F07). Si no, «No se pudo imprimir» (más el motivo si lo hay); si queda en la cola y no hay ninguna impresora
dada de alta, «El tique está en espera: aún no hay ninguna impresora dada de alta. Da una de alta y saldrá
solo.».
Implicados: INVOICE-F18, SALES-F29, REC_FISCAL-F07
QA: L-05, L-04

### PRINTING-F09 Imprimir la cuenta de la mesa
Estado: parcial — si la cuenta queda en la cola sin ninguna impresora dada de alta, o la impresora de red está apagada, el TPV no avisa; y pulsar «Imprimir» otra vez imprime otra cuenta cuando sale directa
Vertical: comun
Actor: empleado, responsable
Pantalla: Ventas: TPV
Pasos:
1. Con algo en el carrito (con mesa abierta o sin ella), pulsa el icono de impresora «Imprimir cuenta» en el pie del TPV; sin mesa, la cuenta sale a nombre del cliente.
2. Se abre «Cuenta» con las líneas, los suplementos, el desglose de IVA y el total (el desglose es el de
   la valoración del hub cuando ha contestado).
3. Pulsa el icono de impresora «Imprimir».
4. Sale por la función «Recibo» con un aviso impreso de que **no es una factura**, **sin número de
   serie ni QR de VeriFactu** y sin datos de pago; en la pantalla pone «Cuenta — no es una factura. El
   tiquet fiscal se entrega al cobrar.».
Entra: la comanda abierta de la mesa, con sus precios y suplementos.
Sale: el papel (o un trabajo en la cola con clave `prebill-<pedido>-<huella de las líneas>`). Si va
por la cola del hub, pulsar «Imprimir» dos veces sin cambiar nada es el mismo trabajo y no saca otro papel;
si sale directa por la impresora del dispositivo, cada pulsación saca una cuenta. Cambiar una línea, un
suplemento o una nota da una cuenta nueva. La numeración fiscal no se consume: nace al cobrar.
Si falla: «No se pudo imprimir la cuenta» y, tras dos puntos, el motivo si lo hay. Si va por la cola y
nadie la drena, o la impresora de red no contesta, el TPV no dice nada y el papel espera hasta dar de alta una impresora de «Recibo».
Implicados: SALES-F21, REC_RESTAURANTE-F09
QA: R-08, qa-hub-restaurant §10

### PRINTING-F12 Imprimir la etiqueta de un código de barras
Estado: parcial — si ningún dispositivo tiene la función «Etiqueta», la etiqueta queda en la cola sin avisar (el tique y la comanda sí avisan)
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Inventario: productos
Pasos:
1. Abre el producto y pulsa «Imprimir código de barras».
2. La etiqueta sale por la impresora con función «Etiqueta».
Entra: la referencia (SKU), el nombre y el precio del producto, de Inventario.
Sale: el papel, o un trabajo en la cola (clave `barcode-<SKU>`: si va por la cola del hub, pulsar otra vez el
mismo producto es el mismo trabajo y no saca otra etiqueta; si sale directa por la impresora del
dispositivo, cada pulsación saca una).
Si falla: sin ninguna impresora «Etiqueta» en el dispositivo la etiqueta se encola y espera sin ningún
aviso (Inventario da por buena la cola sin mirar si alguien la saca); la impresora de red apagada tampoco
avisa (F07). El aviso «Ninguna impresora tiene el rol «Etiqueta»: asígnale una en Impresión» (mensaje de
Inventario) no sale nunca: Inventario solo lo pone si la puerta de impresión del hub contesta «navegador»
dentro de la app instalada, y para una etiqueta la puerta contesta «cola» (sin impresora con esa función) o
«ningún sitio» (si la cola rechaza el trabajo); en ese último caso, y en cualquier otro fallo, sale el
genérico «No se pudo imprimir la etiqueta del código de barras» (INVENTORY-F25).
Se recupera dando de alta una impresora y asignándole «Etiqueta» (PRINTING-F04).
Implicados: INVENTORY-F25
QA: qa-hub §8

### PRINTING-F13 Abrir el cajón al cobrar
Estado: parcial — solo se abre solo al cobrar y con cualquier forma de pago (no solo efectivo); no hay acción manual de «abrir cajón» ni «sin venta»; si no se abre, no se avisa
Vertical: comun
Actor: sistema
Pantalla: Impresoras
Pasos:
1. Enciende «Abrir cajón al cobrar» y pulsa «Guardar ajustes» (PRINTING-F06).
2. Al cobrar, la caja que cobró manda la señal de apertura por su impresora con función «Recibo», a la
   vez que el tique y sin esperarlo.
Entra: el ajuste y la impresora de «Recibo» de este dispositivo.
Sale: el cajón se abre; nada guardado. Solo lo hace el dispositivo que cobró (y solo si llega a la
impresora de «Recibo» por red o Bluetooth; una USB no cuenta); el cajón no tiene cola, no se pide a otro
dispositivo y una venta de la API o de un flujo no lo abre.
Si falla: sin aviso. Si este dispositivo no llega a la impresora, o no hay impresora de «Recibo», o
la impresora no contesta, el cajón no se abre y nadie lo ve (el error se descarta). El tique no depende
del cajón y viceversa. El permiso `printing.open_drawer` está en el manifiesto pero ninguna pantalla ni
comando lo exige.
Implicados: SALES-F01, SALES-F02, REC_PELUQUERIA-F09, REC_RESTAURANTE-F11, REC_RESTAURANTE-F17
Pendiente de enlazar: hub — apertura del cajón por la impresora
QA: R-09, qa-hub §8

### PRINTING-F17 Imprimir el cierre de caja
Estado: no hecho — ningún módulo manda el cierre de caja a imprimir (el hub sabe pintar el documento «Cierre de caja», pero nadie lo pide); Caja solo avisa de las impresiones pendientes al cerrar
Vertical: comun
Actor: responsable
Pantalla: Caja: cierre de caja
Pasos:
1. Al cerrar el turno, la persona pulsa la acción de imprimir el cierre (no existe todavía).
2. El resumen del turno sale por la función «Recibo».
Entra: el turno cerrado, de Caja.
Sale: el papel, o un trabajo en la cola.
Si falla: igual que PRINTING-F07 (aviso y recuperación desde la pantalla de Caja).
Implicados: CASH_REGISTER-F09, REC_PELUQUERIA-F16, REC_RESTAURANTE-F16
QA: ninguno
