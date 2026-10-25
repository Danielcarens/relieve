---
layout: layouts/article.njk
permalink: false
eleventyExcludeFromCollections: true
guia: true
section: viajes
title: "Guía 3 · Fichas de datos, datos en fila, video y mapa"
subtitle: "Cómo presentar información práctica y agregar video, mapas o código."
description: "Guía del editor de RELIEVE: datos y medios."
date: 2026-10-23
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
fichas:
  bici:
    title: Ficha técnica
    tone: gris
    format: tabla
    rows:
      - { label: Cuadro, value: "Aluminio, 150 mm" }
      - { label: Horquilla, value: "160 mm" }
      - { label: Ruedas, value: "29 / 27,5" }
      - { label: Peso, value: "15,8 kg" }
  aviso:
    title: Antes de salir
    tone: amarillo
    format: lista
    rows:
      - { label: Agua, value: "No hay fuentes en la ruta" }
      - { label: Calor, value: "Hasta 40 °C en verano" }
  importante:
    title: Zona cerrada
    tone: rojo
    format: lista
    rows:
      - { label: Sendero norte, value: "Cerrado por derrumbe" }
  dato:
    title: Lo mejor del parque
    tone: verde
    format: lista
    rows:
      - { label: Hora, value: "Atardecer, desde el mirador" }
      - { label: Fauna, value: "Bisontes en la pradera" }
---
## Datos en fila

Una fila de datos grandes entre dos líneas, como la ficha de una etapa: lugar, distancia, desnivel, dificultad. Se puede usar en cualquier parte del artículo y las veces que quieras. Insertar → *Datos en fila*; los nombres y los valores se escriben en la página, y en el panel se agregan o quitan datos.

{% datos "Lugar", "Quitaque, Texas", "Distancia", "12 km", "Desnivel", "+350 m", "Dificultad", "Media" %}

Normalmente las dos líneas y el texto empiezan y terminan justo en los bordes de las fotos. Como los párrafos, tiene dos barras rosas a los lados para cambiar su ancho: los bordes se pegan a los márgenes de las fotos, a los de la columna de texto y al centro. Esta otra fila está ajustada a la columna de texto:

{% caja "texto texto" %}
{% datos "Salida", "7:00", "Duración", "4 h", "Agua", "3 litros" %}
{% endcaja %}

## Ficha de datos en su propia fila

Un cuadro con título y datos (Dato: valor, o una tabla de dos columnas). En su propia fila, el cuadro mide lo mismo que una foto y el texto de adentro se alinea con los párrafos. En celular va de borde a borde, como las fotos. Insertar → *Ficha de datos*; el título y los datos se escriben en la ficha misma (para enlazar el título, selecciónalo y usa el botón de enlace de la barra), y en el panel se agregan datos y se cambian el color y el formato.

{% ficha "bici" %}

## Fichas de colores

Además del gris (y sin fondo), las fichas pueden ser **amarillas** para advertencias, **rojas** para algo importante o **verdes** para llamar la atención.

{% ficha "aviso" %}

{% ficha "importante" %}

{% ficha "dato", "derecha 40 fuera" %}

Una ficha también puede flotar a un lado, con el texto alrededor, igual que una foto: selecciónala y elige *Flotar a la derecha*. Así funcionan las especificaciones de una bici al lado de la reseña, o los datos de un parque al lado de su historia.

El texto sigue al lado de la ficha hasta que se termina. En celular, la ficha ocupa su propia fila de borde a borde.

## Video de YouTube

Insertar → *Video de YouTube* y pega el enlace en el panel. El lector ve la miniatura; el video se carga solo cuando hace clic (así la página es más rápida y YouTube no rastrea a quien no lo mira).

{% video "7EcrNEsd3-E", "Video de ejemplo" %}

## Mapa

Insertar → *Mapa*. En Google Maps, busca el lugar, copia el enlace de la barra del navegador y pégalo en el panel. El mapa se muestra con OpenStreetMap: no necesita cuenta y no rastrea al lector.

{% mapa "34.41430,-101.05460", "Caprock Canyons State Park", "11" %}

## Código HTML

Para casos especiales (un formulario de reserva, un widget de otra página), Insertar → *Código HTML*. Se publica tal cual: revisa siempre la vista previa.

{% recuadro "amarillo marco" %}
**Ojo:** el código HTML puede romper el diseño si está mal escrito. Úsalo solo cuando ningún otro bloque sirva.
{% endrecuadro %}
