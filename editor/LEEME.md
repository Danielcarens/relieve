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
- **Ancho libre:** al pasar el cursor por un párrafo, título, lista, recuadro, desplegable o datos en fila aparecen dos barras rosas a los lados; arrástralas para cambiar su ancho. Los bordes se pegan a los márgenes de las fotos, a los de la columna de texto (y siguen alineados con ella en cualquier pantalla) y al centro; doble clic en una barra devuelve el ancho normal. En celular vuelve a la columna normal.
- **El panel dice qué bloque es:** al seleccionar un bloque, el panel muestra su nombre, para qué sirve y cómo se agrega uno igual.
- **Teclado:** Enter crea un párrafo nuevo; Shift+Enter, un salto de línea; Retroceso al inicio une con el bloque de arriba y Supr al final con el de abajo; las flechas pasan de un bloque a otro. Ctrl+B, Ctrl+I, Ctrl+K (enlace), Ctrl+Alt+1 y 2 (título y subtítulo), Ctrl+Shift+N (párrafo), Ctrl+Shift+L (viñetas), Ctrl+E y Ctrl+L (centrar, izquierda), Ctrl+Z y Ctrl+Y, Ctrl+H (buscar y reemplazar).
- **Autoformato:** empieza un párrafo con «- » o «1. » y se vuelve lista; «## » título, «### » subtítulo, «> » cita; «---» y Enter dibuja una línea.
- **Pegar desde Word o Google Docs:** conserva títulos, listas (también las de Word), negritas, cursivas y enlaces; cada párrafo queda en su bloque. Pegar una imagen la agrega como foto.
- **Clic debajo del último bloque:** sigues escribiendo al final, como en una hoja.

### Bloques (estilo Squarespace)

Se agregan con **Insertar** o con el botón **+** entre bloques; se reordenan arrastrando el asa de la izquierda y tienen botones para subir, bajar, duplicar y eliminar.

- **Texto:** párrafo, título, subtítulo, lista con viñetas, lista numerada, cita destacada (con autor opcional), **recuadro de texto** (fondo gris, sin fondo, amarillo, rojo o verde; marco sí o no; línea a la izquierda que cambia de color con cada clic: rosa, amarillo, verde, rojo o ninguna; el texto nunca se mueve al cambiarlos) y **desplegable** (pregunta y respuesta que se abre con un clic).
- **Fotos y video:** foto (normal, a ancho de pantalla o panorámica deslizable con altura que se arrastra), fila o cuadrícula de fotos, **video de YouTube** (miniatura; el video carga solo al hacer clic) y **mapa** (pega un enlace de Google Maps; se muestra con OpenStreetMap, sin cuentas ni rastreo).
- **Diseño:** **datos en fila** (lugar, distancia, dificultad…, en cualquier parte del artículo), **botón** (principal o secundario, a la izquierda o centrado), **línea separadora**, **espacio en blanco** (altura arrastrando la barra rosa), ficha de datos y **código HTML** para casos especiales.
- **Colores para advertir o destacar:** recuadros y fichas en gris, sin fondo, amarillo (advertencia), rojo (importante) o verde (consejo).
- **Cabecera libre:** foto grande con el título encima, título arriba y la foto debajo, o solo el título.
- **Fotos:** arrástralas a la página o usa el **+**. El editor las redimensiona, quita los datos de ubicación y guarda los originales en la carpeta `originals` (no se suben a GitHub).
- **Portada:** siempre 16:9. Si la foto elegida no es 16:9, se arrastra para encuadrarla, desde cualquier computadora o desde la web: el editor guarda una copia completa de la foto (`hero-source.jpg`, máximo 2600 px) en la carpeta del artículo.
- **Recorte libre:** arrastra la foto para encuadrarla; arrastra la barra inferior para hacerla más alta o más baja; o elige una proporción (3:2, 16:9, 1:1…). Una foto sola siempre mide el ancho completo.
- **Filas y cuadrículas de fotos:** dos o más fotos juntas con el mismo alto, que suman exactamente el ancho de una foto sola; también apiladas en vertical (mosaicos y cuadrículas) y a ancho completo de pantalla.
- **Ajuste del texto (como Word):** una foto, una cita o una ficha puede ir *en su propia fila* o *flotar a la izquierda o a la derecha*; el texto que va **debajo** de ella la rodea y luego vuelve a todo el ancho. Si no hay texto debajo, el editor lo avisa y ofrece subirla un párrafo. Dos elementos flotantes nunca quedan uno al lado del otro. Una foto flotante también puede llegar al borde de la pantalla arrastrando su barra rosa.
- **Fichas de datos:** cuadro con título, enlace opcional, foto opcional y datos. En su propia fila, el cuadro mide lo mismo que una foto y el texto de adentro se alinea con los párrafos; en celular va de borde a borde.
- **Portada:** siempre 16:9. Arrastra para encuadrar.
- **Texto alternativo:** el editor te lo pide para cada foto (marcado en rojo) y avisa antes de publicar, igual que si falta la dirección de un botón, el enlace de un video o el lugar de un mapa.
- **Vista previa:** construye el artículo real con Eleventy y lo muestra tal cual saldrá.
- **Traer cambios de GitHub:** guarda primero tus borradores y nunca los mezcla con los de otra persona; si alguien cambió el mismo artículo, cancela y te avisa.
- **Publicar:** envía los cambios a GitHub (rama `eleventy-prueba`). Allí, una automatización (GitHub Actions) construye el sitio con Eleventy y lo publica sola en unos 2 minutos.

## Limitaciones actuales

- Las portadas de Inicio y de cada sección (`index.html`, `viajes.html`…) todavía se editan a mano: un artículo nuevo ya existe en su dirección, pero no aparece listado en esas páginas hasta que pasen a Eleventy.
- Solo español por ahora (la versión en inglés llegará con las páginas bilingües).
- Las listas tienen un solo nivel (sin subpuntos) y no hay texto en dos columnas.
- No se puede seleccionar texto de varios bloques a la vez (por ejemplo, para borrar tres párrafos de un golpe): se borra bloque por bloque o con el botón de eliminar.
- Del ajuste de texto de Word solo existen el "Cuadrado" (izquierda o derecha) y "Arriba y abajo"; "Estrecho" o "Detrás del texto" dejarían el texto ilegible en una página web.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `site` | copia del sitio (rama de trabajo). Se crea sola. |
| `originals` | tus fotos originales, sin tocar. No se suben. |
| `public`, `lib`, `server.js` | el editor |

Opciones avanzadas en `config.json` (opcional): `port`, `repo`, `sourceBranch`, `sitePath`, `author`, `credit`.

## Varias personas

Cada persona instala su propio editor (esta carpeta) y necesita su cuenta de GitHub con permiso de escritura en el repositorio `relieve` (Settings → Collaborators). No comparten contraseñas. Un colaborador puede cambiar todo el sitio, así que invita solo a quien confíes.
