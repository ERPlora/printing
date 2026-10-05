# WORKFLOW — Impresión · Cocina, cola y asistente

Prefijo: PRINTING

## Flujos

### PRINTING-F10 Imprimir la comanda en cocina y barra
Estado: parcial — si la impresora de red del dispositivo está apagada o sin papel, la comanda se pierde sin ningún aviso; si venía de la cola del hub, además la marca impresa (hub#2494); y una comanda que no disparó ninguna caja solo llega a la cola si hay una pantalla del hub abierta cuando nace
Vertical: restaurante
Actor: sistema
Pantalla: ninguna
Pasos:
1. La camarera dispara el pedido desde el TPV (cada disparo es una ronda).
2. En la caja que lo disparó se agrupan las líneas por la función de impresora de su estación y sale
   una hoja por función («Cocina», «Barra»); lo que va solo a pantalla no se imprime. Sin
   estación, o con una estación creada en pantalla, la línea sale por «Cocina», también una bebida: «Barra»
   solo recibe lo de una estación con esa función, que se pone con el asistente o la API (KITCHEN-F01).
3. La hoja lleva la mesa (o la etiqueta del pedido), la ronda, el número, quién disparó, las cantidades,
   los suplementos y las notas.
Entra: las líneas del pedido y la estación de cada una (de Cocina; la función de impresora de cada
estación se elige allí, no aquí).
Sale: una hoja por función, con clave `kitchen-<pedido>-<función>`: en la cola del hub, repetir el
disparo es el mismo trabajo; si sale directa por la impresora del dispositivo, no se deduplica. Si ninguna caja lo disparó (API, flujo, pedido en línea) va a la cola del hub, y lo imprime el
dispositivo de la función, solo si en ese momento hay al menos una pantalla del hub abierta y conectada:
es ella la que la encola; si no hay ninguna, no se imprime ni se avisa (hub#2501). Las demás cajas solo reciben el aviso del sistema «Nueva comanda». La
comanda sale con o sin el módulo Impresión instalado y no lee sus ajustes.
Si falla: nunca bloquea al camarero; la comanda está en la pantalla de cocina. Si la impresora de red
del dispositivo está apagada o sin papel, no se avisa: el dispositivo lo intenta 3 veces y lo apunta en su
registro, y la comanda no sale. Si la cola no acepta la comanda: «No se imprimió la comanda de {estación}
de {mesa}. Revisa la impresora y avisa en {estación}: la comanda está en la pantalla de cocina.»; si
quedó en la cola sin que nadie la saque (ningún dispositivo con esa función dado de alta): «La comanda de {estación} de {mesa} está en espera: aún no hay ninguna impresora dada de alta para
esa estación. Da una de alta y saldrá sola.». La comanda de cocina no se desvía nunca a la impresora de
tiques.
Implicados: KITCHEN-F01, KITCHEN-F08, REC_RESTAURANTE-F07, REC_RESTAURANTE-F17
Pendiente de enlazar: hub — impresión de la comanda al disparar el pedido
QA: qa-hub-restaurant §08

### PRINTING-F11 Reimprimir una comanda
Estado: no hecho — no hay botón ni acción para reimprimir una comanda que no salió o se estropeó; el aviso lo dice solo de palabra («la comanda está en la pantalla de cocina»)
Vertical: restaurante
Actor: responsable
Pantalla: Cocina: pantalla de cocina
Pasos:
1. Desde la comanda que no salió, pulsa la acción de reimprimir (no existe todavía).
2. La hoja vuelve a salir por la función de su estación, marcada como copia.
Entra: la comanda ya disparada.
Sale: una hoja nueva por función, con trabajo nuevo; no crea ronda ni pedido.
Si falla: igual que PRINTING-F10.
Implicados: KITCHEN-F09
QA: qa-hub-restaurant §16

### PRINTING-F14 Sacar del atasco un trabajo de impresión
Estado: hecho
Vertical: comun
Actor: administrador
Pantalla: Impresoras
Pasos:
1. En la cola localiza el trabajo («Recibo T-000123», estado «Muerto» o «Pendiente») y lee «Último
   error» e «intentos».
2. Arregla primero la causa física (impresora apagada, sin papel, sin red o sin función asignada).
3. Pulsa «Reintentar» (solo en un trabajo «Muerto»): vuelve a la cola con los intentos a cero y sale
   «Vuelve a la cola: lo imprimirá el próximo dispositivo que se conecte.».
4. Si ya no debe salir, pulsa «Descartar» (en un trabajo «Pendiente» o «Muerto»), escribe un «Motivo
   (opcional)» y confirma con «Sí, descartar»; sale «Trabajo descartado. No se imprimirá y ya no bloquea
   su estación.» y queda en «Retirados recientemente» como «Retirado por Ana desde printing · fecha» (el módulo sale
   con su identificador `printing`, sin traducir) y «Motivo: …».
Entra: el trabajo elegido y, al descartar, el motivo.
Sale: el trabajo vuelve a pendiente o queda «Retirado» (nunca se borra); queda sellado quién, cuándo y
desde qué módulo. La lista se vuelve a leer siempre, también tras un rechazo. Un trabajo «Imprimiendo»
no ofrece ninguna acción; un trabajo muerto tiene cinco entregas agotadas.
Si falla: un trabajo solo llega a «Muerto» por fallos anteriores al envío o por desconexiones del dispositivo (5 entregas, 90 s de arrendamiento); una impresora de red apagada no lo mata: el hub lo da por hecho (F07). Los botones solo los ve quien administra el hub; el servidor lo vuelve a exigir y además
pide el permiso de impresora concedido al módulo. Los rechazos salen por código y en la lengua de la
pantalla: «Solo se puede reintentar un trabajo que se ha dado por vencido; este está {estado}.», «No se
puede descartar un trabajo que una impresora está sacando; este está {estado}.», «Ese trabajo ya no está
en la cola. La lista se acaba de actualizar.», «El permiso de impresión no está concedido, así que todavía
no se pueden mover trabajos.» (con el botón «Ir a Permisos»), «Solo quien administra el negocio puede
mover trabajos de la cola de impresión.» y, para cualquier otro, «No se pudo mover el trabajo. Inténtalo
de nuevo en un momento.».
Implicados: pendiente
Pendiente de enlazar: hub — cola de impresión (reintentar y descartar trabajos)
QA: qa-hub-restaurant §16, qa-hub §8

### PRINTING-F16 Mandar imprimir desde el asistente o un flujo
Estado: parcial — solo se hace con el asistente, un flujo o la API: no tiene pantalla, ningún módulo lo usa en `origin/main`, el módulo apunta la petición en una tabla que nada lee y los errores de entrega no llegan a quien la pidió
Vertical: comun
Actor: asistente, sistema
Pantalla: asistente
Pasos:
1. El asistente o un flujo pide imprimir un documento: un identificador de trabajo, el tipo de documento
   (tique, comanda, factura, albarán, etiqueta, cierre de caja, cuenta o genérico) y el documento ya
   compuesto; opcionalmente la función y el papel.
2. El módulo anota la petición y avisa al hub, que la encola.
3. La imprime el dispositivo que tenga la función que corresponde al tipo de documento.
Entra: el documento estructurado (nunca HTML) y su identificador de trabajo.
Sale: una fila en el registro de peticiones del módulo y el aviso `printing.print.due`; el hub lo encola
(la cola ignora un identificador repetido). Ese registro no tiene consulta ni pantalla. La entrega al
hub es asíncrona: la petición responde bien antes de que el trabajo esté en la cola.
Si falla: la petición se rechaza si falta un campo o el tipo no es uno de los ocho conocidos. Si al módulo
no se le ha concedido el permiso de impresora, la petición responde bien y el trabajo queda de inmediato
en Sistema › Eventos caídos, sin reintentos; se encola solo al conceder el permiso. Una función que el hub
no tiene la rechaza la cola en la entrega, no en la petición: la petición ya respondió bien, el hub
reintenta 8 veces y acaba en Eventos caídos, y quien la pidió no se entera.
Implicados: FLOWS-F13, FLOWS-F25
Pendiente de enlazar: hub — cola de impresión (entrega del aviso al hub)
QA: ninguno
