# WORKFLOW — Impresión · Impresoras

Prefijo: PRINTING

## Flujos

### PRINTING-F01 Ver cómo va la impresión
Estado: hecho
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Impresoras
Pasos:
1. Abre **Impresión → Impresoras**.
2. Lee las tarjetas de función (una por cada función que tenga algún dispositivo dado de alta o trabajos
   esperando; un negocio nuevo no ve ninguna) y la lista de trabajos; «Refrescar» vuelve a leer al momento (si no, lo
   hace sola cada 30 segundos).
3. Si una función sale «En cola, sin impresora» o hay un aviso naranja, el papel no está saliendo: sigue
   por PRINTING-F04 (asignar la función) o PRINTING-F14 (sacar el trabajo del atasco).
Entra: la cobertura por función y la cola, que calcula el hub (consultas del hub, no del módulo); se
leen con cualquier sesión del puesto, no hace falta ser administrador.
Sale: nada guardado. La misma cobertura se ve también en Ajustes › Impresión («Estado de impresión»), en
el panel y en Sistema. La cola solo sabe de lo que llegó al hub: un tique que salió por la impresora de
red del propio dispositivo no pasa por ella y no aparece aunque esa impresora estuviera apagada. El cierre de caja de Caja repasa esta misma cobertura y avisa «Impresiones
pendientes: N (estaciones)» al cerrar el turno.
Si falla: «No se pudo leer la cola de impresión.» con el código entre paréntesis; no se pinta «Todo al
día» cuando la lectura falla, pero las tarjetas y trabajos de la lectura anterior siguen a la vista.
Implicados: pendiente
Pendiente de enlazar: hub — cola de impresión y cobertura por función
QA: qa-hub §8

### PRINTING-F02 Encontrar y dar de alta una impresora de la red
Estado: parcial — una impresora USB (ordenador) sale en la lista y admite función, pero no recibe ningún tique, comanda ni trabajo de la cola (solo la hoja de prueba)
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Impresoras
Pasos:
1. Abre **Impresión → Impresoras** desde la app instalada en el dispositivo que está en la red de la
   impresora; la búsqueda arranca sola («Escaneando…»). «Re-escanear» la repite.
2. La impresora aparece en la lista con su nombre, su estado y su identificador. Las impresoras USB del
   sistema (solo ordenador) y las Bluetooth ya emparejadas (solo Android) salen en la misma lista.
3. Asígnale su función (PRINTING-F04) y pruébala (PRINTING-F05).
Entra: lo que encuentra la app del dispositivo (búsqueda mDNS y barrido de la subred por el puerto
9100, más USB y Bluetooth).
Sale: la impresora queda en el registro de la app de este dispositivo, no en la base de datos del hub.
Una impresora USB con función nunca recibe tique, comanda ni trabajos de la cola: la puerta de impresión
del shell y el alta como host solo aceptan impresoras con dirección de red o Bluetooth con MAC.
Si falla: desde un navegador, «Desde el navegador, este dispositivo no puede llegar a las impresoras…»;
sin resultados, «No se encontraron impresoras de red (puerto 9100) en esta subred.» (cero impresoras
puede ser cortafuegos, otra red o impresora apagada: pasa a PRINTING-F03). Un error de escaneo sale en
rojo con el mensaje tal como llega. Si el sistema operativo niega el permiso de red local, sale en rojo
«ERPlora no ha podido buscar en esta red: el sistema no le ha dado permiso a la app para acceder a los
dispositivos de la red local…» (la frase la pone el shell del hub) y debajo «No se encontraron impresoras de red (puerto 9100)
en esta subred.».
Implicados: pendiente
Pendiente de enlazar: hub — búsqueda de impresoras y registro de dispositivos de la app instalada
QA: qa-hub §8, qa-hub-android Fase 3

### PRINTING-F03 Añadir una impresora por su IP
Estado: hecho
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Impresoras
Pasos:
1. Pulsa «Añadir impresora por IP» (solo se ofrece en la app instalada).
2. Escribe la «Dirección IP» que sale en la hoja de configuración de la impresora (se imprime
   manteniendo pulsado el botón de avance de papel al encenderla) y el «Puerto» (9100 de fábrica).
3. Pulsa «Añadir y probar» («Conectando…»).
4. La impresora aparece en la lista, el formulario se cierra, sale «Impresora añadida. Se le ha enviado
   una página de prueba.» y la hoja de prueba sale por ella.
Entra: una dirección IPv4 y un puerto entre 1 y 65535.
Sale: la impresora queda guardada en el registro de la app **solo si contesta**; las siguientes
búsquedas la siguen listando aunque el barrido no la vea. No toca la base de datos del hub.
Si falla: «La dirección no es válida. Escribe la IP tal como sale en la hoja de la impresora (por
ejemplo 192.168.1.100) y un puerto entre 1 y 65535.» (no llama a la impresora); «Ninguna impresora ha
respondido en {dirección}. Comprueba que está encendida, conectada a la misma red que este dispositivo y
que la IP y el puerto son correctos.»; «No se pudo añadir la impresora. Actualiza la app de ERPlora en
este dispositivo y vuelve a intentarlo.» para cualquier otro fallo. Si la prueba posterior falla, el
error de la prueba sale en rojo encima de la lista (PRINTING-F05) y la impresora queda añadida.
Implicados: pendiente
Pendiente de enlazar: hub — alta de impresora por IP en la app instalada
QA: qa-hub-android Fase 3

### PRINTING-F04 Asignar qué sale por cada impresora
Estado: parcial — la función se asigna por impresora y dispositivo, pero no hay pantalla para cambiar qué documento va a qué función (solo la API del hub) ni para quitar una función ya asignada; y cambiar o quitar la función en la app no la retira del hub, que la sigue dando por cubierta sin imprimir
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Impresoras
Pasos:
1. En la tarjeta de la impresora abre el desplegable «Rol».
2. Elige «Recibo» (tique, factura, cuenta de la mesa y cierre de caja), «Cocina» (comandas), «Barra»
   (comandas de la barra) o «Etiqueta» (etiquetas de código de barras). Por «Barra» solo sale lo que va a
   una estación de Cocina con la función «Barra», y esa función solo se le pone con el asistente o la API:
   una estación creada en pantalla, y un plato o una bebida sin estación, salen por «Cocina» (KITCHEN-F01,
   KITCHEN-F04, KITCHEN-F08).
3. La función queda asignada a esa impresora **en este dispositivo**; en la siguiente pasada (hasta 30
   segundos) este dispositivo se da de alta solo en el hub como quien imprime esa función, y la tarjeta de la función pasa a
   «Listo» con «Imprime desde: <nombre del dispositivo>.».
Entra: la impresora elegida y la función. Si el dispositivo solo tiene una impresora de red y ninguna
función asignada en todo su registro, al abrir la app se le pone «Recibo» sola.
Sale: la función en el registro de la app de este dispositivo; el dispositivo se anuncia al hub como
«host» de esa función y repite el aviso cada 30 segundos (el hub lo da por vivo 90 s). Qué documento sale
por qué función lo decide el hub, que de fábrica manda el tique, la factura, el albarán, la cuenta de la
mesa, el cierre de caja y el documento genérico a «Recibo», la comanda a «Cocina» y la etiqueta a
«Etiqueta»; ese mapa se cambia por la API del hub, no desde esta pantalla.
Si falla: si la impresora parece de oficina (A4), sale el aviso «Esta impresora parece de oficina (A4) y
no entiende tickets. Los tiques y comandas necesitan una impresora térmica.» y la función se asigna igual
(es un aviso, no un bloqueo). Un error al asignar sale en rojo tal como llega, o «No se pudo asignar el
rol». Una impresora sin función no recibe nada de la caja ni de la cola, y una USB tampoco lo recibe aunque
la tenga (F02); un trabajo sin nadie con esa función espera en la cola.
Implicados: INVENTORY-F25, KITCHEN-F01, KITCHEN-F04, KITCHEN-F08, REC_RESTAURANTE-F02
Pendiente de enlazar: hub — mapa documento → función y registro de «hosts» de impresión
QA: qa-hub §8

### PRINTING-F05 Hacer una prueba de impresión
Estado: parcial — con una impresora de red, «Probar» no avisa si la impresora no contesta
Vertical: comun
Actor: administrador, responsable, empleado
Pantalla: Impresoras
Pasos:
1. Pulsa «Probar» en la tarjeta de la impresora.
2. Sale una hoja corta con el nombre del negocio, el aviso de que la impresora responde, la fecha y la
   hora y el identificador de la impresora, y se corta.
Entra: la impresora y el idioma de la pantalla; el nombre del negocio es la primera línea de la cabecera
del tique de Ventas o, si no hay, el nombre fiscal del negocio.
Sale: nada guardado; la hoja va directa a la impresora, no pasa por la cola.
Si falla: con una impresora de red, «Probar» no avisa si la impresora no contesta: la hoja solo entra en
la cola del dispositivo, que lo intenta 3 veces y lo apunta en su registro; si no sale la hoja, revisa la
impresora (o añádela otra vez por IP, que sí comprueba la conexión). El error sale en rojo encima de la
lista tal como llega (o «Falló la impresión de prueba») solo con Bluetooth, USB o un identificador mal
formado.
Implicados: SALES-F34
QA: qa-hub §8

### PRINTING-F06 Elegir cómo imprime el negocio
Estado: parcial — el «Ancho de papel» se guarda pero nada lo lee (el papel no cambia)
Vertical: comun
Actor: administrador, responsable
Pantalla: Impresoras
Pasos:
1. En «Ajustes del ticket» elige el «Ancho de papel» (80 mm o 58 mm).
2. Enciende o apaga «Imprimir ticket al cobrar» y «Abrir cajón al cobrar» (son decisiones separadas).
3. Pulsa «Guardar ajustes».
4. Sale «✓ Guardado».
Entra: los tres valores que ve la pantalla (más el interruptor de cocina, que no tiene control y se manda
tal como estaba).
Sale: una sola fila de ajustes por negocio (se crea al primer guardado, y si estaba borrada se
recupera). Mientras nadie guarde, la lectura devuelve los de fábrica: tique al cobrar encendido, cajón
apagado, 80 mm; lo que ve la pantalla es lo que obedece la caja. «Imprimir ticket al cobrar» y «Abrir
cajón al cobrar» los lee el shell en cada cobro (PRINTING-F07, PRINTING-F13) y el interruptor «Imprimir
tiquet» de la hoja de cobro de Ventas arranca con el valor guardado aquí. El ancho de papel y el
interruptor de cocina no los lee nadie en `origin/main` (ni el hub ni ningún módulo).
Si falla: un empleado ve los mismos controles; al guardar, la caja pide la aprobación (PIN) del
responsable y con ella se guarda. Si el guardado falla, el mensaje del servidor sale debajo del botón tal
como llega, o «No se pudo guardar». Si no se pueden leer los ajustes, debajo del botón sale «No se
pudieron cargar los ajustes» (o el mensaje del servidor) y el formulario se queda con los de fábrica.
Los ajustes que no se guardan no se pierden de la pantalla: siguen en el formulario.
Implicados: SALES-F01, REC_FISCAL-F07
QA: R-09, qa-hub §8

### PRINTING-F15 Llevar el texto antiguo del tique a Ventas
Estado: hecho
Vertical: comun
Actor: administrador, responsable
Pantalla: Impresoras
Pasos:
1. Si el negocio escribió una cabecera o un pie en Impresión antes de que el tique pasara a Ventas, la
   pantalla muestra el recuadro con ese texto, mientras esa cabecera o ese pie sigan vacíos en Ventas (o si
   Ventas no está instalado); si Ventas ya los tiene, el texto antiguo no se ve.
2. Pulsa «Llevarlo a los ajustes del tique» («Llevando…»).
3. Sale «Hecho. Tu tique ya lo lleva.» y el recuadro desaparece.
Entra: la cabecera y el pie antiguos de Impresión.
Sale: en los ajustes de Ventas solo se rellena lo que allí está vacío; nunca pisa una cabecera o un pie ya
escritos. Para escribir la cabecera o el pie nuevos hay que ir a Ventas con «Abrir los ajustes del
tique»; este módulo ya no los guarda.
Si falla: si la persona no tiene el permiso de cambiar los ajustes de Ventas, la caja pide la aprobación
(PIN) del responsable. «No se ha podido llevar el texto. Cópialo a mano en los ajustes del tique.» (con el código entre
paréntesis si lo hay; el texto sigue en pantalla). Si Ventas no está instalado, el recuadro no tiene
botón y el texto se queda a la vista para copiarlo. Si la lectura posterior no encuentra el texto en
Ventas, también falla («receipt_text_not_applied»).
Implicados: SALES-F34
QA: ninguno
