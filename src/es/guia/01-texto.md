---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Guía 1 · Escribir y dar formato al texto"
subtitle: "Todo lo que se puede hacer con palabras: títulos, listas, recuadros, desplegables, botones y más."
description: "Guía del editor de RELIEVE: formato de texto."
date: 2026-10-21
author: Daniel
credit: Foto de portada de Pexels, solo para esta guía
draft: true
imgBase: /assets/img/guia-texto/
hero:
  file: hero
  w: 2560
  h: 1440
  srcW: 3736
  srcH: 2097
  pos: 50% 50%
  alt: Montaña con las cumbres nevadas sobre un bosque de pinos que se extiende hasta el horizonte, bajo un cielo azul con nubes finas.
  caption: Foto de portada de ejemplo.
---
Esta es una **guía de ejemplo**: cada bloque explica cómo se hizo. Puedes tocar todo sin miedo; para ver el resultado como lo verá el lector, pulsa **Vista previa**. Las guías no se publican en el sitio.

Escribir funciona como en Word: **Enter** crea un párrafo nuevo, **Shift + Enter** hace un salto de línea dentro del mismo párrafo,<br>como este. **Backspace** al inicio de un párrafo lo une con el de arriba y **Supr** al final lo une con el de abajo. Las flechas pasan de un bloque a otro.

## Esto es un título

Los títulos ordenan el artículo. Para crear uno, escribe «## » al empezar un párrafo, usa **Ctrl + Alt + 1** o elige *Título* en la caja de **Estilo** de la barra de arriba. Todo título empieza debajo de las fotos flotantes.

### Y esto es un subtítulo

Un nivel más pequeño: «### », **Ctrl + Alt + 2** o *Subtítulo* en la caja de Estilo. Para volver a un párrafo normal: **Ctrl + Shift + N**.

## Negrita, cursiva y enlaces

Selecciona texto y pulsa **N** (negrita, Ctrl + B), **K** (cursiva, Ctrl + I) o el botón de cadena (enlace, Ctrl + K) en la barra de arriba. Funciona en cualquier texto de la página: párrafos, descripciones de fotos, autores de citas, fichas y datos. Así se ve: texto en **negrita**, texto en *cursiva* y un [enlace a Parques de Texas](https://tpwd.texas.gov). Para cambiar un enlace, pon el cursor dentro y vuelve a pulsar el botón de cadena; para quitarlo, usa el botón de cadena tachada.

## Listas

Escribe «- » al empezar un párrafo y se vuelve una lista con viñetas. Enter agrega otro punto; Enter en un punto vacío sale de la lista.

- Agua: al menos **4 litros** por persona
- Protector solar y sombrero
- Mapa sin conexión

Con «1. » sale una lista numerada:

1. Reserva el campamento
2. Revisa el clima la noche anterior
3. Avisa a alguien de tu ruta

## Citas destacadas

Una frase importante, grande, con el autor opcional debajo. Insertar → *Cita destacada* (o «> » al empezar un párrafo). El autor se escribe en la línea pequeña de abajo.

{% cita "", "Guardaparques de Caprock Canyons" %}El cañón se entiende mejor caminando despacio.{% endcita %}

Una cita también puede flotar a un lado y dejar que el texto la rodee: selecciónala y elige *Flotar a la derecha* en el panel. El texto que la rodea es el que va **debajo** de ella; si la mueves debajo del último párrafo de una sección, el editor te avisa y te ofrece subirla.

## Recuadros de texto

Un recuadro resalta un consejo, un dato o una advertencia. Insertar → *Recuadro de texto*. Dentro puede haber varios párrafos, negritas y enlaces. Su aspecto tiene tres partes independientes, y ninguna mueve el texto: el **fondo** (gris, sin fondo, amarillo, rojo o verde), el **marco** (sí o no) y la **línea** de la izquierda. La línea cambia de color con cada clic en el borde izquierdo del recuadro: rosa, amarillo, verde, rojo y sin línea.

{% recuadro "gris" %}
**Fondo gris:** para datos de contexto o una nota al margen.
{% endrecuadro %}

{% recuadro "sin-fondo marco" %}
**Sin fondo, con marco:** más discreto, para una aclaración.
{% endrecuadro %}

{% recuadro "gris linea-rosa" %}
**Línea rosa:** el color de la revista, para un consejo del autor. Haz clic en la línea para cambiarle el color.
{% endrecuadro %}

{% recuadro "amarillo marco" %}
**Amarillo con marco, advertencia:** algo que el lector debe tener en cuenta, como un tramo peligroso o un horario.
{% endrecuadro %}

{% recuadro "rojo linea-rojo" %}
**Rojo, importante:** prohibiciones, riesgos serios o un aviso que no puede pasar desapercibido.
{% endrecuadro %}

{% recuadro "verde" %}
**Verde, consejo:** para llamar la atención sobre algo bueno: una recomendación, un dato útil, un descuento.
{% endrecuadro %}

## Ancho libre del texto

Al pasar el cursor por un párrafo, título, lista o recuadro aparecen dos barras rosas a sus lados. Arrástralas para hacer el bloque más angosto o más ancho, hasta los márgenes del contenido (el ancho de las fotos). Al acercarte, el borde se pega a los márgenes de las fotos, a los de la columna de texto, al centro y a los bordes de cualquier otro elemento: otros párrafos, fotos (también cada foto de una fila), recuadros, fichas, citas, datos, videos y mapas. Un borde pegado a la columna de texto sigue alineado con ella en cualquier pantalla. Todos los bloques tienen estas barras, aunque cada uno empiece con su ancho normal. Doble clic en una barra devuelve el bloque al ancho normal. En celular todo vuelve a la columna normal.

{% caja "0 texto" %}
Este párrafo empieza en el margen izquierdo de las fotos y termina donde termina la columna de texto. Sirve para dar aire a una página, alinear un texto con una foto o armar un artículo menos rígido.
{% endcaja %}

{% caja "38 100" %}
Y este otro se pega al margen derecho. Al pulsar Enter al final de un párrafo con ancho libre, el párrafo nuevo conserva el mismo ancho, como en Word.
{% endcaja %}

## Desplegables

Pregunta y respuesta que el lector abre con un clic. Varios seguidos forman una lista de preguntas frecuentes. Insertar → *Desplegable*: escribe la pregunta en la línea gruesa y la respuesta debajo.

{% desplegable "¿Hay que pagar entrada?" %}
Sí, unos **5 dólares** por adulto. Menores de 12 años, gratis.
{% enddesplegable %}

{% desplegable "¿Se puede ir con perro?" %}
Sí, con correa en todos los senderos.
{% enddesplegable %}

## Texto centrado

{% centrado %}
Un párrafo o un título se pueden centrar con el botón de alineación de la barra (o **Ctrl + E**; **Ctrl + L** lo vuelve a la izquierda).
{% endcentrado %}

## Botones

Un enlace grande y visible, por ejemplo para reservar o comprar. Insertar → *Botón*: el texto se escribe en la página; la dirección, el estilo (rosa o con borde) y la alineación, en el panel.

{% boton "Botón principal", "https://tpwd.texas.gov", "primario", "centro" %}

{% boton "Botón secundario", "https://tpwd.texas.gov", "secundario" %}

## Separadores y espacio

Una línea separa dos partes del artículo. Se inserta con Insertar → *Línea separadora*, o escribiendo «---» y Enter.

{% separador %}

Debajo de este párrafo hay un **espacio en blanco**. Su altura se cambia arrastrando la barra rosa que aparece debajo al pasar el cursor, o con el control del panel.

{% espacio "4" %}

## Pegar desde Word o Google Docs

Si ya escribiste el artículo en otro programa, cópialo y pégalo aquí: los títulos, listas, negritas, cursivas y enlaces se conservan, y cada párrafo queda en su propio bloque. Si pegas una imagen, se agrega como foto.

{% recuadro "verde" %}
**Atajos:** el botón **?** de la barra muestra todos los atajos de teclado. **Ctrl + H** busca y reemplaza en todo el artículo. **Ctrl + Z** deshace cualquier cosa.
{% endrecuadro %}
