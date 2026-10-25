---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Guía 2 · Fotos, filas, cuadrículas y panorámicas"
subtitle: "Todas las formas de mostrar una foto, y cómo hacer que el texto las rodee."
description: "Guía del editor de RELIEVE: fotos."
date: 2026-10-22
author: Daniel
credit: Daniel Cárdenas
draft: true
imgBase: /assets/img/caprock-10-2026/
hero:
  file: hero
  w: 2560
  h: 1440
  alt: Vista panorámica de los cañones rojos de Caprock Canyons bajo un cielo con nubes finas.
  caption: Foto de portada de ejemplo.
photos:
  pano1:
    file: pano-1
    w: 6000
    h: 1165
    focus: 50
    alt: Panorámica desde el borde del cañón, con paredes de roca roja y vegetación verde que se extienden hasta el horizonte bajo un cielo azul.
    caption: Vista desde el borde del cañón.
  agujas:
    file: agujas-roca-roja
    w: 3600
    h: 2398
    ratio: 2
    alt: Muro de roca roja con dos agujas de piedra en la cima, iluminadas por la luz dorada de la tarde.
    caption: Dos agujas de roca coronan uno de los muros del cañón.
  noche:
    file: tips-noche
    w: 3600
    h: 2398
    alt: Letrero iluminado de una licorería de noche, con niebla y reflejos rojos de neón sobre el asfalto mojado.
    caption: Luces de neón en una noche de niebla.
  capas:
    file: capas-roca-detalle
    w: 3600
    h: 2398
    alt: Detalle de capas de roca roja erosionada con una franja blanca.
    caption: A pocos centímetros, la roca se lee por capas.
  pano2:
    file: pano-2
    w: 6000
    h: 2569
    focus: 50
    alt: Vista panorámica de los cañones rojos de Caprock Canyons bajo un cielo con nubes finas, con árboles y arbustos en primer plano.
    caption: El cañón completo, de borde a borde.
  autor:
    file: autorretrato-mirador
    w: 3600
    h: 2398
    alt: Daniel sonriendo en un mirador, con gafas sobre la gorra y una mochila con trípode, con el cañón rojo detrás.
    caption: Un alto en el mirador.
  cresta:
    file: cresta-anochecer-pano
    w: 6000
    h: 1702
    focus: 55
    alt: Siluetas negras de las crestas del cañón al anochecer, con dos árboles sin hojas contra un cielo azul oscuro.
    caption: Las crestas al anochecer.
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

## Dos fotos en fila

Varias fotos juntas tienen el mismo alto y suman el ancho de una foto sola. Selecciona una foto y pulsa *Poner junto a la siguiente foto*. La barra rosa de abajo cambia la altura de la fila; las barras entre fotos reparten el ancho y se pegan a los bordes de otras fotos; las barras de los lados cambian el ancho de toda la fila.

{% fila "capas", "autor" %}

## Una fila a ancho completo

La misma fila, de borde a borde: marca *Ancho completo de la pantalla* en el panel.

{% fila "agujas", "capas", "completa" %}

## Mosaico: una foto alta junto a dos apiladas

En una fila, selecciona una foto y pulsa *Apilar con la foto de la derecha*: quedan una encima de la otra.

{% fila "autor", ["agujas", "noche"] %}

## Cuadrícula

*Ordenar todas en cuadrícula* reparte las fotos de la fila en filas de N columnas.

{% fila [["agujas", "noche"], ["capas", "autor"]] %}

## Texto alrededor de una foto

Como el «Cuadrado» de Word. Selecciona la foto y elige *Flotar a la izquierda* o *a la derecha*, y un tamaño (pequeño, mediano o grande), o arrastra el cuadrito rosa de su lado interior para darle el ancho exacto. La foto empieza al lado del párrafo que tiene debajo y el texto la rodea hasta que termina.

{% foto "autor", "derecha 40 fuera" %}

Este párrafo rodea la foto de la derecha. Con *Sobresale hasta el margen exterior*, la foto se alinea con el borde de las fotos normales y el texto conserva su columna. Así se puede contar algo mientras la foto acompaña, sin cortar la lectura con una foto a todo el ancho.

Sigue el texto al lado de la foto. Cuando llega un título o una foto grande, todo vuelve a ocupar el ancho completo. En celular, la foto ocupa su propia fila para que el texto no quede apretado.

## Hasta el borde de la pantalla

Una foto flotante también puede llegar hasta el borde de la pantalla: arrastra la barra rosa que aparece en su costado hacia el borde, o marca *Hasta el borde de la pantalla*.

{% foto "capas", "izquierda 40 borde" %}

Este texto está a la derecha de una foto pegada al borde izquierdo de la pantalla. Funciona bien con fotos de detalle, texturas o paisajes donde no importa que se corte el costado.

Si arrastras la barra al otro lado de la pantalla, la foto cambia de lado.

## Varias fotos en el panel «Fotos»

La pestaña **Fotos** del panel muestra todas las fotos del artículo. Las que dicen *Sin usar* se insertan con un clic debajo del bloque seleccionado. Las que tienen *falta alt* necesitan su texto alternativo antes de publicar.
