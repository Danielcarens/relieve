---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Ejemplo · Crónica de viaje"
subtitle: "Un formato posible para un viaje: foto grande, datos de la ruta, mosaico de fotos, panorámica, mapa y preguntas frecuentes."
description: "Ejemplo de crónica de viaje con el editor de RELIEVE."
date: 2026-10-25
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
{% recuadro "borde" %}
**Cómo está hecho:** la **Cabecera** es la normal (foto grande con el título encima). Después: datos de la ruta en fila, texto con una foto flotante, un mosaico, una panorámica deslizable, un aviso amarillo, un mapa y preguntas frecuentes con desplegables.
{% endrecuadro %}

{% datos "Lugar", "Caprock Canyons", "Distancia", "12 km", "Duración", "4 h", "Dificultad", "Media" %}

Aquí empieza la crónica: dónde estamos, por qué vinimos y qué esperábamos. Un primer párrafo corto engancha al lector.

{% foto "agujas", "derecha 40 fuera" %}

El texto rodea la primera foto del recorrido. Contar y mostrar al mismo tiempo mantiene el ritmo: el lector no tiene que elegir entre leer y mirar.

Más texto del primer tramo. Cuando la historia cambia de momento, un título marca el paso.

## El mirador

{% fila "autor", ["capas", "noche"] %}

Un mosaico resume una parada con varias fotos sin hacer el artículo eterno.

{% pano "pano2", "", "55" %}

La panorámica deslizable muestra el paisaje completo sin achicarlo: el lector la recorre con el dedo.

{% recuadro "amarillo" %}
**Antes de ir:** no hay agua en la ruta y en verano el calor pasa de 40 °C. Sal temprano y lleva al menos 4 litros.
{% endrecuadro %}

## Cómo llegar

{% mapa "34.41430,-101.05460", "Caprock Canyons State Park", "10" %}

## Preguntas frecuentes

{% desplegable "¿Cuándo es mejor ir?" %}
En primavera y otoño. En verano, solo temprano en la mañana.
{% enddesplegable %}

{% desplegable "¿Hace falta reservar?" %}
Para acampar, sí. Para caminar de día, basta con pagar la entrada.
{% enddesplegable %}

{% separador %}

{% centrado %}
*Gracias por leer. ¿Fuiste? Cuéntanos tu experiencia.*
{% endcentrado %}
