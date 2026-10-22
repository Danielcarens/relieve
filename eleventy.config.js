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

  function caption(ctx, p) {
    const credit = p.credit || ctx.credit || "";
    const label = ctx.ui?.photo || "Foto";
    const lead = credit ? `${esc(label)}: ${esc(credit)}. ` : "";
    return `${lead}${esc(p.caption || "")}`.trim();
  }

  const BASE = "/assets/img/caprock-10-2026/";

  // Photo inside the reading column
  eleventyConfig.addShortcode("foto", function (id) {
    const p = photo(this.ctx, id);
    const base = this.ctx.imgBase || BASE;
    return `<figure class="figure article-column my-5">
<div class="ratio ratio-3x2 figure-img">${img(p, base, "(min-width: 992px) 640px, 100vw", ' class="object-fit-cover"')}</div>
<figcaption class="figure-caption">${caption(this.ctx, p)}</figcaption>
</figure>`;
  });

  // Photo at the full container width
  eleventyConfig.addShortcode("fotoancha", function (id) {
    const p = photo(this.ctx, id);
    const base = this.ctx.imgBase || BASE;
    return `<div class="container">
<figure class="figure w-100 my-5">
<div class="ratio ratio-2x1 figure-img">${img(p, base, "(min-width: 1400px) 1188px, (min-width: 1200px) 1026px, (min-width: 992px) 864px, 100vw", ' class="object-fit-cover"')}</div>
<figcaption class="figure-caption">${caption(this.ctx, p)}</figcaption>
</figure>
</div>`;
  });

  // Panorama: full-bleed, limited height, swipeable. `focus` (0-100) is the
  // horizontal point that starts centered.
  eleventyConfig.addShortcode("pano", function (id) {
    const p = photo(this.ctx, id);
    const base = this.ctx.imgBase || BASE;
    const focus = Number.isFinite(p.focus) ? p.focus : 50;
    const ui = this.ctx.ui || {};
    const hint = esc(ui.panoHint || "Desliza para ver más");
    const label = esc(ui.panoLabel || "Foto panorámica: desliza a los lados para verla completa");
    return `<figure class="pano my-5" data-pano data-focus="${focus}">
<div class="pano-scroll" tabindex="0" role="group" aria-label="${label}">${img(p, base, "100vw", ' class="pano-img"')}</div>
<span class="pano-hint font-ui" aria-hidden="true"><span class="material-symbols-outlined">swap_horiz</span>${hint}</span>
<figcaption class="figure-caption container pt-2">${caption(this.ctx, p)}</figcaption>
</figure>`;
  });

  // Pull quote
  eleventyConfig.addPairedShortcode("cita", function (content) {
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
