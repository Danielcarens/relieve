// The article canvas. Lives in an iframe so the site's CSS sees the real width (desktop or phone).
const $ = (s, r = document) => r.querySelector(s);
const root = $("#root");
const E = () => parent.ED, A = () => parent.act;
// Photo addresses: in the web editor, photos not published yet are served from this browser (parent.imgSrc)
const IMG = (base, file, suf) => (parent.imgSrc ? parent.imgSrc(base, file, suf) : `${base}${file}${suf}`);
const PREVIEW = new URLSearchParams(location.search).has("preview");
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ic = {
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  dup: '<rect x="9" y="9" width="11" height="11"/><path d="M5 15V5h10"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ic[n]}</svg>`;
const POS = /^(\d{1,3})% (\d{1,3})%$/;
const posOf = (p) => (POS.test(p?.pos || "") ? p.pos : "50% 50%");
const ratioOf = (p) => (Number(p.ratio) > 0 ? Number(p.ratio) : p.w / p.h);

const fit = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
const fitAll = () => document.querySelectorAll("textarea.ed-field").forEach(fit);

// ---- inline formatting: the page shows real bold / italic / links; the file keeps **bold**, *italic*, [text](url) ----
function mdToHtml(md) {
  let h = esc(md).replace(/\\\*/g, "\u0001");
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return h.replace(/\u0001/g, "*").replace(/&lt;br&gt;/g, "<br>");
}
// DOM -> Markdown. Also understands what Word and Google Docs put on the clipboard (bold/italic as inline styles).
function domToMd(node, ctx = { b: false, i: false }) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += n.nodeValue.replace(/ /g, " ").replace(/\*/g, "\\*"); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName, st = n.getAttribute("style") || "";
    if (/^(STYLE|SCRIPT|META|TITLE|IMG|SVG)$/.test(tag) || /mso-list:\s*ignore/i.test(st)) return;
    const w = (st.match(/font-weight:\s*(\w+)/i) || [])[1];
    const bold = !ctx.b && (((tag === "STRONG" || tag === "B") && !/^(normal|[1-5]00)$/i.test(w || "")) || /^(bold|bolder|[6-9]00)$/i.test(w || ""));
    const ital = !ctx.i && (tag === "EM" || tag === "I" || /font-style:\s*italic/i.test(st));
    const inner = domToMd(n, { b: ctx.b || bold, i: ctx.i || ital });
    const mark = (txt, m) => { const t = txt.trim(); if (!t) return txt; const lead = txt.slice(0, txt.length - txt.trimStart().length), tail = txt.slice(txt.trimEnd().length); return lead + m + t + m + tail; };
    let md = inner;
    if (ital) md = mark(md, "*");
    if (bold) md = mark(md, "**");
    if (tag === "A") { const href = n.getAttribute("href") || ""; if (md.trim() && /^(https?:|mailto:|\/|#)/.test(href)) md = `[${md.trim()}](${href})`; }
    else if (tag === "BR") md = n.nextSibling || n.parentNode !== node ? "<br>" : "";   // Shift+Enter line break (a trailing <br> is the browser's, not the writer's)
    out += md;
  });
  return out;
}
// Clipboard HTML (Word, Google Docs, web pages) -> editor blocks
const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|TABLE|TR|SECTION|ARTICLE|HEADER|FOOTER|MAIN|FIGURE)$/;
function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [], inl = (el) => domToMd(el).replace(/\s+/g, " ").trim();
  const add = (b) => { if ((b.text ?? "").trim() || (b.items && b.items.length)) blocks.push(b); };
  const listItem = (type, text) => { const last = blocks[blocks.length - 1]; if (last && last.type === type && last._open) last.items.push(text); else blocks.push({ type, items: [text], _open: true }); };
  const close = () => { const last = blocks[blocks.length - 1]; if (last) delete last._open; };
  let inline = document.createElement("div");
  const flushInline = () => { const t = inl(inline); if (t) { close(); add({ type: "p", text: t }); } inline = document.createElement("div"); };
  const walk = (el) => {
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) inline.appendChild(n.cloneNode()); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (/^(STYLE|SCRIPT|META|TITLE|LINK)$/.test(tag)) continue;
      const hasBlocks = [...n.querySelectorAll("*")].some((d) => BLOCK_TAGS.test(d.tagName));
      if (!BLOCK_TAGS.test(tag) && !hasBlocks) { inline.appendChild(n.cloneNode(true)); continue; }
      flushInline();
      const cls = n.getAttribute("class") || "", st = n.getAttribute("style") || "";
      if (tag === "H1" || tag === "H2") { close(); add({ type: "h2", text: inl(n) }); }
      else if (/^H[3-6]$/.test(tag)) { close(); add({ type: "h3", text: inl(n) }); }
      else if (tag === "UL" || tag === "OL") { close(); const items = [...n.children].filter((c) => c.tagName === "LI").map(inl).filter(Boolean); if (items.length) blocks.push({ type: tag.toLowerCase(), items }); }
      else if (tag === "LI") listItem("ul", inl(n));
      else if (tag === "BLOCKQUOTE") { close(); add({ type: "quote", text: inl(n) }); }
      else if (tag === "TABLE") { close(); n.querySelectorAll("tr").forEach((tr) => add({ type: "p", text: [...tr.children].map(inl).filter(Boolean).join(" · ") })); }
      else if (tag === "P" || (tag === "DIV" && !hasBlocks)) {
        // Word writes lists as paragraphs with a hidden bullet ("·", "o", "1.") marked mso-list:Ignore
        const marker = [...n.querySelectorAll("[style]")].find((x) => /mso-list:\s*ignore/i.test(x.getAttribute("style")));
        const isWordList = /MsoListParagraph/i.test(cls) || /mso-list:/i.test(st);
        if (isWordList) { const num = marker && /^\s*\(?\w{1,3}[.)]/.test(marker.textContent); listItem(num ? "ol" : "ul", inl(n)); }
        else { close(); const t = inl(n); const m = t.match(/^[•·▪◦‣–-]\s+(.*)$/); if (m) listItem("ul", m[1]); else add({ type: "p", text: t }); }
      }
      else walk(n);
    }
  };
  walk(doc.body); flushInline(); blocks.forEach((b) => delete b._open);
  return blocks;
}
// Typed line breaks (Shift+Enter) arrive as "\n" in the editable text; they are kept as <br>
const richMd = (el) => domToMd(el).replace(/[ \t]*\n[ \t]*/g, "<br>").replace(/\s+/g, " ").replace(/(<br>\s*)+$/, "").replace(/^(\s*<br>)+/, "").trim();
// Several paragraphs in one field (text boxes, expandables): one <p> per paragraph, blank line between them in the file
const mdMulti = (md) => String(md || "").split(/\n\s*\n/).filter((x) => x.trim()).map((x) => `<p>${mdToHtml(x.replace(/\s*\n\s*/g, " "))}</p>`).join("");
function richMdMulti(el) {
  const parts = []; let inline = document.createElement("div");
  const push = (n) => { const t = domToMd(n).replace(/\s+/g, " ").trim(); if (t) parts.push(t); };
  const flushInline = () => { push(inline); inline = document.createElement("div"); };
  [...el.childNodes].forEach((n) => { if (n.nodeType === 1 && /^(P|DIV|LI|H\d|BLOCKQUOTE)$/.test(n.tagName)) { flushInline(); push(n); } else inline.appendChild(n.cloneNode(true)); });
  flushInline(); return parts.join("\n\n");
}
const listItems = (el) => [...el.children].filter((n) => n.tagName === "LI").map((li) => domToMd(li).replace(/\s+/g, " ").trim());
window.plainLen = (md) => { const d = document.createElement("div"); d.innerHTML = mdToHtml(md); return d.textContent.length; };
function rangeMd(a, b) { const r = document.createRange(); r.setStart(a.node, a.off); r.setEnd(b.node, b.off); const d = document.createElement("div"); d.appendChild(r.cloneContents()); return domToMd(d).replace(/\s+/g, " "); }
function caretParts(el) {   // markdown before the selection and after it
  const sel = getSelection(); if (!sel.rangeCount) return null; const r = sel.getRangeAt(0);
  return { left: rangeMd({ node: el, off: 0 }, { node: r.startContainer, off: r.startOffset }), right: rangeMd({ node: r.endContainer, off: r.endOffset }, { node: el, off: el.childNodes.length }), collapsed: r.collapsed };
}
function placeCaret(el, n) {   // n = visible characters from the start; undefined = end
  const sel = getSelection(), r = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let left = n ?? Infinity, node;
  while ((node = walker.nextNode())) { if (left <= node.nodeValue.length) { r.setStart(node, left); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); return; } left -= node.nodeValue.length; }
  r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
}
const EDITABLE = ".ed-rich, .ed-list, .ed-inline";   // where the ribbon's bold / italic / link work
const richOf = (t) => (t && t.nodeType === 1 ? t.closest(EDITABLE) : t && t.parentElement ? t.parentElement.closest(EDITABLE) : null);
const fieldOf = (t) => (t && t.nodeType === 1 ? t.closest(".ed-inline, .ed-plain[data-f]") : null);   // one-line fields (captions, authors, data…)
const blkOf = (el) => (el && el.closest ? el.closest(".blk") : null);
// A one-line field with formatting: what it holds as Markdown (**bold**, *italic*, [link](url))
const inlineMd = (el) => domToMd(el).replace(/<br>/g, " ").replace(/\s+/g, " ").trim();
const inl = (attr, value, ph, cls = "", tag = "div") => `<${tag} class="ed-plain ed-inline ${cls}" contenteditable="true" spellcheck="true" ${attr} data-ph="${esc(ph)}">${mdToHtml(value || "")}</${tag}>`;
const blockIndex = (el) => Number(el.closest(".blk").dataset.i);

// ---- grids: a row's tree may hold arrays (vertical stacks, and rows inside them) ------------------
const rOfNode = (n, r, depth) => {
  if (!Array.isArray(n)) return r(n);
  const rs = n.map((c) => rOfNode(c, r, depth + 1));
  return depth % 2 === 0 ? rs.reduce((a, x) => a + x, 0) : 1 / rs.reduce((a, x) => a + 1 / x, 0);
};
// One entry per cell, in document order: { g: share of its row/stack, ar: aspect ratio (cells of a row only) }
function gridVars(tree, r) {
  const out = [];
  const walk = (arr, depth, parentRow) => {
    const rs = arr.map((c) => rOfNode(c, r, depth)), w = rs.map((x) => (parentRow ? x : 1 / x)), sum = w.reduce((a, x) => a + x, 0);
    arr.forEach((c, k) => { out.push({ g: w[k] / sum, ar: parentRow ? rs[k] : null }); if (Array.isArray(c)) walk(c, depth + 1, depth % 2 === 0); });
  };
  walk(tree, 1, true); return out;
}
const cellStyle = (v) => `--g:${v.g.toFixed(4)};--ar:${v.ar ? v.ar.toFixed(4) : "auto"}`;
function gridHTML(b, S, base, i) {
  const vars = gridVars(b.tree, (id) => ratioOf(S.photos[id])); let n = 0;
  const cells = (arr, depth) => arr.map((c) => {
    const v = vars[n], k = n++;
    if (!Array.isArray(c)) {
      const p = S.photos[c]; if (!p) return "";
      const si = S.sel && S.sel.i === i && S.sel.id === c ? " is-sel-item" : "";
      return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(c)}" data-n="${k}" style="${cellStyle(v)}">${photoFrame(p, base, i, c, true)}</figure>`;
    }
    return `<div class="${depth % 2 === 0 ? "fila fila-in" : "fila-col"}" data-n="${k}" style="${cellStyle(v)}">${cells(c, depth + 1)}</div>`;
  }).join("");
  return `<div class="fila fila-grid${b.full ? " fila-bleed" : ""} my-5" data-row data-nested>${cells(b.tree, 1)}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura"></div></div>`;
}
function patchGrid(row, tree, ratios) {   // ratios: { id: ratio }; updates the cells in place while dragging
  const vars = gridVars(tree, (id) => ratios[id]);
  row.querySelectorAll("[data-n]").forEach((el) => { const v = vars[Number(el.dataset.n)]; el.style.cssText = cellStyle(v); if (el.dataset.item) el.querySelector(".ratio").style.setProperty("--bs-aspect-ratio", (100 / ratios[el.dataset.item]).toFixed(3) + "%"); });
}

function photoFrame(p, base, i, id, inRow = false) {
  const r = ratioOf(p);
  return `<div class="ratio figure-img" data-id="${esc(id)}" style="--bs-aspect-ratio: ${(100 / r).toFixed(3)}%">
<img src="${IMG(base, p.file, "-sm.jpg")}" class="object-fit-cover" style="object-position: ${posOf(p)}" alt="" draggable="false">
${inRow ? "" : `<div class="crop-handle" data-id="${esc(id)}" title="Arrastra hacia arriba o abajo para recortar"></div>`}</div>`;
}
const caption = (p, id) => inl(`data-cap="${esc(id)}"`, p.caption, "Descripción (opcional)", "cap-field figure-caption");

const wrapCls = (b, kind) => (b.wrap && b.wrap.side ? ` wrap wrap-${b.wrap.side} wrap-s${b.wrap.size || 40}${b.wrap.edge ? " wrap-edge" : b.wrap.hang ? " wrap-hang" : ""} ${kind}` : "");
const fichaHTML = (f, base, S, id) => {
  const ff = (path, ph, tag = "span") => inl(`data-ff="${esc(id)}:${path}"`, path.split(".").reduce((o, k) => (o == null ? o : o[k]), f), ph, "", tag);
  const photo = f.photo && S.photos[f.photo] ? `<div class="ratio figure-img" style="--bs-aspect-ratio: ${(100 / ratioOf(S.photos[f.photo])).toFixed(3)}%"><img src="${IMG(base, S.photos[f.photo].file, "-sm.jpg")}" class="object-fit-cover" style="object-position: ${posOf(S.photos[f.photo])}" alt="" draggable="false"></div>` : "";
  const title = `<h3 class="ficha-title">${ff("title", "Título de la ficha")}</h3>`;
  const rows = (f.rows || []).map((r, k) => f.format === "tabla" ? `<tr><th scope="row">${ff(`rows.${k}.label`, "Dato")}</th><td>${ff(`rows.${k}.value`, "Valor")}</td></tr>` : `<div><dt>${ff(`rows.${k}.label`, "Dato")}</dt> <dd>${ff(`rows.${k}.value`, "Valor")}</dd></div>`).join("");
  const list = !rows ? '<p class="text-body-secondary mb-0 ed-aid">Ficha vacía: agrega datos con el botón «Agregar dato» del panel.</p>' : f.format === "tabla" ? `<table class="ficha-table"><tbody>${rows}</tbody></table>` : `<dl class="ficha-list">${rows}</dl>`;
  return `${photo}<div class="ficha-body">${title}${list}</div>`;
};

// Text box look: the same classes the site's {% recuadro %} writes
const recuadroCls = (b) => { const f = b.fondo || "gris"; return [`fondo-${f}`, ["amarillo", "rojo", "verde"].includes(f) ? `tone-${f}` : "", b.marco ? "has-marco" : "", b.linea ? `linea-${b.linea}` : ""].filter(Boolean).join(" "); };
// Same rule as the site's {% caja %}: each edge is a share of the photos' width, or "texto" (the reading column's edge)
const COL = "min(46rem, 100% - 1.5rem)";
const edgeX = (v, side) => (v === "texto" ? `calc((100% ${side === "l" ? "-" : "+"} ${COL}) / 2)` : `calc((100% - var(--cw-inner)) / 2 + var(--cw-inner) * ${v} / 100)`);
const boxVars = (x) => `--x1: ${edgeX(x.l, "l")}; --x2: ${edgeX(x.r, "r")}`;
const BOXABLE = ["p", "h2", "h3", "ul", "ol", "callout", "details", "datos"];
// A floating photo, quote or card wraps the text that comes AFTER it. If nothing comes after it, say so.
const BESIDE = ["p", "ul", "ol", "h3", "callout", "details", "button", "raw"];
function floatHint(S, i) {
  let k = i + 1; while (S.blocks[k] && S.blocks[k].wrap && S.blocks[k].wrap.side) k++;   // another float goes below this one; the text after it still wraps
  const nx = S.blocks[k], pv = S.blocks[i - 1], b = S.blocks[i];
  if (nx && BESIDE.includes(nx.type)) return "";
  const what = b.type === "quote" ? "la cita" : b.type === "ficha" ? "la ficha" : "la foto";
  const up = pv && ["p", "ul", "ol", "h3"].includes(pv.type);
  return `<div class="float-hint ed-aid">El texto rodea ${what} solo si va <strong>debajo</strong> de ella, y aquí no hay texto debajo. ${up ? `<button type="button" data-a="float-up">Subirla un párrafo</button>` : "Pon un párrafo debajo, o elige «En su propia fila» en el panel."}</div>`;
}

function blockHTML(b, i, S) {
  const base = S.meta.imgBase || "";
  const tools = `<div class="blk-tools">
<button data-a="up" title="Subir">${svg("up")}</button><button data-a="down" title="Bajar">${svg("down")}</button>
<button data-a="dup" title="Duplicar">${svg("dup")}</button><button data-a="del" title="Eliminar">${svg("del")}</button></div>`;
  const handle = `<div class="blk-handle" draggable="true" title="Arrastra para mover">${svg("grip")}</div>`;
  const sel = S.sel && S.sel.i === i ? " is-sel" : "";
  const boxable = BOXABLE.includes(b.type) && !(b.wrap && b.wrap.side);
  const box = boxable && b.box ? ` has-box" style="${boxVars(b.box)}` : "";
  const edges = boxable ? '<div class="box-handle" data-side="l" title="Arrastra para cambiar el ancho del texto. Doble clic: ancho normal"></div><div class="box-handle" data-side="r" title="Arrastra para cambiar el ancho del texto. Doble clic: ancho normal"></div>' : "";
  const wrap = (cls, inner, extra = "") => `<div class="blk ${cls}${extra}${sel}${b.align === "center" ? " is-center" : ""}${box}" data-i="${i}">${handle}${tools}${edges}${inner}${extra.includes(" wrap ") ? floatHint(S, i) : ""}</div>`;
  const rich = (ph) => `<div class="ed-field ed-rich" contenteditable="true" spellcheck="true" data-t="${i}" data-ph="${ph}">${mdToHtml(b.text)}</div>`;
  const text = (cls, ph) => wrap(cls, rich(ph));
  const plain = (key, ph, cls = "", tag = "div") => `<${tag} class="ed-plain ${cls}" contenteditable="plaintext-only" spellcheck="true" data-f="${i}:${key}" data-ph="${ph}">${esc(key.split(".").reduce((o, k) => (o == null ? o : o[k]), b) || "")}</${tag}>`;
  switch (b.type) {
    case "p": return text("blk-text", "Escribe aquí…");
    case "ul": case "ol": {
      const items = (b.items && b.items.length ? b.items : [""]).map((x) => `<li>${mdToHtml(x)}</li>`).join("");
      return wrap("blk-text blk-list", `<${b.type} class="ed-field ed-list" contenteditable="true" spellcheck="true" data-l="${i}">${items}</${b.type}>`);
    }
    case "callout": return wrap("blk-text blk-callout", `<aside class="recuadro ${recuadroCls(b)}"><div class="rq-line-hit" title="Clic: cambia el color de la línea (rosa, amarillo, verde, rojo, sin línea)"></div><div class="ed-field ed-rich ed-multi" contenteditable="true" spellcheck="true" data-t="${i}" data-multi="1" data-ph="Texto del recuadro…">${mdMulti(b.text)}</div></aside>`);
    case "details": return wrap("blk-text blk-details", `<div class="desplegable ed-desplegable"><div class="ed-summary">${inl(`data-f="${i}:title"`, b.title, "Pregunta o título del desplegable", "ed-summary-text")}<span aria-hidden="true">−</span></div><div class="desplegable-body"><div class="ed-field ed-rich ed-multi" contenteditable="true" spellcheck="true" data-t="${i}" data-multi="1" data-ph="Lo que se ve al abrirlo…">${mdMulti(b.text)}</div></div></div>`);
    case "hr": return wrap("blk-text blk-hr", `<hr class="article-rule">`);
    case "space": return wrap("blk-text blk-space", `<div class="article-space ed-space" style="height:${Number(b.size) || 3}rem"><span>Espacio · ${Number(b.size) || 3} rem</span><div class="size-handle" data-size="space" title="Arrastra para cambiar la altura"></div></div>`);
    case "datos": return wrap("blk-media blk-datos", `<div class="container"><div class="datos-wrap py-4 my-5 border-top border-bottom border-2 border-strong"><dl class="row row-cols-2 row-cols-md-4 g-4 mb-0 datos">${(b.rows || []).map((r, k) => `<div class="col"><dt class="small-meta fw-semibold font-ui">${inl(`data-f="${i}:rows.${k}.label"`, r.label, "Dato", "", "span")}</dt><dd class="h3 mb-0">${inl(`data-f="${i}:rows.${k}.value"`, r.value, "Valor", "", "span")}</dd></div>`).join("")}</dl></div></div>`);
    case "button": return wrap("blk-text blk-button", `<p class="article-cta"><span class="btn ${b.style === "secundario" ? "btn-outline-dark" : "btn-primary"} ed-btn">${plain("text", "Texto del botón", "", "span")}</span>${b.url ? "" : '<span class="ed-warn">Falta la dirección: escríbela en el panel</span>'}</p>`);
    case "map": {
      const [lat, lng] = String(b.coords || "").split(",").map(Number), ok = Number.isFinite(lat) && Number.isFinite(lng);
      const z = Math.min(18, Math.max(3, Number(b.zoom) || 11)), d = 180 / 2 ** z * 1.6;
      const frame = ok ? `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${[lng - d * 1.6, lat - d, lng + d * 1.6, lat + d].map((x) => x.toFixed(5)).join(",")}&layer=mapnik&marker=${lat},${lng}" title="Mapa" loading="lazy" tabindex="-1"></iframe><div class="ed-map-shield"></div>` : `<div class="ed-video-empty">Mapa<br><small>Pega un enlace de Google Maps en el panel de la derecha</small></div>`;
      return wrap("blk-media blk-map", `<div class="container"><figure class="article-map my-5"><div class="ratio ratio-21x9 map-frame">${frame}</div>${inl(`data-f="${i}:label"`, b.label, "Nombre del lugar (opcional)", "figure-caption cap-field")}</figure></div>`);
    }
    case "video": {
      const thumb = b.id ? `<img src="https://i.ytimg.com/vi/${esc(b.id)}/hqdefault.jpg" alt="" class="object-fit-cover" draggable="false"><span class="btn btn-primary font-ui video-play" aria-hidden="true">▶ Ver el video</span>` : `<div class="ed-video-empty">Video de YouTube<br><small>Pega el enlace en el panel de la derecha</small></div>`;
      return wrap("blk-media blk-video", `<div class="container"><figure class="video-embed my-5"><div class="ratio ratio-16x9 video-frame">${thumb}</div>${inl(`data-f="${i}:caption"`, b.caption, "Descripción (opcional)", "figure-caption cap-field")}</figure></div>`);
    }
    case "h2": return text("blk-text blk-h2", "Título de sección");
    case "h3": return text("blk-text blk-h3", "Subtítulo");
    case "quote": return b.wrap && b.wrap.side
      ? wrap("blk-quote blk-float", rich("Cita destacada") + inl(`data-f="${i}:by"`, b.by, "Autor (opcional)", "pullquote-by ed-by"), wrapCls(b, "wrap-card"))
      : wrap("blk-text blk-quote", rich("Cita destacada") + inl(`data-f="${i}:by"`, b.by, "Autor (opcional)", "pullquote-by ed-by"));
    case "ficha": {
      const f = (S.fichas || {})[b.id];
      if (!f) return wrap("blk-text blk-raw", `<pre>Falta la ficha "${esc(b.id)}"</pre>`);
      const solo = b.wrap && b.wrap.side ? "" : " ficha-solo-blk";
      return wrap("blk-ficha blk-media" + solo, `<aside class="ficha${f.tone === "sin fondo" ? " ficha-plain" : ["amarillo", "rojo", "verde"].includes(f.tone) ? ` tone-${f.tone}` : ""}${solo ? " ficha-solo" : ""}">${fichaHTML(f, base, S, b.id)}</aside>`, wrapCls(b, "wrap-card"));
    }
    case "foto": {
      const p = S.photos[b.id];
      if (!p) return wrap("blk-text blk-raw", `<pre>Falta la foto "${esc(b.id)}"</pre>`);
      if (b.wrap && b.wrap.side) return wrap("blk-media blk-float", `<figure class="figure ${p.alt ? "" : "alt-missing"}" style="position:relative;margin:0">${photoFrame(p, base, i, b.id)}${caption(p, b.id)}<div class="edge-handle" title="Arrastra hacia el borde de la pantalla (o al otro lado) para cambiar de lado y de posición"></div></figure>`, wrapCls(b, "wrap-photo"));
      return wrap("blk-media", `<div class="container"><figure class="figure w-100 my-5 ${p.alt ? "" : "alt-missing"}" style="position:relative">${photoFrame(p, base, i, b.id)}${caption(p, b.id)}</figure></div>`);
    }
    case "fila": {
      if (b.tree) return wrap("blk-media", b.full ? gridHTML(b, S, base, i) : `<div class="container">${gridHTML(b, S, base, i)}</div>`);
      const items = b.ids.map((id) => {
        const p = S.photos[id]; if (!p) return "";
        const si = S.sel && S.sel.i === i && S.sel.id === id ? " is-sel-item" : "";
        return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(id)}" style="--g: ${ratioOf(p).toFixed(3)}">${photoFrame(p, base, i, id, true)}${caption(p, id)}</figure>`;
      }).join("");
      const rowHtml = `<div class="fila${b.full ? " fila-bleed" : ""} my-5" data-row>${items}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura de la fila"></div></div>`;
      return wrap("blk-media", b.full ? rowHtml : `<div class="container">${rowHtml}</div>`);
    }
    case "pano": {
      const p = S.photos[b.id];
      if (!p) return wrap("blk-text blk-raw", `<pre>Falta la foto "${esc(b.id)}"</pre>`);
      const img = `<img class="pano-img" src="${IMG(base, p.file, "-sm.jpg")}" width="${p.w}" height="${p.h}" alt="" draggable="false">`;
      const cap = caption(p, b.id);
      if (b.mode === "completa") return wrap("blk-pano", `<figure class="pano-full my-5 ${p.alt ? "" : "alt-missing"}" style="position:relative"><div class="pano-full-frame">${img}</div><div class="container pt-2">${cap}</div></figure>`);
      const hs = b.h ? ` style="--pano-limit: clamp(12rem, ${b.h}vh, ${(b.h * 0.68).toFixed(1)}rem)"` : "";
      return wrap("blk-pano", `<figure class="pano${b.mode === "alta" ? " pano-tall" : ""} my-5 ${p.alt ? "" : "alt-missing"}" data-pano data-focus="${Number.isFinite(p.focus) ? p.focus : 50}"${hs}><div class="pano-scroll" data-id="${esc(b.id)}">${img}</div><div class="size-handle" data-size="pano" title="Arrastra para cambiar la altura"></div><div class="container pt-2">${cap}</div></figure>`);
    }
    default: return wrap("blk-text blk-raw", `<pre>${esc(b.text)}</pre>`);
  }
}

// The same list feeds the "+" between blocks and the ribbon's "Insertar" button (parent.INSERT_MENU)
const ins = (at) => `<div class="ins" data-at="${at}"><button type="button" title="Agregar" aria-label="Agregar bloque aquí">+</button></div>`;

function heroHTML(S) {
  const m = S.meta, h = m.hero;
  const dirMatch = /\/assets\/img\/([^/]+)\//.exec(m.imgBase || "");
  let inner;
  if (h) {
    const orig = h.srcW && dirMatch;   // the original lets you drag to frame it
    const src = parent.heroSrc ? parent.heroSrc(m) : orig ? `/originals/${dirMatch[1]}/hero-source.jpg?v=${S.heroV || 0}` : `${m.imgBase}${h.file}-1280.jpg?v=${S.heroV || 0}`;
    const hint = !h.srcW ? "La portada siempre es 16:9. Para encuadrarla de nuevo, elige la foto otra vez con «Cambiar foto»."
      : Math.abs(h.srcW / h.srcH - 16 / 9) < 0.02 ? "Esta foto ya tiene forma 16:9: se ve completa, no hay nada que encuadrar."
      : `La portada siempre es 16:9. Arrastra la foto ${h.srcW / h.srcH > 16 / 9 ? "a los lados" : "hacia arriba o abajo"} para encuadrarla.`;
    inner = `<img src="${src}" style="object-position: ${esc(h.pos || "50% 50%")}" alt="" draggable="false"><div class="ed-hero-actions"><button class="btn btn-light btn-sm rounded-0" data-hero="replace">Cambiar foto</button></div><div class="ed-hero-hint">${hint}</div>`;
  } else inner = `<div class="ed-hero-empty"><div><strong>Foto principal</strong><br>Arrastra una foto aquí o haz clic para elegirla</div></div>`;
  const cab = m.cabecera || "";
  const drag = h && h.srcW && Math.abs(h.srcW / h.srcH - 16 / 9) >= 0.02;
  const photo = `<div class="ed-hero-img ${h ? "" : "ed-hero-empty"}${drag ? " can-drag" : ""}" data-hero="${h ? "img" : "pick"}">${inner}</div>${h ? `<div class="container pt-2">${inl('data-m="hero.caption"', h.caption, "Descripción de la portada (opcional)", "figure-caption cap-field")}</div>` : ""}`;
  const titles = `<div class="container ed-head"><div class="ed-date font-ui">${esc(m.date || "")}${m.draft ? " · Borrador" : ""}${cab ? ` · Cabecera: ${cab === "texto" ? "solo título" : "título arriba"}` : ""}</div>
<textarea class="ed-field ed-title" rows="1" data-m="title" placeholder="Título del artículo">${esc(m.title || "")}</textarea>
${inl('data-m="subtitle"', m.subtitle, "Subtítulo (opcional)", "ed-field ed-sub mt-2")}</div>`;
  const ai = m.ai ? `<div class="notice-band tone-amarillo mt-4" role="note"><div class="container py-3"><strong>Versión de prueba.</strong> Este artículo fue escrito enteramente con inteligencia artificial, solo para probar el diseño de la revista. El texto definitivo lo escribirá el autor.</div></div>` : "";
  if (cab === "texto") return `<header class="ed-hero-wrap ed-cab-texto pt-4">${titles}</header>${ai}`;
  if (cab === "titulo") return `<header class="ed-hero-wrap ed-cab-titulo pt-4">${titles}<div class="container mt-4">${photo}</div></header>${ai}`;
  return `<header class="ed-hero-wrap">${photo}${titles}</header>${ai}`;
}

function render() {
  const S = E(); if (!S || !S.meta) { root.innerHTML = ""; return; }
  const y = scrollY;
  let html = heroHTML(S) + `<main><div class="article-body">${ins(0)}`;
  S.blocks.forEach((b, i) => { html += blockHTML(b, i, S) + ins(i + 1); });
  html += `</div><div class="drop-overlay">Suelta las fotos para agregarlas</div></main>`;
  root.innerHTML = html;
  fitAll(); layoutPanos(); layoutRows(); scrollTo(0, y);
  if (S.focus) {
    const f = S.focus; S.focus = null;
    let t = (f.field && $(`.blk[data-i="${f.i}"] [data-f]`)) || $(`[data-t="${f.i}"]`) || $(`[data-l="${f.i}"]`) || $(`.blk[data-i="${f.i}"] [data-f]`);
    if (t) { t.focus(); const target = t.matches(".ed-list") ? t.children[f.li ?? (f.caret === undefined ? t.children.length - 1 : 0)] || t : t; placeCaret(target, f.caret); }
  }
}
window.render = render;

function layoutPanos() {
  document.querySelectorAll("[data-pano] .pano-scroll").forEach((sc) => {
    const img = sc.querySelector("img"); const fig = sc.closest("[data-pano]");
    const set = () => { fig.style.setProperty("--pano-min", Math.ceil(fig.clientWidth / (img.width / img.height)) + "px");
      const f = Number(fig.dataset.focus) / 100; sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * f; };
    img.complete ? set() : img.addEventListener("load", set, { once: true });
  });
}
addEventListener("resize", () => { fitAll(); layoutPanos(); layoutRows(); });
// The title box measures its height with the page's fonts: measure again once they have loaded
if (document.fonts) { document.fonts.ready.then(fitAll); document.fonts.addEventListener("loadingdone", fitAll); }

// Rows: a handle under the row changes its height; dividers between photos move the crop from one to the other.
function layoutRows() {
  document.querySelectorAll("[data-row]:not([data-nested])").forEach((row) => {
    row.querySelectorAll(".divider").forEach((d) => d.remove());
    const items = [...row.querySelectorAll(".fila-item")];
    const rr = row.getBoundingClientRect();
    items.slice(0, -1).forEach((it, k) => {
      const a = it.getBoundingClientRect(), b = items[k + 1].getBoundingClientRect();
      const d = document.createElement("div"); d.className = "divider"; d.dataset.k = k; d.title = "Arrastra a los lados para repartir el ancho entre las dos fotos";
      d.style.left = (a.right + b.left) / 2 - rr.left - 8 + "px"; d.style.height = a.height - 0 + "px"; row.appendChild(d);
      const fr = it.querySelector(".ratio").getBoundingClientRect(); d.style.height = fr.height + "px";
    });
  });
}
const clampR = (r) => Math.round(Math.max(0.4, Math.min(5, r)) * 1000) / 1000;
function patchRatios(row, ratios) {
  row.querySelectorAll(".fila-item").forEach((it, k) => { it.style.setProperty("--g", ratios[k].toFixed(3)); it.querySelector(".ratio").style.setProperty("--bs-aspect-ratio", (100 / ratios[k]).toFixed(3) + "%"); });
}
root.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const rh = e.target.closest(".row-handle"), dv = e.target.closest(".divider");
  if (!rh && !dv) return;
  const row = e.target.closest("[data-row]"), S = E();
  const items = [...row.querySelectorAll(".fila-item")], ids = items.map((n) => n.dataset.item);
  const r0 = ids.map((id) => ratioOf(S.photos[id]));
  const nested = row.hasAttribute("data-nested"), blk = S.blocks[Number(row.closest(".blk").dataset.i)];
  const h0 = nested ? row.getBoundingClientRect().height - 0 : items[0].querySelector(".ratio").getBoundingClientRect().height;
  const widths = items.map((n) => n.querySelector(".ratio").getBoundingClientRect().width);
  e.preventDefault(); const cap = e.target; cap.setPointerCapture(e.pointerId);
  A().select(Number(row.closest(".blk").dataset.i), null);
  const sx = e.clientX, sy = e.clientY; let cur = r0;
  const move = (ev) => {
    if (rh) { const k = h0 / Math.max(40, h0 + (ev.clientY - sy)); cur = r0.map((r) => clampR(r * k)); }
    else {
      const k = Number(dv.dataset.k); const dx = ev.clientX - sx;
      const wi = Math.max(h0 * 0.4, widths[k] + dx), wj = Math.max(h0 * 0.4, widths[k + 1] - dx);
      cur = r0.slice(); cur[k] = clampR(wi / h0); cur[k + 1] = clampR(wj / h0);
    }
    if (nested) patchGrid(row, blk.tree, Object.fromEntries(ids.map((id, k) => [id, cur[k]]))); else patchRatios(row, cur);
  };
  const up = () => { cap.removeEventListener("pointermove", move); cap.removeEventListener("pointerup", up);
    if (cur.some((r, k) => Math.abs(r - r0[k]) > 0.001)) A().setRatios(Object.fromEntries(ids.map((id, k) => [id, cur[k]]))); else layoutRows(); };
  cap.addEventListener("pointermove", move); cap.addEventListener("pointerup", up);
});

// ---- events ------------------------------------------------------------------
let openMenu = null;
const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu.closest(".ins")?.classList.remove("is-open"); openMenu = null; } };

root.addEventListener("click", (e) => {
  const t = e.target;
  const insBtn = t.closest(".ins > button");
  if (insBtn) {
    const bar = insBtn.parentElement; const was = openMenu && openMenu.parentElement === bar; closeMenu(); if (was) return;
    const m = document.createElement("div"); m.className = "ins-menu";
    m.innerHTML = (parent.INSERT_MENU || []).map(([k, l]) => (k ? `<button data-add="${k}">${l}</button>` : `<h6>${l}</h6>`)).join("");
    bar.appendChild(m); bar.classList.add("is-open"); openMenu = m; return;
  }
  const add = t.closest("[data-add]");
  if (add) { const at = Number(add.closest(".ins").dataset.at); closeMenu(); A().add(add.dataset.add, at); return; }
  closeMenu();
  const hero = t.closest("[data-hero]");
  if (hero && (t.closest('[data-hero="replace"]') || hero.dataset.hero === "pick")) { A().pickHero(); return; }
  if (t.closest('[data-a="float-up"]')) { A().tool("up", Number(t.closest(".blk").dataset.i)); return; }
  if (t.closest(".rq-line-hit")) { A().cycleLine(Number(t.closest(".blk").dataset.i)); return; }
  const tool = t.closest(".blk-tools button");
  if (tool) { const i = Number(tool.closest(".blk").dataset.i); A().tool(tool.dataset.a, i); return; }
  if (!t.closest(".blk") && t.closest(".article-body") && e.clientY > ([...document.querySelectorAll(".article-body > .blk")].pop()?.getBoundingClientRect().bottom ?? Infinity)) { A().continueAtEnd(); return; }
  const blk = t.closest(".blk");
  if (blk) {
    const item = t.closest("[data-item]");
    A().select(Number(blk.dataset.i), item ? item.dataset.item : null);
  } else A().select(null);
});

root.addEventListener("input", (e) => {
  const f = fieldOf(e.target);
  if (f) {
    if (!f.textContent) f.innerHTML = "";
    const v = f.matches(".ed-inline") ? inlineMd(f) : f.textContent.replace(/\s+/g, " ").trim(), d = f.dataset;
    if (d.f) { const [i, key] = d.f.split(":"); A().setField(Number(i), key, v); }
    else if (d.cap) A().setPhoto(d.cap, { caption: v }, true);
    else if (d.m) A().setMeta(d.m, v || undefined, true);
    else if (d.ff) { const [id, path] = d.ff.split(":"); A().setFicha(id, path, v); }
    return;
  }
  const rt = richOf(e.target);
  if (rt && rt.matches(".ed-list")) {
    if (![...rt.children].some((n) => n.tagName === "LI")) { const txt = rt.textContent; rt.innerHTML = `<li>${esc(txt)}</li>`; placeCaret(rt.firstChild); }
    A().setItems(Number(rt.dataset.l), listItems(rt)); return;
  }
  if (rt) {
    if (!rt.textContent) rt.innerHTML = "";
    const i = Number(rt.dataset.t);
    if (rt.dataset.multi) { A().setText(i, richMdMulti(rt)); return; }
    const md = richMd(rt);
    // Word-style autoformat at the start of a paragraph: "- " list, "1. " numbered list, "## " title, "### " subtitle, "> " quote
    if (E().blocks[i]?.type === "p" && e.inputType === "insertText" && e.data === " ") {
      const c = caretParts(rt), left = c ? c.left : "";
      const kinds = { "- ": "ul", "\\* ": "ul", "1. ": "ol", "1) ": "ol", "## ": "h2", "### ": "h3", "> ": "quote" };
      if (kinds[left]) { A().autoformat(i, kinds[left], md.slice(left.trim().length).trim()); return; }
    }
    A().setText(i, md); return;
  }
  const t = e.target; if (!(t instanceof HTMLTextAreaElement)) return; fit(t);
  if (t.dataset.m) A().setMeta(t.dataset.m, t.value, true);
});

// Caret helpers for moving between blocks like in Word
function caretLine(el) {
  const sel = getSelection(); if (!sel.rangeCount) return { first: true, last: true, start: true, end: true };
  const r = sel.getRangeAt(0);
  const before = document.createRange(); before.selectNodeContents(el); before.setEnd(r.startContainer, r.startOffset);
  const after = document.createRange(); after.selectNodeContents(el); after.setStart(r.endContainer, r.endOffset);
  const start = before.toString().length === 0, end = after.toString().length === 0;
  const rects = r.getClientRects(), cr = rects[rects.length - 1], er = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 28;
  return { collapsed: r.collapsed, start, end, first: start || !cr || cr.top - er.top < lh * 0.8, last: end || !cr || er.bottom - cr.bottom < lh * 0.8 };
}
const editables = () => [...document.querySelectorAll(".ed-rich[data-t], .ed-list")];
function goTo(el, atEnd) {
  if (!el) return false;
  el.focus(); const t = el.matches(".ed-list") ? (atEnd ? el.lastElementChild : el.firstElementChild) || el : el;
  placeCaret(t, atEnd ? undefined : 0); A().select(blockIndex(el), null, true); return true;
}

root.addEventListener("keydown", (e) => {
  const f = fieldOf(e.target);
  if (f) { if (e.key === "Enter") { e.preventDefault(); f.blur(); } return; }
  const t = richOf(e.target); if (!t) return;
  const isList = t.matches(".ed-list"), multi = !!t.dataset.multi, i = blockIndex(t);
  const nav = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (nav) {
    const c = caretLine(t); if (!c.collapsed) return;
    const all = editables(), k = all.indexOf(t);
    if ((e.key === "ArrowUp" && c.first) || (e.key === "ArrowLeft" && c.start)) { if (goTo(all[k - 1], true)) e.preventDefault(); }
    else if ((e.key === "ArrowDown" && c.last) || (e.key === "ArrowRight" && c.end)) { if (goTo(all[k + 1], false)) e.preventDefault(); }
    return;
  }
  if (isList) {
    const sel = getSelection(); const li = sel.rangeCount ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest("li") : null;
    const n = li ? [...t.children].indexOf(li) : -1;
    if (e.key === "Enter" && !e.shiftKey && li && !li.textContent.trim()) { e.preventDefault(); A().listExit(i, n); }
    else if (e.key === "Backspace" && li && n === 0 && caretLine(li).start && caretLine(li).collapsed) { e.preventDefault(); A().listUnwrapFirst(i); }
    return;
  }
  if (multi) return;   // text boxes and expandables: Enter makes a new paragraph inside
  if (e.key === "Enter") {
    e.preventDefault(); if (e.shiftKey) { document.execCommand("insertLineBreak"); return; }
    if (E().blocks[i]?.type === "p" && /^(-{3,}|(\\\*){3,}|_{3,})$/.test(richMd(t))) { A().toRule(i); return; }   // Word: "---" + Enter draws a line
    const c = caretParts(t); if (c) A().split(i, c.left, c.right);
  }
  else if (e.key === "Backspace" && i > 0) { const c = caretParts(t); if (c && c.collapsed && c.left === "" && A().mergePrev(i)) e.preventDefault(); }
  else if (e.key === "Delete") { const c = caretLine(t); if (c.collapsed && c.end && A().mergePrev(i + 1)) e.preventDefault(); }
});
root.addEventListener("paste", (e) => {
  const f = fieldOf(e.target);
  if (f) { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") || "").replace(/\s+/g, " ")); return; }
  const t = richOf(e.target); if (!t) return;
  e.preventDefault();
  const files = [...(e.clipboardData?.files || [])].filter((x) => /^image\//.test(x.type));
  if (files.length) { A().dropFiles(files, blockIndex(t) + 1); return; }
  const html = e.clipboardData?.getData("text/html") || "";
  if (html && t.dataset.t !== undefined && !t.dataset.multi) {
    const blocks = htmlToBlocks(html);
    if (blocks.length > 1 || (blocks[0] && blocks[0].type !== "p")) { const c = caretParts(t); if (c) A().pasteBlocks(Number(t.dataset.t), c.left, c.right, blocks); return; }
    if (blocks[0]) { document.execCommand("insertHTML", false, mdToHtml(blocks[0].text)); return; }
  }
  if (html && (t.dataset.multi || t.matches(".ed-list"))) {
    const blocks = htmlToBlocks(html), texts = blocks.flatMap((b) => b.items || [b.text]);
    if (texts.length) { document.execCommand("insertHTML", false, t.dataset.multi ? texts.map((x) => `<p>${mdToHtml(x)}</p>`).join("") : texts.map((x) => mdToHtml(x)).join("<br>")); return; }
  }
  const txt = (e.clipboardData?.getData("text/plain") || "").replace(/\r/g, "");
  if (t.dataset.t !== undefined && !t.dataset.multi && /\n\s*\n/.test(txt)) { const c = caretParts(t); if (c) A().pasteMany(Number(t.dataset.t), c.left, c.right, txt); }
  else if (t.dataset.multi) document.execCommand("insertText", false, txt.replace(/\n\s*\n/g, "\n").replace(/[ \t]*\n[ \t]*/g, "\n")) ;
  else document.execCommand("insertText", false, txt.replace(/\s*\n\s*/g, " "));
});
document.addEventListener("focusin", (e) => {
  const t = richOf(e.target) || fieldOf(e.target); if (t && t.closest(".blk")) A().caretIn(blockIndex(t));
  // the title and the button's text take no formatting: the ribbon says so instead of formatting the last paragraph
  if (e.target.matches && e.target.matches('textarea[data-m="title"], .ed-plain:not(.ed-inline)')) { window.lastRange = null; window.plainField = e.target.matches("textarea") ? "El título no lleva negritas, cursivas ni enlaces." : "El texto del botón no lleva formato; su enlace se escribe en el panel."; }
});
try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}

// Word shortcuts (the ribbon shows them in its tooltips)
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey; if (!mod) return;
  const k = e.key.toLowerCase(), t = richOf(e.target);
  if (k === "s") { e.preventDefault(); A().saveNow(); }
  else if (k === "k" && t) { e.preventDefault(); A().ribbon("link"); }
  else if (e.altKey && (k === "1" || e.code === "Digit1")) { e.preventDefault(); A().ribbon("h2"); }
  else if (e.altKey && (k === "2" || e.code === "Digit2")) { e.preventDefault(); A().ribbon("h3"); }
  else if (e.shiftKey && k === "n") { e.preventDefault(); A().ribbon("p"); }
  else if (e.shiftKey && k === "l") { e.preventDefault(); A().ribbon("ul"); }
  else if (!e.shiftKey && !e.altKey && k === "e" && t && !t.matches(".ed-inline")) { e.preventDefault(); A().ribbon("center"); }
  else if (!e.shiftKey && !e.altKey && k === "l" && t && !t.matches(".ed-inline")) { e.preventDefault(); A().ribbon("left"); }
  else if (!e.shiftKey && k === "h") { e.preventDefault(); A().ribbon("find"); }
});

// ---- dragging inside photos: move the crop, or resize it ------------------------------
root.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const handle = e.target.closest(".crop-handle");
  const frame = e.target.closest(".blk-media .ratio");
  if (!frame) return;
  const S = E(), id = frame.dataset.id, p = S.photos[id], img = frame.querySelector("img");
  const rect = frame.getBoundingClientRect();
  const item = frame.closest(".fila-item");
  e.preventDefault(); frame.setPointerCapture(e.pointerId);
  A().select(Number(frame.closest(".blk").dataset.i), item ? id : null);
  const sx = e.clientX, sy = e.clientY;
  if (handle) {
    const w0 = rect.width, h0 = rect.height; let ratio = ratioOf(p);
    const move = (ev) => {
      const nh = Math.max(w0 / 4, Math.min(w0 / 0.5, h0 + (ev.clientY - sy)));
      ratio = Math.round((w0 / nh) * 1000) / 1000;
      frame.style.setProperty("--bs-aspect-ratio", (100 / ratio).toFixed(3) + "%");
      if (item) item.style.setProperty("--g", ratio.toFixed(3));
    };
    const up = () => { frame.removeEventListener("pointermove", move); frame.removeEventListener("pointerup", up); if (Math.abs(ratio - ratioOf(p)) > 0.001) A().setPhoto(id, { ratio }, false, true); };
    frame.addEventListener("pointermove", move); frame.addEventListener("pointerup", up);
    return;
  }
  frame.classList.add("is-dragging");
  const [px0, py0] = posOf(p).split(" ").map((v) => parseFloat(v));
  const fr = rect.width / rect.height, ir = p.w / p.h;
  let pos = posOf(p);
  const move = (ev) => {
    let px = px0, py = py0;
    if (ir > fr) { const over = rect.height * ir - rect.width; if (over > 1) px = px0 - ((ev.clientX - sx) / over) * 100; }
    else { const over = rect.width / ir - rect.height; if (over > 1) py = py0 - ((ev.clientY - sy) / over) * 100; }
    px = Math.max(0, Math.min(100, px)); py = Math.max(0, Math.min(100, py));
    pos = `${Math.round(px)}% ${Math.round(py)}%`; img.style.objectPosition = pos;
  };
  const up = () => { frame.classList.remove("is-dragging"); frame.removeEventListener("pointermove", move); frame.removeEventListener("pointerup", up); if (pos !== posOf(p)) A().setPhoto(id, { pos }, false, true); };
  frame.addEventListener("pointermove", move); frame.addEventListener("pointerup", up);
});

// Hero: drag to frame it (works on the original photo; the server re-crops when you let go)
root.addEventListener("pointerdown", (e) => {
  const box = e.target.closest('[data-hero="img"]'); if (!box || e.target.closest("button") || e.button !== 0) return;
  const S = E(), h = S.meta.hero, img = box.querySelector("img"); if (!h || !box.classList.contains("can-drag")) return;
  e.preventDefault(); box.setPointerCapture(e.pointerId);
  const rect = box.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
  const [px0, py0] = (POS.test(h.pos || "") ? h.pos : "50% 50%").split(" ").map(parseFloat);
  const ir = h.srcW / h.srcH, fr = rect.width / rect.height;
  let pos = h.pos || "50% 50%";
  const move = (ev) => {
    let px = px0, py = py0;
    if (ir > fr) { const over = rect.height * ir - rect.width; if (over > 1) px = px0 - ((ev.clientX - sx) / over) * 100; }
    else { const over = rect.width / ir - rect.height; if (over > 1) py = py0 - ((ev.clientY - sy) / over) * 100; }
    pos = `${Math.round(Math.max(0, Math.min(100, px)))}% ${Math.round(Math.max(0, Math.min(100, py)))}%`;
    img.style.objectPosition = pos;
  };
  box.classList.add("is-dragging");
  const up = () => { box.classList.remove("is-dragging"); box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); if (pos !== (h.pos || "50% 50%")) A().setHeroPos(pos); };
  box.addEventListener("pointermove", move); box.addEventListener("pointerup", up);
});

// ---- reorder blocks by dragging the grip ---------------------------------------
let dragFrom = null;
root.addEventListener("dragstart", (e) => {
  const h = e.target.closest(".blk-handle"); if (!h) return;
  const blk = h.closest(".blk"); dragFrom = Number(blk.dataset.i);
  e.dataTransfer.setData("text/x-blk", String(dragFrom)); e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setDragImage(blk, 20, 20); setTimeout(() => blk.classList.add("blk-dragging"), 0);
});
root.addEventListener("dragend", () => { dragFrom = null; document.querySelectorAll(".blk-dragging,.is-drop").forEach((n) => n.classList.remove("blk-dragging", "is-drop")); });

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
function nearestBar(y) {
  let best = null, d = 1e9;
  document.querySelectorAll(".ins").forEach((b) => { const r = b.getBoundingClientRect(); const dd = Math.abs(r.top - y); if (dd < d) { d = dd; best = b; } });
  return best;
}
document.addEventListener("dragenter", (e) => { if (isFiles(e)) document.body.classList.add("is-file-drag"); });
document.addEventListener("dragover", (e) => {
  if (dragFrom !== null) { e.preventDefault(); document.querySelectorAll(".is-drop").forEach((n) => n.classList.remove("is-drop")); nearestBar(e.clientY)?.classList.add("is-drop"); }
  else if (isFiles(e)) { e.preventDefault(); document.querySelectorAll(".is-drop").forEach((n) => n.classList.remove("is-drop")); if (!e.target.closest("[data-hero]")) nearestBar(e.clientY)?.classList.add("is-drop"); }
});
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("is-file-drag"); });
document.addEventListener("drop", (e) => {
  e.preventDefault(); document.body.classList.remove("is-file-drag");
  if (dragFrom !== null) { const bar = nearestBar(e.clientY); const at = Number(bar.dataset.at); const f = dragFrom; dragFrom = null; A().moveTo(f, at); return; }
  if (isFiles(e)) {
    const files = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tif?f)$/i.test(f.name));
    if (!files.length) return;
    if (e.target.closest("[data-hero]")) A().setHeroFile(files[0]);
    else A().dropFiles(files, Number(nearestBar(e.clientY).dataset.at));
  }
});
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && ["z", "y"].includes(e.key.toLowerCase())) { e.preventDefault(); A().undoKey(e); } });

// Remember the last text selection so the inspector's Bold / Italic / Link buttons still work after focus leaves the page.
window.lastRange = null;
document.addEventListener("selectionchange", () => {
  const sel = getSelection(); if (!sel.rangeCount) return; const r = sel.getRangeAt(0), el = richOf(r.commonAncestorContainer);
  if (el) {
    window.lastRange = { range: r.cloneRange(), el }; window.plainField = null; if (blkOf(el)) A().caretIn(blockIndex(el));
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    A().selState({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), link: !!n.closest("a") });
  }
});
window.formatText = (cmd, url) => {   // cmd: bold | italic | createLink
  const L = window.lastRange; if (!L || !L.el.isConnected) return false;
  L.el.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(L.range);
  if (cmd === "unlink") {   // caret anywhere inside a link removes that whole link
    const n = L.range.startContainer, a = (n.nodeType === 1 ? n : n.parentElement).closest("a");
    if (!a) return false; const r = document.createRange(); r.selectNodeContents(a); sel.removeAllRanges(); sel.addRange(r);
  }
  if ((cmd === "bold" || cmd === "italic" || cmd === "createLink") && sel.isCollapsed) return false;
  document.execCommand("styleWithCSS", false, false);
  document.execCommand(cmd, false, url);
  L.el.dispatchEvent(new Event("input", { bubbles: true })); return true;
};
window.linkAt = () => {   // cursor inside a link: select all of it and return its address
  const L = window.lastRange; if (!L || !L.el.isConnected) return null;
  const n = L.range.startContainer, a = (n.nodeType === 1 ? n : n.parentElement).closest("a"); if (!a || !L.el.contains(a)) return null;
  const r = document.createRange(); r.selectNodeContents(a); window.lastRange = { range: r, el: L.el }; return a.getAttribute("href") || "";
};
window.hasTextSelection = () => { const L = window.lastRange; return !!(L && L.el.isConnected && !L.range.collapsed); };

// ---- drag a floating photo by its side handle: dentro de la columna / hasta el margen / hasta el borde de la pantalla ----
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".edge-handle"); if (!h || e.button !== 0) return;
  e.preventDefault(); h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"), i = Number(blk.dataset.i), body = $(".article-body");
  const W = document.documentElement.clientWidth;
  const probe = document.createElement("div"); probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cw-inner)"; body.appendChild(probe);
  const margin = (W - probe.offsetWidth) / 2; probe.remove();
  A().select(i, null);
  let res = null;
  const move = (ev) => {
    const x = ev.clientX, side = x < W / 2 ? "left" : "right", dist = side === "right" ? W - x : x;
    const mode = dist < 70 ? "edge" : margin > 110 && dist < margin + 40 ? "hang" : "in";
    res = { side, mode };
    blk.classList.remove("wrap-left", "wrap-right", "wrap-hang", "wrap-edge");
    blk.classList.add("wrap-" + side); if (mode === "edge") blk.classList.add("wrap-edge"); else if (mode === "hang") blk.classList.add("wrap-hang");
  };
  const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); if (res) A().setWrapMode(i, res.side, res.mode); };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
});

// ---- text width: drag the side edges of a paragraph, title, list or text box ----
// Edges are a share (0-100) of the content width, the width of single photos. They snap to its two margins (the photos'),
// to the edges of the reading column and to the centre; double-click an edge to go back to the normal width.
function contentBox() {
  const body = $(".article-body"), br = body.getBoundingClientRect();
  const probe = document.createElement("div"); probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cw-inner)"; body.appendChild(probe);
  const cw = probe.offsetWidth; probe.remove();
  const col = Math.min(46 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16), br.width - 24);
  const x0 = br.left + (br.width - cw) / 2;
  return { x0, cw, defL: ((br.width - col) / 2 - (br.width - cw) / 2) / cw * 100, defR: ((br.width + col) / 2 - (br.width - cw) / 2) / cw * 100 };
}
let guide = null;
const showGuide = (x) => { if (!guide) { guide = document.createElement("div"); guide.className = "snap-guide"; document.body.appendChild(guide); } guide.style.left = x + "px"; guide.hidden = x == null; };
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".box-handle"); if (!h || e.button !== 0) return;
  e.preventDefault(); h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"), i = Number(blk.dataset.i), side = h.dataset.side, b = E().blocks[i];
  const C = contentBox(), rect = blk.getBoundingClientRect();
  // edges as numbers while dragging; an edge left on the reading column is stored as "texto"
  let l = (rect.left - C.x0) / C.cw * 100, r = (rect.right - C.x0) / C.cw * 100, moved = false;
  let lv = b.box ? b.box.l : null, rv = b.box ? b.box.r : null;
  A().select(i, null);
  const move = (ev) => {
    moved = true;
    let v = (ev.clientX - C.x0) / C.cw * 100, snapped = null;
    for (const t of [0, 100, C.defL, C.defR, 50]) if (Math.abs(v - t) * C.cw / 100 < 12) { v = t; snapped = t; break; }
    if (side === "l") { l = Math.max(0, Math.min(r - 15, v)); lv = snapped === C.defL || snapped === C.defR ? "texto" : Math.round(l * 10) / 10; }
    else { r = Math.min(100, Math.max(l + 15, v)); rv = snapped === C.defL || snapped === C.defR ? "texto" : Math.round(r * 10) / 10; }
    const cur = { l: lv ?? (Math.abs(l - C.defL) < 0.3 ? "texto" : Math.round(l * 10) / 10), r: rv ?? (Math.abs(r - C.defR) < 0.3 ? "texto" : Math.round(r * 10) / 10) };
    blk.classList.add("has-box"); blk.style.cssText = boxVars(cur); blk.dataset.box = JSON.stringify(cur);
    showGuide(snapped == null ? null : C.x0 + (snapped / 100) * C.cw);
  };
  const up = () => {
    h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); showGuide(null);
    if (!moved) return;
    const box = JSON.parse(blk.dataset.box);
    const normal = b.type === "datos" ? box.l === 0 && box.r === 100 : box.l === "texto" && box.r === "texto";   // a facts row is normally as wide as the photos
    A().setBox(i, normal ? null : box);
  };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
});
root.addEventListener("dblclick", (e) => { const h = e.target.closest(".box-handle"); if (h) A().setBox(Number(h.closest(".blk").dataset.i), null); });

// ---- drag the pink bar under a panorama or a spacer to change its height ----
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".size-handle"); if (!h || e.button !== 0) return;
  e.preventDefault(); h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"), i = Number(blk.dataset.i), kind = h.dataset.size, sy = e.clientY;
  A().select(i, null);
  const el = kind === "pano" ? blk.querySelector(".pano") : blk.querySelector(".ed-space");
  const box = kind === "pano" ? blk.querySelector(".pano-scroll") : el;
  const h0 = box.getBoundingClientRect().height, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let val = null;
  const move = (ev) => {
    const nh = Math.max(8, h0 + ev.clientY - sy);
    if (kind === "pano") { val = Math.round(Math.min(90, Math.max(25, (nh / innerHeight) * 100))); el.style.setProperty("--pano-limit", `clamp(12rem, ${val}vh, ${(val * 0.68).toFixed(1)}rem)`); }
    else { val = Math.round(Math.min(16, Math.max(0.5, nh / rem)) * 2) / 2; el.style.height = val + "rem"; el.querySelector("span").textContent = `Espacio · ${val} rem`; }
  };
  const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); if (val != null) A().setField(i, kind === "pano" ? "h" : "size", val, true); };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
});

// ---- preview mode (web editor's "Vista previa"): the same page without editing aids ----
if (PREVIEW) {
  document.documentElement.classList.add("is-preview");
  for (const ev of ["pointerdown", "click", "keydown", "input", "paste", "dragstart", "drop", "focusin"]) document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest(".pano-scroll")) { e.stopPropagation(); if (ev !== "pointerdown" && ev !== "focusin") e.preventDefault(); } }, true);
  const lock = () => document.querySelectorAll("[contenteditable]").forEach((n) => n.setAttribute("contenteditable", "false"));
  new MutationObserver(lock).observe(document.getElementById("root"), { childList: true, subtree: true }); lock();
  document.querySelectorAll("textarea").forEach((t) => (t.readOnly = true));
}
