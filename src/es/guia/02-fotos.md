---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Guía 2 · Fotos, mosaicos y panorámicas"
subtitle: "Todas las formas de mostrar una foto, y cómo hacer que el texto las rodee."
description: "Guía del editor de RELIEVE: fotos."
date: 2026-10-22
author: Daniel
credit: Fotos de Pexels, solo para esta guía
draft: true
imgBase: /assets/img/guia-fotos/
hero:
  file: hero
  w: 2560
  h: 1440
  srcW: 5272
  srcH: 2962
  pos: 50% 50%
  alt: Vista aérea de un volcán de laderas verdes que se eleva sobre un lago y un pueblo, bajo un cielo azul con nubes finas.
  caption: Foto de portada de ejemplo.
photos:
  pano1:
    file: volcan-pano
    w: 3600
    h: 699
    focus: 50
    alt: Franja panorámica de un volcán de laderas azuladas con nubes cerca de la cima, vista desde el aire.
    caption: El volcán, en formato panorámico.
  agujas:
    file: plaza
    w: 2576
    h: 1682
    ratio: 2
    alt: Plaza peatonal con grandes sombrillas de tela blanca, gente caminando y, al fondo, una iglesia blanca con torre y cúpula.
    caption: Una plaza con sombrillas de tela y una iglesia blanca al fondo.
  noche:
    file: atardecer-salto
    w: 2600
    h: 1733
    alt: Un niño salta al agua al atardecer con botes a lo lejos y otros bañistas en el agua, bajo un cielo anaranjado.
    caption: Un salto al agua a la hora dorada.
  capas:
    file: cumbres-nevadas
    w: 1500
    h: 2000
    alt: Vista aérea de montañas de roca oscura con nieve y glaciares en las laderas.
    caption: Desde arriba, la montaña se lee por capas.
  pano2:
    file: esquina-pano
    w: 2000
    h: 855
    focus: 50
    alt: Esquina de un edificio antiguo de pintura rosa descascarada y rejas negras, junto a una avenida con carros y montañas al fondo.
    caption: La esquina completa, de borde a borde.
  autor:
    file: calle-catedral
    w: 1717
    h: 2576
    alt: Calle colonial estrecha con balcones de madera, fachadas de colores y la torre rosada de una catedral al fondo; unas personas caminan por la calle.
    caption: Una calle colonial que termina en la torre de la catedral.
  cresta:
    file: bosque-pano
    w: 2576
    h: 732
    focus: 55
    alt: Franja panorámica de un bosque de pinos que se extiende hasta una montaña con las cumbres nevadas, bajo un cielo azul.
    caption: El bosque y la montaña, de lado a lado.
---
Las fotos se agregan con Insertar → *Foto…*, con el botón **+** entre bloques, arrastrándolas desde la computadora o pegándolas. El editor las achica, quita la ubicación GPS y pide un **texto alternativo** (la descripción para personas que no ven la foto y para Google).

## Una foto normal

Una foto sola mide, de entrada, el ancho de la columna de fotos. Para encuadrarla, arrástrala con el mouse. Al seleccionarla aparecen cuadritos rosas en sus bordes, como en Word: los de los lados cambian el ancho, los de arriba y abajo el alto (el recorte) y los de las esquinas las dos cosas. Al acercarte, los bordes se pegan a los de las otras fotos (también a cada foto de una fila), a los márgenes y a la columna de texto. También puedes elegir una proporción en el panel (3:2, 16:9, 1:1…).

{% foto "agujas" %}

## Ancho de pantalla

La misma foto, de borde a borde de la pantalla y entera. En el panel: *Presentación de la foto* → **Ancho de pantalla**.

{% pano "noche", "completa" %}

## Panorámica deslizable

Para fotos muy anchas: ocupa todo el ancho con una altura limitada y el lector la desliza con el dedo o el mouse. En el panel: **Panorámica deslizable**. La altura se cambia arrastrando la barra rosa de abajo o con el control *Altura*; *Punto de inicio* elige qué parte se ve primero.

{% pano "cresta", "", "45" %}

## Mosaico: dos fotos en fila

Varias fotos juntas forman un **mosaico**. Para armarlo, arrastra una foto desde tu computadora, o por su manija ✥ si ya está en la página, y suéltala sobre otra foto: entra a su izquierda, a su derecha, encima o debajo, según el lado donde la sueltes. Una línea rosa muestra dónde va a quedar antes de soltarla. En una fila, las fotos tienen el mismo alto y suman el ancho de una foto sola. Las barras rosas entre fotos reparten el espacio y se pegan a los bordes de otras fotos; la de abajo cambia la altura de todo el mosaico; las de los lados, su ancho.

{% fila "capas", "autor" %}

## Un mosaico a ancho completo

El mismo mosaico, de borde a borde: marca *Ancho completo de la pantalla* en el panel.

{% fila "agujas", "capas", "completa" %}

## Una foto alta junto a dos apiladas

Suelta una foto sobre la parte de abajo de otra foto del mosaico (no sobre el borde del mosaico): queda debajo de esa foto, y la otra queda alta a su lado. La barra rosa entre las dos fotos apiladas reparte la altura entre ellas.

{% fila "autor", ["agujas", "noche"] %}

## Cuadrícula

Una foto soltada cerca del borde de arriba o de abajo de un mosaico forma una fila nueva que ocupa todo el ancho; otra soltada a su lado la completa, y quedan dos filas de dos fotos. En el panel, *Ordenar en cuadrícula* lo hace de una vez con todas las fotos del mosaico.

{% fila [["agujas", "noche"], ["capas", "autor"]] %}

## Texto alrededor de una foto

Como el «Cuadrado» de Word. Arrastra la foto por su manija ✥ y suéltala a un lado de un párrafo, o selecciónala y elige *Flotar a la izquierda* o *a la derecha* en el panel. El tamaño se elige en el panel (pequeño, mediano o grande) o arrastrando el cuadrito rosa de su lado interior. La foto empieza al lado del párrafo que tiene debajo y el texto la rodea hasta que termina. Para agregar algo debajo de la foto, y no a su lado, usa el **+** que aparece bajo ella.

{% foto "autor", "derecha 40 fuera" %}

Este párrafo rodea la foto de la derecha. Con *Sobresale hasta el margen exterior*, la foto se alinea con el borde de las fotos normales y el texto conserva su columna. Así se puede contar algo mientras la foto acompaña, sin cortar la lectura con una foto a todo el ancho.

Sigue el texto al lado de la foto. Cuando llega un título o una foto grande, todo vuelve a ocupar el ancho completo. En celular, la foto ocupa su propia fila para que el texto no quede apretado.

## Hasta el borde de la pantalla

Una foto flotante también puede llegar hasta el borde de la pantalla: suéltala cerca del borde de la pantalla, arrastra la barra rosa que aparece en su costado hacia el borde, o marca *Hasta el borde de la pantalla*.

{% foto "capas", "izquierda 40 borde" %}

Este texto está a la derecha de una foto pegada al borde izquierdo de la pantalla. Funciona bien con fotos de detalle, texturas o paisajes donde no importa que se corte el costado.

Si arrastras la barra al otro lado de la pantalla, la foto cambia de lado.

## Varias fotos en el panel «Fotos»

La pestaña **Fotos** del panel muestra todas las fotos del artículo. Las que dicen *Sin usar* se insertan con un clic debajo del bloque seleccionado. Las que tienen *falta alt* necesitan su texto alternativo antes de publicar.
