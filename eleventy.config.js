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

export default function (eleventyConfig) {
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
    return text ? `\n<figcaption class="${cls}">${esc(text)}</figcaption>` : "";
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
  // (width as a share of the text column) and "fuera" (hang out to the outer
  // margin of the page container). Without it the block gets its own row.
  function wrapOf(opts, extra = "") {
    const w = String(opts || "").toLowerCase().split(/\s+/).filter(Boolean);
    const side = w.includes("izquierda") ? "left" : w.includes("derecha") ? "right" : "";
    if (!side) return "";
    const n = w.map(Number).find((x) => [33, 40, 50].includes(x)) || 40;
    return ` wrap wrap-${side} wrap-s${n}${w.includes("fuera") ? " wrap-hang" : ""}${extra}`;
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
  eleventyConfig.addShortcode("fila", function (...args) {
    const full = args.includes("completa");
    const ids = args.filter((a) => a !== "completa");
    const base = this.ctx.imgBase || BASE;
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
  // label / value, `tone` (gris | sin fondo) and `format` (lista | tabla).
  eleventyConfig.addShortcode("ficha", function (id, opts) {
    const f = this.ctx?.fichas?.[id];
    if (!f) throw new Error(`Article card "${id}" is not declared in front matter (fichas:)`);
    const base = this.ctx.imgBase || BASE;
    const wrap = wrapOf(opts, " wrap-card");
    const photoHtml = f.photo ? frame(photo(this.ctx, f.photo), base, "(min-width: 768px) 520px, 100vw").html : "";
    const title = f.title ? `<h3 class="ficha-title">${f.url ? `<a href="${esc(f.url)}">${esc(f.title)}</a>` : esc(f.title)}</h3>` : "";
    const rows = (f.rows || []).map((r) => f.format === "tabla"
      ? `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`
      : `<div><dt>${esc(r.label)}</dt> <dd>${esc(r.value)}</dd></div>`).join("\n");
    const list = !rows ? "" : f.format === "tabla" ? `<table class="ficha-table"><tbody>\n${rows}\n</tbody></table>` : `<dl class="ficha-list">\n${rows}\n</dl>`;
    const tone = f.tone === "sin fondo" ? " ficha-plain" : "";
    return `<aside class="ficha${tone}${wrap}${wrap ? "" : " ficha-solo"}">
${photoHtml}<div class="ficha-body">${title}${list}</div>
</aside>`;
  });

  // Panorama: full-bleed, limited height, swipeable. `focus` (0-100) is the
  // horizontal point that starts centered.
  eleventyConfig.addShortcode("pano", function (id, size) {
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
    return `<figure class="pano${tall} my-5" data-pano data-focus="${focus}">
<div class="pano-scroll" tabindex="0" role="group" aria-label="${label}">${img(p, base, "100vw", ' class="pano-img"')}</div>
<span class="pano-hint font-ui" aria-hidden="true"><span class="material-symbols-outlined">swap_horiz</span>${hint}</span>
${figcaption(p, "figure-caption container pt-2")}
</figure>`;
  });

  // Pull quote. Optional text wrapping like foto: {% cita "derecha 40" %}…{% endcita %}
  eleventyConfig.addPairedShortcode("cita", function (content, opts) {
    const wrap = wrapOf(opts, " wrap-card");
    if (wrap) {
      return `<figure class="pullquote-wrap${wrap}">
<blockquote class="blockquote pullquote mb-0"><p>${esc(content.trim())}</p></blockquote>
</figure>`;
    }
    return `<div class="container">
<figure class="my-5">
<blockquote class="blockquote pullquote mb-0"><p>${esc(content.trim())}</p></blockquote>
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
