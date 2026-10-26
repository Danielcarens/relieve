// Drawing each block of the article with the site's own classes, plus the editing aids around it.
import { A, IMG, esc, fit, posOf, ratioOf, svg } from "./base.js";
import { inl, mdMulti, mdToHtml } from "./markdown.js";

// ---- grids: a row's tree may hold arrays (vertical stacks, and rows inside them) ------------------
export const rOfNode = (n, r, depth) => {
  if (!Array.isArray(n)) return r(n);
  const rs = n.map((c) => rOfNode(c, r, depth + 1));
  return depth % 2 === 0 ? rs.reduce((a, x) => a + x, 0) : 1 / rs.reduce((a, x) => a + 1 / x, 0);
};
// One entry per cell, in document order: { g: share of its row/stack, ar: aspect ratio (cells of a row only) }
export function gridVars(tree, r) {
  const out = [];
  const walk = (arr, depth, parentRow) => {
    const rs = arr.map((c) => rOfNode(c, r, depth)),
      w = rs.map((x) => (parentRow ? x : 1 / x)),
      sum = w.reduce((a, x) => a + x, 0);
    arr.forEach((c, k) => {
      out.push({ g: w[k] / sum, ar: parentRow ? rs[k] : null });
      if (Array.isArray(c)) walk(c, depth + 1, depth % 2 === 0);
    });
  };
  walk(tree, 1, true);
  return out;
}
export const cellStyle = (v) => `--g:${v.g.toFixed(4)};--ar:${v.ar ? v.ar.toFixed(4) : "auto"}`;
// Mosaic cells carry data-cp, their place in the layout ("1.0" = first photo of the second group), so the bars between
// them know which photos they resize. Containers say their direction: data-dir="r" (a row) or "c" (photos stacked).
export const GRIP = `<div class="item-grip" draggable="true" title="Arrastra para mover la foto: a otro lugar del mosaico, sobre otra foto, junto a un párrafo o entre dos bloques">${svg("move")}</div>`;
export function gridHTML(b, S, base, i) {
  const vars = gridVars(b.tree, (id) => ratioOf(S.photos[id]));
  let n = 0;
  const cells = (arr, depth, pre) =>
    arr
      .map((c, j) => {
        const v = vars[n],
          k = n++,
          cp = pre + j;
        if (!Array.isArray(c)) {
          const p = S.photos[c];
          if (!p) return "";
          const si = S.sel && S.sel.i === i && S.sel.id === c ? " is-sel-item" : "";
          return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(c)}" data-n="${k}" data-cp="${cp}" style="${cellStyle(v)}">${photoFrame(p, base, i, c, true)}${GRIP}</figure>`;
        }
        const row = depth % 2 === 0;
        return `<div class="${row ? "fila fila-in" : "fila-col"}" data-n="${k}" data-cp="${cp}" data-dir="${row ? "r" : "c"}" style="${cellStyle(v)}">${cells(c, depth + 1, cp + ".")}</div>`;
      })
      .join("");
  return `<div class="fila fila-grid${b.full ? " fila-bleed" : ""} my-5" data-row data-nested data-cp="" data-dir="r">${cells(b.tree, 1, "")}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura del mosaico"></div></div>`;
}
export function patchGrid(row, tree, ratios) {
  // ratios: { id: ratio }; updates the cells in place while dragging
  const vars = gridVars(tree, (id) => ratios[id]);
  row.querySelectorAll("[data-n]").forEach((el) => {
    const v = vars[Number(el.dataset.n)];
    el.style.cssText = cellStyle(v);
    if (el.dataset.item)
      el.querySelector(".ratio").style.setProperty(
        "--bs-aspect-ratio",
        (100 / ratios[el.dataset.item]).toFixed(3) + "%",
      );
  });
}

// Word-style handles around a selected photo: the sides change its width, top and bottom its height (the crop),
// the corners both. Edges snap to the edges of the other photos (also each photo of a row), the margins and the text column.
export const RZ = ["l", "r", "t", "b", "tl", "tr", "bl", "br"]
  .map((k) => `<div class="rz rz-${k}" data-rz="${k}"></div>`)
  .join("");
export function photoFrame(p, base, i, id, inRow = false) {
  const r = ratioOf(p);
  return `<div class="ratio figure-img" data-id="${esc(id)}" style="--bs-aspect-ratio: ${(100 / r).toFixed(3)}%">
<img src="${IMG(base, p.file, "-sm.jpg")}" class="object-fit-cover" style="object-position: ${posOf(p)}" alt="" draggable="false">
${inRow ? "" : RZ}</div>`;
}
export const caption = (p, id) =>
  inl(`data-cap="${esc(id)}"`, p.caption, "Descripción (opcional)", "cap-field figure-caption");

export const wrapCls = (b, kind) =>
  b.wrap && b.wrap.side
    ? ` wrap wrap-${b.wrap.side}${[33, 40, 50].includes(b.wrap.size || 40) ? ` wrap-s${b.wrap.size || 40}` : ""}${b.wrap.edge ? " wrap-edge" : b.wrap.hang ? " wrap-hang" : ""} ${kind}`
    : "";
export const fichaHTML = (f, base, S, id) => {
  const ff = (path, ph, tag = "span") =>
    inl(
      `data-ff="${esc(id)}:${path}"`,
      path.split(".").reduce((o, k) => (o == null ? o : o[k]), f),
      ph,
      "",
      tag,
    );
  const photo =
    f.photo && S.photos[f.photo]
      ? `<div class="ratio figure-img" style="--bs-aspect-ratio: ${(100 / ratioOf(S.photos[f.photo])).toFixed(3)}%"><img src="${IMG(base, S.photos[f.photo].file, "-sm.jpg")}" class="object-fit-cover" style="object-position: ${posOf(S.photos[f.photo])}" alt="" draggable="false"></div>`
      : "";
  const title = `<h3 class="ficha-title">${ff("title", "Título de la ficha")}</h3>`;
  const rows = (f.rows || [])
    .map((r, k) =>
      f.format === "tabla"
        ? `<tr><th scope="row">${ff(`rows.${k}.label`, "Dato")}</th><td>${ff(`rows.${k}.value`, "Valor")}</td></tr>`
        : `<div><dt>${ff(`rows.${k}.label`, "Dato")}</dt> <dd>${ff(`rows.${k}.value`, "Valor")}</dd></div>`,
    )
    .join("");
  const list = !rows
    ? '<p class="text-body-secondary mb-0 ed-aid">Ficha vacía: agrega datos con el botón «Agregar dato» del panel.</p>'
    : f.format === "tabla"
      ? `<table class="ficha-table"><tbody>${rows}</tbody></table>`
      : `<dl class="ficha-list">${rows}</dl>`;
  return `${photo}<div class="ficha-body">${title}${list}</div>`;
};

// Text box look: the same classes the site's {% recuadro %} writes
export const recuadroCls = (b) => {
  const f = b.fondo || "gris";
  return [
    `fondo-${f}`,
    ["amarillo", "rojo", "verde"].includes(f) ? `tone-${f}` : "",
    b.marco ? "has-marco" : "",
    b.linea ? `linea-${b.linea}` : "",
  ]
    .filter(Boolean)
    .join(" ");
};
// Same rule as the site's {% caja %}: each edge is a share of the photos' width, or "texto" (the reading column's edge)
export const COL = "min(46rem, 100% - 1.5rem)";
export const edgeX = (v, side) =>
  v === "texto"
    ? `calc((100% ${side === "l" ? "-" : "+"} ${COL}) / 2)`
    : `calc((100% - var(--cw-inner)) / 2 + var(--cw-inner) * ${v} / 100)`;
export const boxVars = (x) => `--x1: ${edgeX(x.l, "l")}; --x2: ${edgeX(x.r, "r")}`;
export const BOXABLE = [
  "p",
  "h2",
  "h3",
  "ul",
  "ol",
  "callout",
  "details",
  "datos",
  "foto",
  "fila",
  "quote",
  "button",
  "hr",
  "video",
  "map",
  "ficha",
];
// Blocks whose normal width is the photos' column (the rest: the text column)
export const WIDE = ["datos", "fila", "foto", "quote", "video", "map", "ficha"];
// A floating photo, quote or card wraps the text that comes AFTER it. If nothing comes after it, say so.
export const BESIDE = ["p", "ul", "ol", "h3", "callout", "details", "button", "raw"];
export function floatHint(S, i) {
  let k = i + 1;
  while (S.blocks[k] && S.blocks[k].wrap && S.blocks[k].wrap.side) k++; // another float goes below this one; the text after it still wraps
  const nx = S.blocks[k],
    pv = S.blocks[i - 1],
    b = S.blocks[i];
  if (nx && BESIDE.includes(nx.type)) return "";
  const what = b.type === "quote" ? "la cita" : b.type === "ficha" ? "la ficha" : "la foto";
  const up = pv && ["p", "ul", "ol", "h3"].includes(pv.type);
  return `<div class="float-hint ed-aid">El texto rodea ${what} solo si va <strong>debajo</strong> de ella, y aquí no hay texto debajo. ${up ? `<button type="button" data-a="float-up">Subirla un párrafo</button>` : "Pon un párrafo debajo, o elige «En su propia fila» en el panel."}</div>`;
}

export function blockHTML(b, i, S) {
  const base = S.meta.imgBase || "";
  const tools = `<div class="blk-tools">
<button data-a="up" title="Subir">${svg("up")}</button><button data-a="down" title="Bajar">${svg("down")}</button>
<button data-a="dup" title="Duplicar">${svg("dup")}</button><button data-a="del" title="Eliminar">${svg("del")}</button></div>`;
  const handle =
    b.type === "foto"
      ? `<div class="blk-handle" draggable="true" title="Arrastra para mover la foto: sobre otra foto (mosaico), a un lado del texto (flota) o entre dos bloques">${svg("move")}</div>`
      : `<div class="blk-handle" draggable="true" title="Arrastra para mover">${svg("grip")}</div>`;
  const sel = S.sel && S.sel.i === i ? " is-sel" : "";
  const boxable = BOXABLE.includes(b.type) && !(b.wrap && b.wrap.side) && !b.full;
  const style = [
    boxable && b.box ? boxVars(b.box) : "",
    b.wrap && b.wrap.side && ![33, 40, 50].includes(b.wrap.size || 40) ? `--ws: ${b.wrap.size / 100}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const what =
    {
      fila: "de la fila",
      datos: "de los datos",
      quote: "de la cita",
      button: "del botón",
      hr: "de la línea",
      video: "del video",
      map: "del mapa",
      ficha: "de la ficha",
    }[b.type] || "del texto";
  const fside = b.wrap && b.wrap.side && b.type !== "foto" ? (b.wrap.side === "left" ? "r" : "l") : null; // floating card or quote: its inner side
  const edges = fside
    ? `<div class="box-handle" data-side="${fside}" data-float="1" title="Arrastra para cambiar el ancho; se pega a los bordes de lo que hay alrededor"></div>`
    : boxable && b.type !== "foto"
      ? `<div class="box-handle" data-side="l" title="Arrastra para cambiar el ancho ${what}. Doble clic: ancho normal"></div><div class="box-handle" data-side="r" title="Arrastra para cambiar el ancho ${what}. Doble clic: ancho normal"></div>`
      : "";
  const wrap = (cls, inner, extra = "") =>
    `<div class="blk ${cls}${extra}${sel}${b.align === "center" ? " is-center" : ""}${boxable && b.box ? " has-box" : ""}"${style ? ` style="${style}"` : ""} data-i="${i}">${handle}${tools}${edges}${inner}${extra.includes(" wrap ") ? floatHint(S, i) + UNDER : ""}</div>`;
  const rich = (ph) =>
    `<div class="ed-field ed-rich" contenteditable="true" spellcheck="true" data-t="${i}" data-ph="${ph}">${mdToHtml(b.text)}</div>`;
  const text = (cls, ph) => wrap(cls, rich(ph));
  const plain = (key, ph, cls = "", tag = "div") =>
    `<${tag} class="ed-plain ${cls}" contenteditable="plaintext-only" spellcheck="true" data-f="${i}:${key}" data-ph="${ph}">${esc(key.split(".").reduce((o, k) => (o == null ? o : o[k]), b) || "")}</${tag}>`;
  switch (b.type) {
    case "p":
      return text("blk-text", "Escribe aquí…");
    case "ul":
    case "ol": {
      const items = (b.items && b.items.length ? b.items : [""]).map((x) => `<li>${mdToHtml(x)}</li>`).join("");
      return wrap(
        "blk-text blk-list",
        `<${b.type} class="ed-field ed-list" contenteditable="true" spellcheck="true" data-l="${i}">${items}</${b.type}>`,
      );
    }
    case "callout":
      return wrap(
        "blk-text blk-callout",
        `<aside class="recuadro ${recuadroCls(b)}"><div class="rq-line-hit" title="Clic: cambia el color de la línea (rosa, amarillo, verde, rojo, sin línea)"></div><div class="ed-field ed-rich ed-multi" contenteditable="true" spellcheck="true" data-t="${i}" data-multi="1" data-ph="Texto del recuadro…">${mdMulti(b.text)}</div></aside>`,
      );
    case "details":
      return wrap(
        "blk-text blk-details",
        `<div class="desplegable ed-desplegable"><div class="ed-summary">${inl(`data-f="${i}:title"`, b.title, "Pregunta o título del desplegable", "ed-summary-text")}<span aria-hidden="true">−</span></div><div class="desplegable-body"><div class="ed-field ed-rich ed-multi" contenteditable="true" spellcheck="true" data-t="${i}" data-multi="1" data-ph="Lo que se ve al abrirlo…">${mdMulti(b.text)}</div></div></div>`,
      );
    case "hr":
      return wrap("blk-text blk-hr", `<hr class="article-rule">`);
    case "space":
      return wrap(
        "blk-text blk-space",
        `<div class="article-space ed-space" style="height:${Number(b.size) || 3}rem"><span>Espacio · ${Number(b.size) || 3} rem</span><div class="size-handle" data-size="space" title="Arrastra para cambiar la altura"></div></div>`,
      );
    case "datos":
      return wrap(
        "blk-media blk-datos",
        `<div class="container"><div class="datos-wrap py-4 my-5 border-top border-bottom border-2 border-strong"><dl class="row row-cols-2 row-cols-md-4 g-4 mb-0 datos">${(b.rows || []).map((r, k) => `<div class="col"><dt class="small-meta fw-semibold font-ui">${inl(`data-f="${i}:rows.${k}.label"`, r.label, "Dato", "", "span")}</dt><dd class="h3 mb-0">${inl(`data-f="${i}:rows.${k}.value"`, r.value, "Valor", "", "span")}</dd></div>`).join("")}</dl></div></div>`,
      );
    case "button":
      return wrap(
        "blk-text blk-button",
        `<p class="article-cta"><span class="btn ${b.style === "secundario" ? "btn-outline-dark" : "btn-primary"} ed-btn">${plain("text", "Texto del botón", "", "span")}</span>${b.url ? "" : '<span class="ed-warn">Falta la dirección: escríbela en el panel</span>'}</p>`,
      );
    case "map": {
      const [lat, lng] = String(b.coords || "")
          .split(",")
          .map(Number),
        ok = Number.isFinite(lat) && Number.isFinite(lng);
      const z = Math.min(18, Math.max(3, Number(b.zoom) || 11)),
        d = (180 / 2 ** z) * 1.6;
      const frame = ok
        ? `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${[lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].map((x) => x.toFixed(5)).join(",")}&layer=mapnik&marker=${lat},${lng}" title="Mapa" loading="lazy" tabindex="-1"></iframe><div class="ed-map-shield"></div>`
        : `<div class="ed-video-empty">Mapa<br><small>Pega un enlace de Google Maps en el panel de la derecha</small></div>`;
      return wrap(
        "blk-media blk-map",
        `<div class="container"><figure class="article-map my-5"><div class="ratio ratio-21x9 map-frame">${frame}</div>${inl(`data-f="${i}:label"`, b.label, "Nombre del lugar (opcional)", "figure-caption cap-field")}</figure></div>`,
      );
    }
    case "video": {
      const thumb = b.id
        ? `<img src="https://i.ytimg.com/vi/${esc(b.id)}/hqdefault.jpg" alt="" class="object-fit-cover" draggable="false"><span class="btn btn-primary font-ui video-play" aria-hidden="true">▶ Ver el video</span>`
        : `<div class="ed-video-empty">Video de YouTube<br><small>Pega el enlace en el panel de la derecha</small></div>`;
      return wrap(
        "blk-media blk-video",
        `<div class="container"><figure class="video-embed my-5"><div class="ratio ratio-16x9 video-frame">${thumb}</div>${inl(`data-f="${i}:caption"`, b.caption, "Descripción (opcional)", "figure-caption cap-field")}</figure></div>`,
      );
    }
    case "h2":
      return text("blk-text blk-h2", "Título de sección");
    case "h3":
      return text("blk-text blk-h3", "Subtítulo");
    case "quote":
      return b.wrap && b.wrap.side
        ? wrap(
            "blk-quote blk-float",
            rich("Cita destacada") + inl(`data-f="${i}:by"`, b.by, "Autor (opcional)", "pullquote-by ed-by"),
            wrapCls(b, "wrap-card"),
          )
        : wrap(
            "blk-text blk-quote",
            rich("Cita destacada") + inl(`data-f="${i}:by"`, b.by, "Autor (opcional)", "pullquote-by ed-by"),
          );
    case "ficha": {
      const f = (S.fichas || {})[b.id];
      if (!f) return wrap("blk-text blk-raw", `<pre>Falta la ficha "${esc(b.id)}"</pre>`);
      const solo = b.wrap && b.wrap.side ? "" : " ficha-solo-blk";
      return wrap(
        "blk-ficha blk-media" + solo,
        `<aside class="ficha${f.tone === "sin fondo" ? " ficha-plain" : ["amarillo", "rojo", "verde"].includes(f.tone) ? ` tone-${f.tone}` : ""}${solo ? " ficha-solo" : ""}">${fichaHTML(f, base, S, b.id)}</aside>`,
        wrapCls(b, "wrap-card"),
      );
    }
    case "foto": {
      const p = S.photos[b.id];
      if (!p) return wrap("blk-text blk-raw", `<pre>Falta la foto "${esc(b.id)}"</pre>`);
      if (b.wrap && b.wrap.side)
        return wrap(
          "blk-media blk-float",
          `<figure class="figure ${p.alt ? "" : "alt-missing"}" style="position:relative;margin:0">${photoFrame(p, base, i, b.id)}${caption(p, b.id)}<div class="edge-handle" title="Arrastra hacia el borde de la pantalla (o al otro lado) para cambiar de lado y de posición"></div></figure>`,
          wrapCls(b, "wrap-photo"),
        );
      return wrap(
        "blk-media blk-photo",
        `<div class="container"><figure class="figure w-100 my-5 ${p.alt ? "" : "alt-missing"}" style="position:relative">${photoFrame(p, base, i, b.id)}${caption(p, b.id)}</figure></div>`,
      );
    }
    case "fila": {
      if (b.tree)
        return wrap(
          "blk-media blk-mosaic" + (b.full ? "" : " blk-row"),
          b.full ? gridHTML(b, S, base, i) : `<div class="container">${gridHTML(b, S, base, i)}</div>`,
        );
      const items = b.ids
        .map((id) => {
          const p = S.photos[id];
          if (!p) return "";
          const si = S.sel && S.sel.i === i && S.sel.id === id ? " is-sel-item" : "";
          return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(id)}" data-cp="${b.ids.indexOf(id)}" style="--g: ${ratioOf(p).toFixed(3)}">${photoFrame(p, base, i, id, true)}${GRIP}${caption(p, id)}</figure>`;
        })
        .join("");
      const rowHtml = `<div class="fila${b.full ? " fila-bleed" : ""} my-5" data-row data-cp="" data-dir="r">${items}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura del mosaico"></div></div>`;
      return wrap(
        "blk-media blk-mosaic" + (b.full ? "" : " blk-row"),
        b.full ? rowHtml : `<div class="container">${rowHtml}</div>`,
      );
    }
    case "pano": {
      const p = S.photos[b.id];
      if (!p) return wrap("blk-text blk-raw", `<pre>Falta la foto "${esc(b.id)}"</pre>`);
      const img = `<img class="pano-img" src="${IMG(base, p.file, "-sm.jpg")}" width="${p.w}" height="${p.h}" alt="" draggable="false">`;
      const cap = caption(p, b.id);
      if (b.mode === "completa")
        return wrap(
          "blk-pano",
          `<figure class="pano-full my-5 ${p.alt ? "" : "alt-missing"}" style="position:relative"><div class="pano-full-frame">${img}</div><div class="container pt-2">${cap}</div></figure>`,
        );
      const hs = b.h ? ` style="--pano-limit: clamp(12rem, ${b.h}vh, ${(b.h * 0.68).toFixed(1)}rem)"` : "";
      return wrap(
        "blk-pano",
        `<figure class="pano${b.mode === "alta" ? " pano-tall" : ""} my-5 ${p.alt ? "" : "alt-missing"}" data-pano data-focus="${Number.isFinite(p.focus) ? p.focus : 50}"${hs}><div class="pano-scroll" data-id="${esc(b.id)}">${img}</div><div class="size-handle" data-size="pano" title="Arrastra para cambiar la altura"></div><div class="container pt-2">${cap}</div></figure>`,
      );
    }
    default:
      return wrap("blk-text blk-raw", `<pre>${esc(b.text)}</pre>`);
  }
}

// The same list feeds the "+" between blocks and the ribbon's "Insertar" button (parent.INSERT_MENU)
export const ins = (at) =>
  `<div class="ins" data-at="${at}"><button type="button" title="Agregar" aria-label="Agregar bloque aquí">+</button></div>`;
// Under a floating photo (or quote, or card): adds below it, not beside it. Its place is found when it is clicked.
export const UNDER = `<div class="ins ins-under" data-under="1"><button type="button" title="Agregar debajo" aria-label="Agregar un bloque debajo de esta foto">+</button></div>`;
