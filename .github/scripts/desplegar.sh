#!/usr/bin/env bash
# Pone las páginas construidas por Eleventy (carpeta fuente/_site) en la rama que sirve GitHub Pages (carpeta sitio).
set -euo pipefail
FUENTE="${1:-fuente}"; SITIO="${2:-sitio}"

# Se reemplazan por completo, así los artículos borrados también desaparecen.
rm -rf "$SITIO/es" "$SITIO/assets"
cp -r "$FUENTE/_site/es" "$SITIO/es"
cp -r "$FUENTE/_site/assets" "$SITIO/assets"

# Índice de búsqueda de los artículos (sin los archivos de interfaz que el sitio no usa)
rm -rf "$SITIO/pagefind"
npx --yes pagefind@1.5.2 --site "$SITIO" --glob "es/**/*.html" --quiet
rm -f "$SITIO"/pagefind/pagefind-ui.* "$SITIO"/pagefind/pagefind-modular-ui.* "$SITIO"/pagefind/pagefind-component-ui.* "$SITIO"/pagefind/pagefind-highlight.js "$SITIO"/pagefind/pagefind.css
