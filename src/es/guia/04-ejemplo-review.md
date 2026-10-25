---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: reviews
title: "Ejemplo · Review de una bici"
subtitle: "Un formato posible para una prueba de producto: portada de borde a borde, datos clave, ficha técnica, pros y contras, y veredicto."
description: "Ejemplo de review con el editor de RELIEVE."
date: 2026-10-24
author: Daniel
credit: Fotos de ejemplo de la marca, solo para esta guía
draft: true
imgBase: /assets/img/guia-review/
hero:
  file: hero
  w: 2560
  h: 1440
  srcW: 1600
  srcH: 900
  pos: 50% 50%
  alt: Bicicleta de enduro blanca con detalles amarillos, vista de lado, apoyada en un bosque de pinos oscuro.
  caption: La bici de la prueba, en su terreno.
photos:
  perfil:
    file: perfil
    w: 800
    h: 533
    alt: Bicicleta de enduro blanca y amarilla de perfil, sobre un camino de grava con árboles detrás.
  curva:
    file: curva
    w: 640
    h: 388
    alt: Ciclista con casco integral inclinado en una curva de tierra, en una ladera dorada al atardecer.
    caption: En las curvas rápidas se siente plantada.
  rocas:
    file: rocas
    w: 1260
    h: 840
    alt: Ciclista bajando por una sección de rocas grandes entre árboles.
    caption: Las rocas sueltas, su terreno favorito.
  transmision:
    file: transmision
    w: 2859
    h: 1608
    ratio: 1.5
    alt: Detalle de la transmisión de una bicicleta dorada, con el desviador trasero, la cadena y el plato.
    caption: Transmisión de 12 velocidades.
  laguna:
    file: laguna
    w: 1280
    h: 719
    alt: Laguna de agua azul oscura rodeada de pinos y montañas, con nubes blancas sobre las cimas.
    caption: La laguna, al final de la subida.
  sierra:
    file: sierra
    w: 679
    h: 452
    alt: Vista aérea de una sierra dorada al atardecer, con un camino de tierra que sube en zigzag por la ladera.
    caption: El camino de tierra que sube a la sierra.
fichas:
  specs:
    title: "[Especificaciones](https://example.com)"
    tone: gris
    format: tabla
    photo: perfil
    rows:
      - { label: Recorrido, value: "160 / 170 mm" }
      - { label: Cuadro, value: "Carbono" }
      - { label: Ruedas, value: "29 pulgadas" }
      - { label: Peso, value: "15,8 kg (talla L)" }
      - { label: Precio, value: "**6.999 USD**" }
---
{% recuadro "sin-fondo marco linea-rosa" %}
**Cómo está hecho:** la portada es la de siempre, de borde a borde y en 16:9 (en la pestaña *Artículo*, **Cabecera** → «Foto grande con el título encima»). Debajo van los datos clave en fila, la ficha técnica flotando a la derecha del texto, fotos en fila, una cita y una foto que flotan, dos recuadros (verde y rojo) para lo bueno y lo malo, y un veredicto centrado con un botón. Las fotos son de la marca y sirven solo para esta guía: en un artículo publicado usa fotos tuyas o con permiso.
{% endrecuadro %}

{% datos "Uso", "Enduro", "Recorrido", "170 mm", "Peso", "15,8 kg", "Precio", "6.999 USD" %}

{% ficha "specs", "derecha 40 fuera" %}

Durante tres meses usamos esta bici en senderos rápidos y técnicos. Aquí iría la introducción de la prueba: qué es, para quién es y en qué terreno se probó.

El segundo párrafo puede hablar de la geometría y de las primeras impresiones. Fíjate cómo la ficha técnica acompaña al texto sin cortar la lectura. El título y los datos de la ficha se escriben directamente en ella, y el título lleva un enlace hecho con el botón de la barra de arriba.

## En la bajada

Una sección con título para cada parte de la prueba. Los títulos siempre empiezan debajo de las fichas y fotos flotantes.

{% fila "curva", "rocas" %}

{% caja "0 62" %}
Este párrafo tiene **ancho libre**: empieza en el margen izquierdo del contenido, alineado con las fotos de arriba. Pasa el cursor sobre él y arrastra las barras rosas de los lados para cambiarlo; doble clic en una barra lo devuelve al ancho normal.
{% endcaja %}

## En la subida

Más texto de la prueba. Una cita destacada ayuda a resumir una idea fuerte:

{% cita "izquierda 40", "Nuestra conclusión" %}Más estable que ágil, y eso en enduro es una virtud.{% endcita %}

El texto rodea la cita como rodea una foto. Es una forma de dar ritmo a una reseña larga. La cita flota junto a los párrafos que van **debajo** de ella: si la mueves debajo del último párrafo de la sección, el editor te avisa y te ofrece subirla.

Un párrafo más para que la cita tenga texto a su lado de principio a fin. Aquí podrías hablar de la posición sobre la bici, del ángulo del sillín y de cómo trepa en las rampas más empinadas.

{% foto "transmision", "derecha 40" %}

La transmisión merece su propio párrafo. Una foto de detalle flotando a la derecha muestra la pieza de la que se habla sin interrumpir el texto.

Los cambios entran limpios incluso con carga, y el plato pequeño deja subir sentado casi cualquier pendiente.

{% fila "laguna", "sierra" %}

## Lo bueno y lo malo

{% recuadro "verde" %}
**Lo bueno**

Estable a alta velocidad. Suspensión trasera muy sensible. Buen precio para lo que ofrece.
{% endrecuadro %}

{% recuadro "rojo" %}
**Lo malo**

Pesada en las subidas largas. Los frenos de serie se quedan cortos.
{% endrecuadro %}

## Veredicto

{% centrado %}
Una bici honesta para quien busca bajar rápido sin gastar una fortuna.
{% endcentrado %}

{% boton "Ver la bici en la tienda", "https://example.com", "primario", "centro" %}
