#!/usr/bin/env bash
# Pone las páginas construidas por Eleventy (carpeta fuente/_site) en la rama que sirve GitHub Pages (carpeta sitio).
set -euo pipefail
FUENTE="${1:-fuente}"; SITIO="${2:-sitio}"

# Se reemplazan por completo, así los artículos borrados también desaparecen.
rm -rf "$SITIO/es" "$SITIO/assets"
cp -r "$FUENTE/_site/es" "$SITIO/es"
cp -r "$FUENTE/_site/assets" "$SITIO/assets"

# Portadas: inicio, una página por sección, buscar y la página de error (404), más el mapa del sitio para Google.
# Se arman solas con los artículos publicados (src/portadas/ en el código fuente).
for f in "$FUENTE"/_site/*.html "$FUENTE/_site/sitemap.xml" "$FUENTE/_site/robots.txt"; do
  if [ -f "$f" ]; then cp "$f" "$SITIO/"; fi
done

# Editor web (relievemag.com/editor/): la interfaz, el lector de artículos compartido, el logo y la lista
# de usuarios (contraseñas cifradas; ver editor/LEEME.md). No lo indexan los buscadores (meta robots).
rm -rf "$SITIO/editor"
mkdir -p "$SITIO/editor/lib"
cp -r "$FUENTE/editor/public/." "$SITIO/editor/"
cp "$FUENTE/editor/lib/article.js" "$SITIO/editor/lib/article.js"
cp "$FUENTE/src/_includes/partials/logo-defs.njk" "$SITIO/editor/logo-defs.svg"
if [ -f "$FUENTE/editor/acceso.json" ]; then cp "$FUENTE/editor/acceso.json" "$SITIO/editor/acceso.json"; fi

# Índice de búsqueda de los artículos (sin los archivos de interfaz que el sitio no usa)
rm -rf "$SITIO/pagefind"
npx --yes pagefind@1.5.2 --site "$SITIO" --glob "es/**/*.html" --quiet
rm -f "$SITIO"/pagefind/pagefind-ui.* "$SITIO"/pagefind/pagefind-modular-ui.* "$SITIO"/pagefind/pagefind-component-ui.* "$SITIO"/pagefind/pagefind-highlight.js "$SITIO"/pagefind/pagefind.css
