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
credit: Fotos de Pexels, solo para esta guía
draft: true
imgBase: /assets/img/guia-cronica/
hero:
  file: hero
  w: 2560
  h: 1440
  srcW: 6000
  srcH: 4000
  pos: 50% 50%
  alt: Montaña con nieve en la cima reflejada en una laguna de páramo, con hierba y rocas en primer plano bajo un cielo nublado.
  caption: Foto de portada de ejemplo.
photos:
  ciudad:
    file: ciudad
    w: 2976
    h: 3968
    alt: Vista desde lo alto de un cerro de una ciudad entre árboles, con una cordillera bajo nubes al fondo.
    caption: La ciudad queda abajo al empezar a subir.
  costa:
    file: costa
    w: 3600
    h: 5400
    alt: Vista aérea de una franja de arena entre el mar y una laguna, con montañas detrás bajo un cielo gris.
    caption: La costa, entre el mar y la laguna.
  quebrada:
    file: quebrada
    w: 2649
    h: 1672
    alt: Valle seco entre paredes de roca rojiza, con montañas nevadas al fondo y nubes blancas en el cielo azul.
    caption: Roca roja y nieve en el mismo encuadre.
  rio:
    file: rio
    w: 3600
    h: 2700
    alt: Vista aérea de un río verde turquesa entre bancos de arena blanca, con dos coches aparcados en la orilla.
    caption: Desde el aire, el río se ve de otro color.
  valle:
    file: valle
    w: 6000
    h: 2400
    focus: 50
    alt: Panorámica de un valle verde con un pueblo entre árboles, al pie de montañas cubiertas de vegetación y nubes bajas.
    caption: El valle completo, de un lado al otro.
---
{% recuadro "borde" %}
**Cómo está hecho:** la **Cabecera** es la normal (foto grande con el título encima). Después: datos de la ruta en fila, texto con una foto flotante, un mosaico, una panorámica deslizable, un aviso amarillo, un mapa y preguntas frecuentes con desplegables. Los datos y el mapa son de ejemplo.
{% endrecuadro %}

{% datos "Tramos", "3", "Distancia", "12 km", "Duración", "4 h", "Dificultad", "Media" %}

Aquí empieza la crónica: dónde estamos, por qué vinimos y qué esperábamos. Un primer párrafo corto engancha al lector.

{% foto "ciudad", "derecha 40 fuera" %}

El texto rodea la primera foto del recorrido. Contar y mostrar al mismo tiempo mantiene el ritmo: el lector no tiene que elegir entre leer y mirar.

Más texto del primer tramo. Cuando la historia cambia de momento, un título marca el paso.

## De la costa a la montaña

{% fila "costa", ["quebrada", "rio"] %}

Un mosaico resume varias paradas con pocas fotos y sin hacer el artículo eterno.

{% pano "valle", "", "55" %}

La panorámica deslizable muestra el paisaje completo sin achicarlo: el lector la recorre con el dedo.

{% recuadro "amarillo" %}
**Antes de ir:** arriba el tiempo cambia rápido y de noche puede bajar de 0 °C. Lleva abrigo, agua y algo de comer aunque salgas con sol.
{% endrecuadro %}

## Cómo llegar

{% mapa "10.5000,-66.9000", "Punto de partida (ejemplo)", "10" %}

## Preguntas frecuentes

{% desplegable "¿Cuándo es mejor ir?" %}
En temporada seca. Con lluvia, los caminos de tierra se ponen difíciles.
{% enddesplegable %}

{% desplegable "¿Hace falta reservar?" %}
Para dormir en la montaña, sí. Para caminar de día, no.
{% enddesplegable %}

{% separador %}

{% centrado %}
*Gracias por leer. ¿Fuiste? Cuéntanos tu experiencia.*
{% endcentrado %}
