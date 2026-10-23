---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Ejemplo · Review de una bici"
subtitle: "Un formato posible para una prueba de producto: título arriba, datos, ficha técnica, pros y contras, y veredicto."
description: "Ejemplo de review con el editor de RELIEVE."
date: 2026-10-24
author: Daniel
credit: Daniel Cárdenas
draft: true
cabecera: titulo
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
fichas:
  specs:
    title: Especificaciones
    url: https://example.com
    tone: gris
    format: tabla
    rows:
      - { label: Recorrido, value: "150 / 160 mm" }
      - { label: Cuadro, value: "Aluminio 6061" }
      - { label: Ruedas, value: "29 pulgadas" }
      - { label: Peso, value: "15,8 kg (talla L)" }
      - { label: Precio, value: "3.499 USD" }
---
{% recuadro "borde" %}
**Cómo está hecho:** en la pestaña *Artículo*, la **Cabecera** es «Título arriba y la foto debajo». Debajo van los datos clave en fila, la ficha técnica flotando a la derecha del texto, dos recuadros (verde y rojo) para lo bueno y lo malo, y un veredicto centrado con un botón. Cambia cualquier cosa y mira la vista previa.
{% endrecuadro %}

{% datos "Uso", "Enduro", "Recorrido", "160 mm", "Peso", "15,8 kg", "Precio", "3.499 USD" %}

{% ficha "specs", "derecha 40 fuera" %}

Durante tres meses usamos esta bici en senderos rápidos y técnicos. Aquí iría la introducción de la prueba: qué es, para quién es y en qué terreno se probó.

El segundo párrafo puede hablar de la geometría y de las primeras impresiones. Fíjate cómo la ficha técnica acompaña al texto sin cortar la lectura.

## En la bajada

Una sección con título para cada parte de la prueba. Los títulos siempre empiezan debajo de las fichas y fotos flotantes.

{% fila "capas", "autor" %}

## En la subida

Más texto de la prueba. Una cita destacada ayuda a resumir una idea fuerte:

{% cita "izquierda 40", "Nuestra conclusión" %}Más estable que ágil, y eso en enduro es una virtud.{% endcita %}

El texto rodea la cita como rodea una foto. Es una forma de dar ritmo a una reseña larga.

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
