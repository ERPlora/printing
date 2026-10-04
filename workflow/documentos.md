# WORKFLOW — Impresión · Documentos que salen

Prefijo: PRINTING

## Flujos

### PRINTING-F07 Imprimir el tique al cobrar
Estado: hecho
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
Sale: el papel, o un trabajo en la cola (clave `sale-<id>`: el mismo cobro repetido es un solo tique). El
QR fiscal y la leyenda `VERI*FACTU` los pone Ventas con el dato del registro fiscal: este módulo no los
pone ni los cambia (PRINTING-F08 recoge lo que va en el papel). Una venta hecha por la API o por un flujo
no la imprime ninguna caja.
Si falla: la venta nunca se cae por la impresión. La persona ve un aviso: «El tique NO se imprimió. Vuelve
a imprimirlo desde la pantalla del tique.»; «El tique está en espera: aún no hay ninguna impresora dada de
alta. Da una de alta y saldrá solo.» (el trabajo no se pierde, sale al dar de alta una);
«El tique no se pudo preparar y NO se imprimió. Imprímelo desde la pantalla del tique.»; o, si salió antes
de que estuviera el QR (la AEAT tardó), «El tique salió antes de que estuviera listo su QR de VeriFactu.
Vuelve a imprimirlo desde la pantalla del tique para darle al cliente el completo.». Se recupera
reimprimiendo (PRINTING-F08) o dando de alta la impresora (PRINTING-F02). Sin el módulo Impresión
instalado no sale nada y no se avisa.
Implicados: pendiente
Pendiente de enlazar: sales — cobrar un tique (dispara la impresión del tique)
Pendiente de enlazar: verifactu — registro y QR de cotejo que lleva el tique
Pendiente de enlazar: invoice — factura simplificada cuyo número sale en el tique
Pendiente de enlazar: hub — impresión automática del tique al cobrar
QA: R-09, L-04, qa-hub §8

### PRINTING-F08 Reimprimir un tique o una factura
Estado: hecho
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Ventas: lista de ventas
Pasos:
1. En la lista de ventas pulsa «Reimprimir» en la fila (o abre el tique o la factura y pulsa
   «Imprimir»).
2. El sistema vuelve a componer el documento con el número fiscal y el QR y lo envía a la impresora de
   «Recibo»; una factura completa pedida desde Ventas va como A4 al diálogo de impresión del sistema (la
   impresora láser o «Guardar como PDF»). Facturas manda la suya por la misma puerta; sin confirmar el
   papel final de una factura completa impresa desde su lista.
3. Sale el papel con la marca de duplicado.
Entra: la venta o la factura elegida.
Sale: el papel; ninguna venta ni registro fiscal nuevo. La reimpresión usa un trabajo nuevo cada vez
(clave distinta por intento): imprimir otra vez siempre saca papel.
Si falla: «No se pudo imprimir» (más el motivo si lo hay); si queda en la cola y no hay ninguna impresora
dada de alta, «El tique está en espera: aún no hay ninguna impresora dada de alta. Da una de alta y saldrá
solo.».
Implicados: pendiente
Pendiente de enlazar: sales — lista de ventas y visor del tique (reimprimir)
Pendiente de enlazar: invoice — imprimir una factura desde su lista
QA: L-05, L-04

### PRINTING-F09 Imprimir la cuenta de la mesa
Estado: parcial — si la cuenta queda en la cola sin ninguna impresora dada de alta, el TPV no avisa (el tique al cobrar y la reimpresión sí)
Vertical: restaurante
Actor: empleado, responsable
Pantalla: Ventas: TPV
Pasos:
1. Con la mesa abierta, pulsa «Imprimir cuenta» en el pie del TPV.
2. Se abre «Cuenta» con las líneas, los suplementos, el desglose de IVA y el total (el desglose es el de
   la valoración del hub cuando ha contestado).
3. Pulsa «Imprimir».
4. Sale por la función «Recibo» con un aviso impreso de que **no es una factura**, **sin número de
   serie ni QR de VeriFactu** y sin datos de pago; en la pantalla pone «Cuenta — no es una factura. El
   tiquet fiscal se entrega al cobrar.».
Entra: la comanda abierta de la mesa, con sus precios y suplementos.
Sale: el papel (o un trabajo en la cola con clave `prebill-<pedido>-<huella de las líneas>`). Pulsar
«Imprimir» dos veces sin cambiar nada es el mismo trabajo y no saca otro papel; cambiar una línea, un
suplemento o una nota saca la cuenta nueva. La numeración fiscal no se consume: nace al cobrar.
Si falla: «No se pudo imprimir la cuenta» y, tras dos puntos, el motivo si lo hay. Si va por la cola y
nadie la drena, el TPV no dice nada y el papel espera hasta dar de alta una impresora de «Recibo».
Implicados: pendiente
Pendiente de enlazar: sales — cuenta de la mesa en el TPV (imprimir cuenta)
Pendiente de enlazar: tables — mesa abierta cuya cuenta se imprime
QA: R-08, qa-hub-restaurant §10

### PRINTING-F12 Imprimir la etiqueta de un código de barras
Estado: hecho
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Inventario: productos
Pasos:
1. En la lista de productos pulsa «Imprimir código de barras» del producto.
2. La etiqueta sale por la impresora con función «Etiqueta».
Entra: la referencia (SKU), el nombre y el precio del producto, de Inventario.
Sale: el papel, o un trabajo en la cola (clave `barcode-<SKU>`: si va por la cola, pulsar otra vez el mismo
producto es el mismo trabajo y no saca otra etiqueta; sin confirmar si la impresora directa también la
ignora).
Si falla: «Ninguna impresora tiene el rol «Etiqueta»: asígnale una en Impresión» (mensaje de Inventario)
si falta la función; para cualquier otro fallo, «No se pudo imprimir la etiqueta del código de barras».
Se recupera dando de alta una impresora y asignándole «Etiqueta» (PRINTING-F04).
Implicados: pendiente
Pendiente de enlazar: inventory — imprimir el código de barras de un producto
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
Implicados: pendiente
Pendiente de enlazar: sales — cobro (dispara la apertura del cajón)
Pendiente de enlazar: cash_register — caja y arqueo (el efectivo que entra al cajón)
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
Implicados: pendiente
Pendiente de enlazar: cash_register — cierre de caja (imprimir el resumen del turno)
QA: ninguno
