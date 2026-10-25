// Eleventy (Build Awesome) configuration for RELIEVE.
// Source lives in /src, the built site goes to /_site.

const LOCALES = { es: "es-419", en: "en-US" };

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline formatting in short fields (captions, card rows, quote authors, subtitles…): the same marks the editor
// writes in the text: **bold**, *italic*, [link](https://…) and <br>. Everything else is escaped.
function mdi(value) {
  let h = esc(value).replace(/\\\*/g, "\u0001");
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  h = h.replace(/\[([^\]]+)\]\(((?:https?:|mailto:|\/|#)[^)\s]*)\)/g, (m, t, u) => `<a href="${u}"${/^https?:/.test(u.replace(/&amp;/g, "&")) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`);
  return h.replace(/\u0001/g, "*").replace(/&lt;br&gt;/g, "<br>");
}
// The same fields as plain text (for alt text, page titles, meta descriptions)
const mdPlain = (value) => String(value ?? "").replace(/\\\*/g, "\u0001").replace(/\*+/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<br>/g, " ").replace(/\u0001/g, "*");

export default function (eleventyConfig) {
  eleventyConfig.addFilter("mdi", mdi);
  eleventyConfig.addFilter("mdPlain", mdPlain);
  // Copy as-is: CSS, JS, logos, photos, favicons
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({
    "src/favicon.svg": "favicon.svg",
    "src/favicon.ico": "favicon.ico",
    "src/apple-touch-icon.png": "apple-touch-icon.png",
  });

  // ---- Filters ---------------------------------------------------------
  // Long date in the page language: "21 de octubre de 2026" / "October 21, 2026"
  eleventyConfig.addFilter("dateLong", (date, lang = "es") =>
    new Intl.DateTimeFormat(LOCALES[lang] || LOCALES.es, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(date))
  );

  // ISO date (YYYY-MM-DD) for <time datetime>
  eleventyConfig.addFilter("dateISO", (date) =>
    new Date(date).toISOString().slice(0, 10)
  );

  // Reading time in whole minutes, ~200 words per minute
  eleventyConfig.addFilter("readingMinutes", (content) => {
    const text = String(content ?? "").replace(/<[^>]*>/g, " ");
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });

  // ---- Shortcodes (used inside article Markdown) -------------------------
  // Every photo is declared once in the article's front matter under `photos:`
  // and placed in the text by its id. See DESIGN.md, "Article page".

  function photo(ctx, id) {
    const p = ctx?.photos?.[id];
    if (!p) throw new Error(`Article photo "${id}" is not declared in front matter (photos:)`);
    return p;
  }

  function img(p, base, sizes, extra = "") {
    const small = `${base}${p.file}-sm.jpg ${Math.round(p.w / 2)}w`;
    const large = `${base}${p.file}.jpg ${p.w}w`;
    return `<img src="${base}${p.file}.jpg" srcset="${small}, ${large}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(p.alt)}" loading="lazy" decoding="async"${extra}>`;
  }

  // Photos have no visible description unless `caption` is filled in. The
  // credit is not shown next to photos: it goes once at the end of the article.
  function figcaption(p, cls) {
    const text = (p.caption || "").trim();
    return text ? `\n<figcaption class="${cls}">${mdi(text)}</figcaption>` : "";
  }

  const BASE = "/assets/img/caprock-10-2026/";

  // Photos. Every single photo has the same width: the full container, the
  // width `agujas` already had. Each photo can be cropped freely in front
  // matter with `ratio` (width / height; default = the photo's own) and `pos`
  // (what stays centered, e.g. "50% 30%"). Two or more photos side by side go
  // in `fila`: they get the same height and add up to the same full width.
  //
  // Text wrapping (like Word's "Square"): foto, ficha and cita take an optional
  // last argument, a few words: "izquierda" or "derecha" (side), 33 / 40 / 50
  // (width as a share of the text column), "borde" (run out to the edge of the screen) and "fuera" (hang out to the outer
  // margin of the page container). Without it the block gets its own row.
  function wrapOf(opts, extra = "") {
    const w = String(opts || "").toLowerCase().split(/\s+/).filter(Boolean);
    const side = w.includes("izquierda") ? "left" : w.includes("derecha") ? "right" : "";
    if (!side) return "";
    const n = w.map(Number).find((x) => [33, 40, 50].includes(x)) || 40;
    return ` wrap wrap-${side} wrap-s${n}${w.includes("borde") ? " wrap-edge" : w.includes("fuera") ? " wrap-hang" : ""}${extra}`;
  }

  function frame(p, base, sizes) {
    const r = Number(p.ratio) > 0 ? Number(p.ratio) : p.w / p.h;
    const pos = /^\d{1,3}% \d{1,3}%$/.test(p.pos || "") ? ` style="object-position: ${p.pos}"` : "";
    const frameStyle = ` style="--bs-aspect-ratio: ${(100 / r).toFixed(3)}%"`;
    return {
      r,
      html: `<div class="ratio figure-img"${frameStyle}>${img(p, base, sizes, ` class="object-fit-cover"${pos}`)}</div>`,
    };
  }

  const SIZES_SOLO = "(min-width: 1400px) 1188px, (min-width: 1200px) 1026px, (min-width: 992px) 864px, 100vw";

  eleventyConfig.addShortcode("foto", function (id, opts) {
    const p = photo(this.ctx, id);
    const base = this.ctx.imgBase || BASE;
    const wrap = wrapOf(opts, " wrap-photo");
    if (wrap) {
      return `<figure class="figure${wrap}">
${frame(p, base, "(min-width: 768px) 520px, 100vw").html}${figcaption(p, "figure-caption")}
</figure>`;
    }
    return `<div class="container">
<figure class="figure w-100 my-5">
${frame(p, base, SIZES_SOLO).html}${figcaption(p, "figure-caption")}
</figure>
</div>`;
  });

  // Row of photos: {% fila "a", "b", "c" %}. Add "completa" as the last argument for a full-bleed row.
  // Grids: an array inside the row is a vertical stack, an array inside that is a row again, and so on:
  //   {% fila "alta", ["a", "b"] %}                      a tall photo beside two stacked ones
  //   {% fila [["a", "b"], ["c", "d"]] %}                a 2 x 2 grid (one column holding two rows)
  // Every cell grows in proportion to its aspect ratio so edges line up (see .fila-grid in theme.css).
  eleventyConfig.addShortcode("fila", function (...args) {
    const full = args.includes("completa");
    const tree = args.filter((a) => a !== "completa");
    const base = this.ctx.imgBase || BASE;
    const nested = tree.some(Array.isArray);
    if (nested) {
      const info = new Map();
      const R = (n, depth) => {
        if (!Array.isArray(n)) { const p = photo(this.ctx, n); const f = frame(p, base, "(min-width: 992px) 600px, 100vw"); info.set(n, f); return f.r; }
        const rs = n.map((c) => R(c, depth + 1));
        return depth % 2 === 0 ? rs.reduce((a, x) => a + x, 0) : 1 / rs.reduce((a, x) => a + 1 / x, 0);
      };
      // flex-grow weights must add up to 1 or the cells would not fill their row / stack
      const cells = (arr, depth, parentRow) => {
        const rs = arr.map((c) => R(c, depth)), w = rs.map((r) => (parentRow ? r : 1 / r)), sum = w.reduce((a, x) => a + x, 0);
        return arr.map((c, k) => cell(c, depth, parentRow, w[k] / sum, rs[k])).join("\n");
      };
      const cell = (n, depth, parentRow, g, r) => {
        const style = `--g: ${g.toFixed(4)}; --ar: ${parentRow ? r.toFixed(4) : "auto"}`;
        if (!Array.isArray(n)) return `<figure class="fila-item figure" style="${style}">\n${info.get(n).html}\n</figure>`;
        const isRow = depth % 2 === 0;
        return `<div class="${isRow ? "fila fila-in" : "fila-col"}" style="${style}">\n${cells(n, depth + 1, isRow)}\n</div>`;
      };
      const html = `<div class="fila fila-grid${full ? " fila-bleed" : ""} my-5">\n${cells(tree, 1, true)}\n</div>`;
      return full ? html : `<div class="container">\n${html}\n</div>`;
    }
    const ids = tree;
    const items = ids.map((id) => {
      const p = photo(this.ctx, id);
      const f = frame(p, base, full ? "100vw" : "(min-width: 992px) 600px, 100vw");
      return `<figure class="fila-item figure" style="--g: ${f.r.toFixed(3)}">
${f.html}${figcaption(p, "figure-caption")}
</figure>`;
    });
    if (full) return `<div class="fila fila-bleed my-5">
${items.join("\n")}
</div>`;
    return `<div class="container">
<div class="fila my-5">
${items.join("\n")}
</div>
</div>`;
  });

  // Data card (specs, rider card, park facts…). Declared once in front matter under `fichas:` and
  // placed by id: title, optional link (`url`), optional photo (id from `photos`), rows of
  // label / value, `tone` (gris | sin fondo | amarillo | rojo | verde) and `format` (lista | tabla).
  eleventyConfig.addShortcode("ficha", function (id, opts) {
    const f = this.ctx?.fichas?.[id];
    if (!f) throw new Error(`Article card "${id}" is not declared in front matter (fichas:)`);
    const base = this.ctx.imgBase || BASE;
    const wrap = wrapOf(opts, " wrap-card");
    const photoHtml = f.photo ? frame(photo(this.ctx, f.photo), base, "(min-width: 768px) 520px, 100vw").html : "";
    const title = f.title ? `<h3 class="ficha-title">${f.url ? `<a href="${esc(f.url)}">${mdi(f.title)}</a>` : mdi(f.title)}</h3>` : "";
    const rows = (f.rows || []).map((r) => f.format === "tabla"
      ? `<tr><th scope="row">${mdi(r.label)}</th><td>${mdi(r.value)}</td></tr>`
      : `<div><dt>${mdi(r.label)}</dt> <dd>${mdi(r.value)}</dd></div>`).join("\n");
    const list = !rows ? "" : f.format === "tabla" ? `<table class="ficha-table"><tbody>\n${rows}\n</tbody></table>` : `<dl class="ficha-list">\n${rows}\n</dl>`;
    const tone = f.tone === "sin fondo" ? " ficha-plain" : ["amarillo", "rojo", "verde"].includes(f.tone) ? ` tone-${f.tone}` : "";
    return `<aside class="ficha${tone}${wrap}${wrap ? "" : " ficha-solo"}">
${photoHtml}<div class="ficha-body">${title}${list}</div>
</aside>`;
  });

  // Panorama: full-bleed, limited height, swipeable. `focus` (0-100) is the
  // horizontal point that starts centered.
  // Optional third argument: height as a share of the screen height (25-90), e.g. {% pano "id", "", "60" %}
  eleventyConfig.addShortcode("pano", function (id, size, alto) {
    const p = photo(this.ctx, id);
    const base = this.ctx.imgBase || BASE;
    // "completa": the whole photo at full width, natural proportions, no sliding.
    if (size === "completa") {
      return `<figure class="pano-full my-5">
<div class="pano-full-frame">${img(p, base, "100vw", ' class="pano-img"')}</div>
${figcaption(p, "figure-caption container pt-2")}
</figure>`;
    }
    const focus = Number.isFinite(p.focus) ? p.focus : 50;
    const ui = this.ctx.ui || {};
    const hint = esc(ui.panoHint || "Desliza para ver más");
    const label = esc(ui.panoLabel || "Foto panorámica: desliza a los lados para verla completa");
    const tall = size === "alta" ? " pano-tall" : "";
    const h = Math.round(Number(alto));
    const hStyle = h >= 20 && h <= 95 ? ` style="--pano-limit: clamp(12rem, ${h}vh, ${(h * 0.68).toFixed(1)}rem)"` : "";
    return `<figure class="pano${tall} my-5" data-pano data-focus="${focus}"${hStyle}>
<div class="pano-scroll" tabindex="0" role="group" aria-label="${label}">${img(p, base, "100vw", ' class="pano-img"')}</div>
<span class="pano-hint font-ui" aria-hidden="true"><span class="material-symbols-outlined">swap_horiz</span>${hint}</span>
${figcaption(p, "figure-caption container pt-2")}
</figure>`;
  });

  // Pull quote. Optional text wrapping like foto and an optional author:
  // {% cita "derecha 40", "Nombre" %}…{% endcita %}  ({% cita "", "Nombre" %} for no wrapping)
  eleventyConfig.addPairedShortcode("cita", function (content, opts, author) {
    const wrap = wrapOf(opts, " wrap-card");
    const by = author ? `\n<figcaption class="pullquote-by">${mdi(author)}</figcaption>` : "";
    if (wrap) {
      return `<figure class="pullquote-wrap${wrap}">
<blockquote class="blockquote pullquote mb-0"><p>${mdi(content.trim())}</p></blockquote>${by}
</figure>`;
    }
    return `<div class="container">
<figure class="my-5">
<blockquote class="blockquote pullquote mb-0"><p>${mdi(content.trim())}</p></blockquote>${by}
</figure>
</div>`;
  });

  // ---- Text blocks (the editor's "Insertar" menu) -------------------------------------
  // Paired blocks leave a blank line around their content so Markdown keeps working inside.
  eleventyConfig.addShortcode("separador", () => `<hr class="article-rule">`);
  // Spacer: {% espacio "4" %} (height in rem, 0.5-20) or the old s | m | l
  eleventyConfig.addShortcode("espacio", (size) => {
    const n = { s: 1.5, m: 3, l: 6 }[size] ?? Math.min(20, Math.max(0.5, Number(size) || 3));
    return `<div class="article-space" style="height: ${n}rem" aria-hidden="true"></div>`;
  });
  // A row of facts (place, distance, difficulty…), the "stage sheet": {% datos "Lugar", "Quitaque", "Distancia", "12 km" %}
  eleventyConfig.addShortcode("datos", (...a) => {
    const rows = []; for (let k = 0; k + 1 < a.length; k += 2) rows.push([a[k], a[k + 1]]);
    if (!rows.length) return "";
    return `<div class="container">
<dl class="row row-cols-2 row-cols-md-4 g-4 py-4 my-5 border-top border-bottom border-2 border-strong datos">
${rows.map(([l, v]) => `<div class="col"><dt class="small-meta fw-semibold font-ui">${mdi(l)}</dt><dd class="h3 mb-0">${mdi(v)}</dd></div>`).join("\n")}
</dl>
</div>`;
  });
  // Button: {% boton "Texto", "https://…", "secundario", "centro" %} (style primario | secundario, then optional "centro")
  eleventyConfig.addShortcode("boton", (text, url, style, align) => {
    const ext = /^https?:\/\//.test(url || "") ? ' target="_blank" rel="noopener"' : "";
    return `<p class="article-cta${align === "centro" ? " text-center" : ""}"><a class="btn ${style === "secundario" ? "btn-outline-dark" : "btn-primary"}" href="${esc(url || "#")}"${ext}>${esc(text)}</a></p>`;
  });
  // Centered paragraph or title: {% centrado %}## Título{% endcentrado %}
  eleventyConfig.addPairedShortcode("centrado", (content) => `<div class="article-center">\n\n${content.trim()}\n\n</div>`);
  // Text box: {% recuadro "gris marco linea-rosa" %}…{% endrecuadro %}
  //   background: gris | sin-fondo | amarillo | rojo | verde;  "marco": a 2px frame;  "linea-…": a thick line on the left
  //   (rosa | amarillo | verde | rojo). Frame and line are drawn inside the box, so the text never moves when they change.
  //   Older one-word values still work: borde (= sin-fondo marco), acento (= gris linea-rosa).
  eleventyConfig.addPairedShortcode("recuadro", (content, opts) => {
    let w = String(opts || "gris").toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (w.join(" ") === "borde") w = ["sin-fondo", "marco"]; else if (w.join(" ") === "acento") w = ["gris", "linea-rosa"];
    const fondo = ["gris", "sin-fondo", "amarillo", "rojo", "verde"].find((x) => w.includes(x)) || "gris";
    const linea = (w.find((x) => /^linea-(rosa|amarillo|verde|rojo)$/.test(x)) || "").slice(6);
    const cls = [`fondo-${fondo}`, ["amarillo", "rojo", "verde"].includes(fondo) ? `tone-${fondo}` : "", w.includes("marco") ? "has-marco" : "", linea ? `linea-${linea}` : ""].filter(Boolean).join(" ");
    return `<aside class="recuadro ${cls}">\n\n${content.trim()}\n\n</aside>`;
  });
  // Free width for a text block (the editor's side handles): {% caja "12 70" %}…{% endcaja %} runs from 12% to 70% of
  // the content width (the width of single photos). Phones: back to the normal reading column.
  eleventyConfig.addPairedShortcode("caja", (content, lr) => {
    const [l, r] = String(lr || "").split(/\s+/).map(Number);
    if (!(r > l) || l < 0 || r > 100) return content;
    return `<div class="caja" style="--l: ${l}; --r: ${r}">\n\n${content.trim()}\n\n</div>`;
  });
  // Expandable (questions, extra details): {% desplegable "Pregunta" %}…{% enddesplegable %}
  eleventyConfig.addPairedShortcode("desplegable", (content, title) =>
    `<details class="desplegable">\n<summary>${mdi(title || "")}</summary>\n<div class="desplegable-body">\n\n${content.trim()}\n\n</div>\n</details>`);
  // Map (OpenStreetMap, no account or key): {% mapa "30.4207,-101.1700", "Caprock Canyons", "12" %}
  eleventyConfig.addShortcode("mapa", function (coords, label, zoom) {
    const [lat, lng] = String(coords || "").split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    const z = Math.min(18, Math.max(3, Number(zoom) || 11)), d = 180 / 2 ** z * 1.6;
    const bbox = [lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].map((x) => x.toFixed(5)).join(",");
    const big = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${z}/${lat}/${lng}`;
    const t = esc(mdPlain(label || "Mapa"));
    return `<div class="container">
<figure class="article-map my-5">
<div class="ratio ratio-21x9 map-frame"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${lat},${lng}" title="Mapa: ${t}" loading="lazy"></iframe></div>
<figcaption class="figure-caption d-flex flex-wrap justify-content-between gap-2"><span>${label ? mdi(label) : ""}</span><a href="${big}" target="_blank" rel="noopener">Ver el mapa más grande</a></figcaption>
</figure>
</div>`;
  });

  // YouTube video in the article: {% video "id", "Descripción" %}. The thumbnail stays until the reader
  // clicks (privacy-enhanced player, nothing loads from YouTube before that except the thumbnail).
  eleventyConfig.addShortcode("video", function (id, caption) {
    const v = String(id || "").replace(/[^\w-]/g, "");
    const ui = this.ctx.ui || {};
    const title = mdPlain(caption) || ui.videoTitle || "Video";
    return `<div class="container">
<figure class="video-embed my-5" data-video-embed>
<div class="ratio ratio-16x9 video-frame" data-video-frame>
<img src="https://i.ytimg.com/vi/${v}/hqdefault.jpg" alt="" loading="lazy" decoding="async" class="object-fit-cover">
<button type="button" class="btn btn-primary font-ui video-play" data-video="${v}" data-video-title="${esc(title)}" aria-label="${esc(ui.playVideoLabel || "Reproducir el video")}: ${esc(title)}"><span class="material-symbols-outlined me-1" aria-hidden="true">play_arrow</span>${esc(ui.playVideo || "Ver el video")}</button>
</div>${caption ? `\n<figcaption class="figure-caption">${mdi(caption)}</figcaption>` : ""}
</figure>
</div>`;
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}
