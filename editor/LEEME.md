# Editor de RELIEVE

Programa local para escribir y publicar artículos de la revista sin tocar código. Corre en tu computadora y se abre en el navegador.

## Dos formas de usarlo

- **Desde la web, en cualquier computadora:** https://relievemag.com/editor/ — entra con tu usuario y contraseña. Los cambios se guardan en ese navegador mientras escribes y se suben a GitHub con **Publicar** (un solo envío por artículo). Las fotos se achican en el propio navegador. La vista previa muestra la página tal como queda.
- **En tu computadora:** `Iniciar editor.bat` (abajo). Además guarda los originales de las fotos, construye la vista previa con Eleventy y sirve sin internet.

Los dos editan lo mismo (el repositorio `relieve`) y se ven igual.

### Acceso web: usuarios y contraseñas

La primera vez que se abre https://relievemag.com/editor/ pide crear el primer usuario: nombre, usuario, contraseña (12 caracteres o más) y una **llave de GitHub** (fine-grained token). La pantalla explica cómo crear la llave: solo el repositorio `relieve`, permisos *Contents: Read and write* y *Actions: Read-only*, vencimiento de hasta un año.

La contraseña cifra la llave en el propio navegador (AES-GCM con una clave derivada por PBKDF2-SHA256 de 600 000 rondas, el mismo esquema que la herramienta de código abierto StatiCrypt). Solo se guarda la versión cifrada, en `editor/acceso.json`; sin la contraseña no sirve para nada. La llave descifrada vive solo en la pestaña abierta: al cerrarla hay que volver a entrar.

En **Usuarios** se agregan o quitan personas. Un usuario nuevo puede usar la misma llave que tú o la suya propia. Para cortarle el acceso a alguien del todo, quítalo y además borra su llave en GitHub (o renueva la compartida). Usa contraseñas largas: el archivo es público y una contraseña corta se puede adivinar.

## Qué necesitas (modo computadora)

**Node.js** y **Git**. Si no los tienes, `Iniciar editor.bat` los instala solo con winget (Windows pedirá permiso: responde Sí). También hace falta tener la sesión de GitHub iniciada en esta computadora; la primera vez que publiques, Git te pedirá entrar.

## Cómo se usa

Doble clic en **Iniciar editor.bat**. La primera vez tarda unos minutos: descarga el sitio desde GitHub (carpeta `site`) e instala Eleventy, que es lo que construye las páginas. Luego se abre el navegador en http://localhost:4321. Para apagarlo, cierra la ventana negra.

## Qué hace

- **Mismo diseño que el sitio:** la barra de arriba es la del sitio (logo, enlaces, botones cuadrados) y el artículo se edita sobre la propia página, con las mismas letras, anchos y márgenes. Botones *Computadora* y *Celular* para ver cómo queda en cada uno.
- **Artículos:** lista, crea y edita. Todo se guarda solo mientras escribes (y con Ctrl+S cuando quieras). En la web, los artículos con cambios sin subir llevan la marca amarilla *Cambios sin publicar* y se pueden descartar.
- **Guía para escribir:** debajo de los artículos hay cinco ejemplos (texto, fotos, datos y medios, una review y una crónica de viaje). Cada función está usada y explicada en el propio texto. No se publican en el sitio.
- **Panel:** artículos publicados y borradores, palabras, fotos, peso del contenido frente al límite de GitHub Pages, ritmo de publicación por mes, artículos por sección, revisión editorial (texto alternativo, descripción para Google, foto principal, avisos), artículos más pesados, actividad reciente, estado de la última publicación y enlaces útiles. **Tráfico** (visitas de hoy, 7 días, 30 días y un año, y lo más leído) con **GoatCounter**, gratuito y de código abierto: en *Configurar estadísticas* se escribe el código de la cuenta y una llave de solo lectura.

### Escribir como en Word

- **Barra de formato (cinta):** deshacer y rehacer, caja de **Estilo** (Párrafo, Título, Subtítulo, Lista con viñetas, Lista numerada, Cita destacada, Recuadro de texto), negrita, cursiva, enlace, quitar enlace, listas, alinear a la izquierda o centrar, **Insertar**, **Reemplazar** y el contador de palabras con el tiempo de lectura. El botón **?** muestra todos los atajos.
- **Lo que ves es lo que sale:** la negrita, la cursiva y los enlaces se ven tal cual mientras escribes.
- **Todo el formato está en la barra de arriba**, como en Word, y funciona en cualquier texto de la página: párrafos, descripciones de fotos y de la portada, subtítulo, autores de citas, títulos de desplegables, fichas y datos. El panel de la derecha no tiene botones de formato. El título del artículo y el texto de los botones no llevan formato.
- **Ancho libre:** al pasar el cursor por cualquier bloque (párrafo, título, lista, recuadro, desplegable, cita, botón, línea, datos en fila, fila de fotos, video, mapa, ficha) aparecen dos barras rosas a los lados; arrástralas para cambiar su ancho. En fichas y citas flotantes, la barra del lado interior cambia su ancho. Los bordes se pegan a los márgenes de las fotos, a los de la columna de texto (y siguen alineados con ella en cualquier pantalla), al centro y a los bordes de todos los demás elementos (otros párrafos, cada foto, recuadros, fichas…); doble clic en una barra devuelve el ancho normal. En celular vuelve a la columna normal.
- **El panel dice qué bloque es:** al seleccionar un bloque, el panel muestra su nombre, para qué sirve y cómo se agrega uno igual.
- **Teclado:** Enter crea un párrafo nuevo; Shift+Enter, un salto de línea; Retroceso al inicio une con el bloque de arriba y Supr al final con el de abajo; las flechas pasan de un bloque a otro. Ctrl+B, Ctrl+I, Ctrl+K (enlace), Ctrl+Alt+1 y 2 (título y subtítulo), Ctrl+Shift+N (párrafo), Ctrl+Shift+L (viñetas), Ctrl+E y Ctrl+L (centrar, izquierda), Ctrl+Z y Ctrl+Y, Ctrl+H (buscar y reemplazar).
- **Autoformato:** empieza un párrafo con «- » o «1. » y se vuelve lista; «## » título, «### » subtítulo, «> » cita; «---» y Enter dibuja una línea.
- **Pegar desde Word o Google Docs:** conserva títulos, listas (también las de Word), negritas, cursivas y enlaces; cada párrafo queda en su bloque. Pegar una imagen la agrega como foto.
- **Clic debajo del último bloque:** sigues escribiendo al final, como en una hoja.

### Bloques (estilo Squarespace)

Se agregan con **Insertar** o con el botón **+** entre bloques; se reordenan arrastrando el asa de la izquierda y tienen botones para subir, bajar, duplicar y eliminar.

- **Texto:** párrafo, título, subtítulo, lista con viñetas, lista numerada, cita destacada (con autor opcional), **recuadro de texto** (fondo gris, sin fondo, amarillo, rojo o verde; marco sí o no; línea a la izquierda que cambia de color con cada clic: rosa, amarillo, verde, rojo o ninguna; el texto nunca se mueve al cambiarlos) y **desplegable** (pregunta y respuesta que se abre con un clic).
- **Fotos y video:** foto (normal, a ancho de pantalla o panorámica deslizable con altura que se arrastra), **mosaico de fotos**, **video de YouTube** (miniatura; el video carga solo al hacer clic) y **mapa** (pega un enlace de Google Maps; se muestra con OpenStreetMap, sin cuentas ni rastreo).
- **Diseño:** **datos en fila** (lugar, distancia, dificultad…, en cualquier parte del artículo), **botón** (principal o secundario, a la izquierda o centrado), **línea separadora**, **espacio en blanco** (altura arrastrando la barra rosa), ficha de datos y **código HTML** para casos especiales.
- **Colores para advertir o destacar:** recuadros y fichas en gris, sin fondo, amarillo (advertencia), rojo (importante) o verde (consejo).
- **Cabecera libre:** foto grande con el título encima, título arriba y la foto debajo, o solo el título.
- **Fotos:** arrástralas a la página o usa el **+**. El editor las redimensiona, quita los datos de ubicación y guarda los originales en la carpeta `originals` (no se suben a GitHub).
- **Portada:** siempre 16:9, y el marco del editor muestra exactamente el recorte que se guarda. Con los botones + y − sobre la foto (o «Acercar la portada» en el panel) se acerca hasta 300 %, y se arrastra para elegir el recorte y la posición, desde cualquier computadora o desde la web: el editor guarda una copia completa de la foto (`hero-source.jpg`, máximo 2600 px) en la carpeta del artículo. Avisa si el recorte queda con poca resolución. Si dos artículos comparten la carpeta de imágenes (como las guías y Caprock), cada uno guarda su portada con su propio nombre (`hero-<artículo>`): cambiar una no cambia la otra.
- **Descartar cambios** (editor web): borra del navegador los cambios sin publicar del artículo y las fotos que solo él usaba.
- **Cabecera:** foto grande con el título encima (como en el sitio), foto grande con el título debajo, título arriba y la foto debajo, o solo el título.
- **Tamaño:** toda la interfaz del editor se muestra al 90 %.
- **Tamaño de las fotos, como en Word:** al seleccionar una foto aparecen cuadritos rosas en sus bordes: los lados cambian el ancho, arriba y abajo el alto (el recorte), las esquinas ambos. Los bordes se pegan a los de las otras fotos (también a cada foto de una fila), a los márgenes y a la columna de texto. En una foto flotante, el cuadrito del lado interior da el ancho exacto. Las filas de fotos también tienen barras a los lados para su ancho, y las barras entre fotos se pegan a los bordes de otras fotos.
- **Debajo de la cabecera, como en el sitio:** el subtítulo y la línea «Por (autor) · fecha · minutos de lectura», que se arma sola con el autor y la fecha de la pestaña Artículo.
- **Recorte libre:** arrastra la foto para encuadrarla; arrastra la barra inferior para hacerla más alta o más baja; o elige una proporción (3:2, 16:9, 1:1…). Una foto sola siempre mide el ancho completo.
- **Mosaicos de fotos:** dos o más fotos juntas, en una fila o en filas y columnas, que suman exactamente el ancho de una foto sola (o el de la pantalla). Se arman arrastrando: una foto soltada sobre otra entra a su izquierda, a su derecha, encima o debajo, según el lado; cerca del borde de arriba o de abajo del mosaico, en una fila nueva sobre o bajo todas. Una línea rosa muestra dónde quedará. Las barras rosas entre fotos reparten el tamaño. Cada foto tiene una manija ✥ para llevarla a otro lugar.
- **Arrastrar fotos de la página:** con su manija ✥, sobre otra foto (mosaico), a un lado de un párrafo (flota de ese lado) o al centro entre dos bloques (su propia fila).
- **Ajuste del texto (como Word):** una foto, una cita o una ficha puede ir *en su propia fila* o *flotar a la izquierda o a la derecha*; el texto que va **debajo** de ella la rodea y luego vuelve a todo el ancho. El **+** que aparece bajo una foto flotante agrega debajo de ella, no a su lado. Si no hay texto debajo, el editor lo avisa y ofrece subirla un párrafo. Dos elementos flotantes nunca quedan uno al lado del otro. Una foto flotante también puede llegar al borde de la pantalla arrastrando su barra rosa.
- **Fichas de datos:** cuadro con título, enlace opcional, foto opcional y datos. En su propia fila, el cuadro mide lo mismo que una foto y el texto de adentro se alinea con los párrafos; en celular va de borde a borde.
- **Portada:** siempre 16:9. Arrastra para encuadrar.
- **Texto alternativo:** el editor te lo pide para cada foto (marcado en rojo) y avisa antes de publicar, igual que si falta la dirección de un botón, el enlace de un video o el lugar de un mapa.
- **Vista previa:** construye el artículo real con Eleventy y lo muestra tal cual saldrá.
- **Traer cambios de GitHub:** guarda primero tus borradores y nunca los mezcla con los de otra persona; si alguien cambió el mismo artículo, cancela y te avisa.
- **Publicar:** envía los cambios a GitHub (rama `source`). Allí, una automatización (GitHub Actions) construye el sitio con Eleventy y lo publica sola en unos 2 minutos.

## Limitaciones actuales

- **Inicio y secciones se arman solos:** al publicar, Eleventy pone el artículo más reciente arriba en el inicio, los siguientes en «Últimos artículos», dos por sección, y la lista completa en la página de su sección (Viajes, Bici…), con su portada, título, subtítulo y firma. También entra al buscador y al mapa del sitio para Google (`sitemap.xml`). Los **borradores** se publican en su dirección pero no aparecen en el inicio, las secciones ni el buscador; las guías no se publican.
- Solo español por ahora (la versión en inglés llegará con las páginas bilingües).
- Las listas tienen un solo nivel (sin subpuntos) y no hay texto en dos columnas.
- No se puede seleccionar texto de varios bloques a la vez (por ejemplo, para borrar tres párrafos de un golpe): se borra bloque por bloque o con el botón de eliminar.
- Del ajuste de texto de Word solo existen el "Cuadrado" (izquierda o derecha) y "Arriba y abajo"; "Estrecho" o "Detrás del texto" dejarían el texto ilegible en una página web.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `site` | copia del sitio (rama de trabajo). Se crea sola. |
| `originals` | tus fotos originales, sin tocar. No se suben. |
| `public`, `lib`, `server.js` | el editor (`public/js/`: la interfaz; `public/canvas/`: la página del artículo, dentro de un iframe) |

Opciones avanzadas en `config.json` (opcional): `port`, `repo`, `sourceBranch`, `sitePath`, `author`, `credit`.

## Varias personas

Cada persona instala su propio editor (esta carpeta) y necesita su cuenta de GitHub con permiso de escritura en el repositorio `relieve` (Settings → Collaborators). No comparten contraseñas. Un colaborador puede cambiar todo el sitio, así que invita solo a quien confíes.

## Para quien programa

- **Código:** `public/app.js` arranca el editor; cada parte está en un módulo de `public/js/` (estado, deshacer y guardar, cinta, panel, fotos, mosaicos, publicar, acceso, panel de estadísticas) y la página del artículo en `public/canvas/` (dibujo, texto, arrastre, tamaños). La primera línea de cada archivo dice qué hace. `public/js/mosaic.js` es puro (sin página ni estado) y tiene pruebas propias. Formato: Prettier (`.prettierrc.json` en la raíz; `cd tests && npm run formato` lo aplica). Una prueba exige ese formato y que cada módulo use solo lo que declara o importa (nada que sobre ni que falte), para que el orden no se pierda con los cambios.
- **Pruebas** (carpeta `tests/` del repositorio): `cd tests && npm install && npx playwright install chromium && npm test`. Prueban que todos los artículos se leen y se escriben sin perder nada, el armado de los mosaicos, y el editor web en un navegador de verdad contra un GitHub simulado (escribir, deshacer, publicar, fotos, mosaicos, arrastre…). Las pruebas de dibujo comparan la página y el panel con archivos de referencia (`tests/editor/snapshots/`); si un cambio es a propósito, se escriben de nuevo con `UPDATE_SNAPSHOTS=1 npm test` y se revisa la diferencia en Git. En GitHub corren en cada cambio y **antes de publicar**: si fallan, el sitio no se publica.
- **Versiones:** al publicar, `.github/scripts/version-editor.mjs` pone a cada archivo del editor web el número de versión (`?v=…`) y escribe `version.txt`; el editor avisa cuando hay una versión más nueva en línea.
- **Errores:** un error que nadie atrapa (en el editor o en la página del artículo) aparece en un recuadro rojo con «Copiar detalles».
