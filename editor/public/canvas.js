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
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
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
// Mosaic cells carry data-cp, their place in the layout ("1.0" = first photo of the second group), so the bars between
// them know which photos they resize. Containers say their direction: data-dir="r" (a row) or "c" (photos stacked).
const GRIP = `<div class="item-grip" draggable="true" title="Arrastra para mover la foto: a otro lugar del mosaico, sobre otra foto, junto a un párrafo o entre dos bloques">${svg("move")}</div>`;
function gridHTML(b, S, base, i) {
  const vars = gridVars(b.tree, (id) => ratioOf(S.photos[id])); let n = 0;
  const cells = (arr, depth, pre) => arr.map((c, j) => {
    const v = vars[n], k = n++, cp = pre + j;
    if (!Array.isArray(c)) {
      const p = S.photos[c]; if (!p) return "";
      const si = S.sel && S.sel.i === i && S.sel.id === c ? " is-sel-item" : "";
      return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(c)}" data-n="${k}" data-cp="${cp}" style="${cellStyle(v)}">${photoFrame(p, base, i, c, true)}${GRIP}</figure>`;
    }
    const row = depth % 2 === 0;
    return `<div class="${row ? "fila fila-in" : "fila-col"}" data-n="${k}" data-cp="${cp}" data-dir="${row ? "r" : "c"}" style="${cellStyle(v)}">${cells(c, depth + 1, cp + ".")}</div>`;
  }).join("");
  return `<div class="fila fila-grid${b.full ? " fila-bleed" : ""} my-5" data-row data-nested data-cp="" data-dir="r">${cells(b.tree, 1, "")}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura del mosaico"></div></div>`;
}
function patchGrid(row, tree, ratios) {   // ratios: { id: ratio }; updates the cells in place while dragging
  const vars = gridVars(tree, (id) => ratios[id]);
  row.querySelectorAll("[data-n]").forEach((el) => { const v = vars[Number(el.dataset.n)]; el.style.cssText = cellStyle(v); if (el.dataset.item) el.querySelector(".ratio").style.setProperty("--bs-aspect-ratio", (100 / ratios[el.dataset.item]).toFixed(3) + "%"); });
}

// Word-style handles around a selected photo: the sides change its width, top and bottom its height (the crop),
// the corners both. Edges snap to the edges of the other photos (also each photo of a row), the margins and the text column.
const RZ = ["l", "r", "t", "b", "tl", "tr", "bl", "br"].map((k) => `<div class="rz rz-${k}" data-rz="${k}"></div>`).join("");
function photoFrame(p, base, i, id, inRow = false) {
  const r = ratioOf(p);
  return `<div class="ratio figure-img" data-id="${esc(id)}" style="--bs-aspect-ratio: ${(100 / r).toFixed(3)}%">
<img src="${IMG(base, p.file, "-sm.jpg")}" class="object-fit-cover" style="object-position: ${posOf(p)}" alt="" draggable="false">
${inRow ? "" : RZ}</div>`;
}
const caption = (p, id) => inl(`data-cap="${esc(id)}"`, p.caption, "Descripción (opcional)", "cap-field figure-caption");

const wrapCls = (b, kind) => (b.wrap && b.wrap.side ? ` wrap wrap-${b.wrap.side}${[33, 40, 50].includes(b.wrap.size || 40) ? ` wrap-s${b.wrap.size || 40}` : ""}${b.wrap.edge ? " wrap-edge" : b.wrap.hang ? " wrap-hang" : ""} ${kind}` : "");
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
const BOXABLE = ["p", "h2", "h3", "ul", "ol", "callout", "details", "datos", "foto", "fila", "quote", "button", "hr", "video", "map", "ficha"];
// Blocks whose normal width is the photos' column (the rest: the text column)
const WIDE = ["datos", "fila", "foto", "quote", "video", "map", "ficha"];
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
  const handle = b.type === "foto"
    ? `<div class="blk-handle" draggable="true" title="Arrastra para mover la foto: sobre otra foto (mosaico), a un lado del texto (flota) o entre dos bloques">${svg("move")}</div>`
    : `<div class="blk-handle" draggable="true" title="Arrastra para mover">${svg("grip")}</div>`;
  const sel = S.sel && S.sel.i === i ? " is-sel" : "";
  const boxable = BOXABLE.includes(b.type) && !(b.wrap && b.wrap.side) && !b.full;
  const style = [boxable && b.box ? boxVars(b.box) : "", b.wrap && b.wrap.side && ![33, 40, 50].includes(b.wrap.size || 40) ? `--ws: ${b.wrap.size / 100}` : ""].filter(Boolean).join("; ");
  const what = { fila: "de la fila", datos: "de los datos", quote: "de la cita", button: "del botón", hr: "de la línea", video: "del video", map: "del mapa", ficha: "de la ficha" }[b.type] || "del texto";
  const fside = b.wrap && b.wrap.side && b.type !== "foto" ? (b.wrap.side === "left" ? "r" : "l") : null;   // floating card or quote: its inner side
  const edges = fside ? `<div class="box-handle" data-side="${fside}" data-float="1" title="Arrastra para cambiar el ancho; se pega a los bordes de lo que hay alrededor"></div>` : boxable && b.type !== "foto" ? `<div class="box-handle" data-side="l" title="Arrastra para cambiar el ancho ${what}. Doble clic: ancho normal"></div><div class="box-handle" data-side="r" title="Arrastra para cambiar el ancho ${what}. Doble clic: ancho normal"></div>` : "";
  const wrap = (cls, inner, extra = "") => `<div class="blk ${cls}${extra}${sel}${b.align === "center" ? " is-center" : ""}${boxable && b.box ? " has-box" : ""}"${style ? ` style="${style}"` : ""} data-i="${i}">${handle}${tools}${edges}${inner}${extra.includes(" wrap ") ? floatHint(S, i) + UNDER : ""}</div>`;
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
      return wrap("blk-media blk-photo", `<div class="container"><figure class="figure w-100 my-5 ${p.alt ? "" : "alt-missing"}" style="position:relative">${photoFrame(p, base, i, b.id)}${caption(p, b.id)}</figure></div>`);
    }
    case "fila": {
      if (b.tree) return wrap("blk-media blk-mosaic" + (b.full ? "" : " blk-row"), b.full ? gridHTML(b, S, base, i) : `<div class="container">${gridHTML(b, S, base, i)}</div>`);
      const items = b.ids.map((id) => {
        const p = S.photos[id]; if (!p) return "";
        const si = S.sel && S.sel.i === i && S.sel.id === id ? " is-sel-item" : "";
        return `<figure class="fila-item figure${si} ${p.alt ? "" : "alt-missing"}" data-item="${esc(id)}" data-cp="${b.ids.indexOf(id)}" style="--g: ${ratioOf(p).toFixed(3)}">${photoFrame(p, base, i, id, true)}${GRIP}${caption(p, id)}</figure>`;
      }).join("");
      const rowHtml = `<div class="fila${b.full ? " fila-bleed" : ""} my-5" data-row data-cp="" data-dir="r">${items}<div class="row-handle" title="Arrastra hacia arriba o abajo para cambiar la altura del mosaico"></div></div>`;
      return wrap("blk-media blk-mosaic" + (b.full ? "" : " blk-row"), b.full ? rowHtml : `<div class="container">${rowHtml}</div>`);
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
// Under a floating photo (or quote, or card): adds below it, not beside it. Its place is found when it is clicked.
const UNDER = `<div class="ins ins-under" data-under="1"><button type="button" title="Agregar debajo" aria-label="Agregar un bloque debajo de esta foto">+</button></div>`;

// The cover. "" = full-bleed photo with the title over it (as on the site from 992 px up; under it on narrower
// screens), "debajo" = full-bleed photo with the title under it, "titulo" = title, then the photo, "texto" = no photo.
// The photo is the uncropped original placed in a 16:9 frame: drag it to move it, + / − to zoom; what the frame shows
// is exactly the crop that gets saved.
const heroZoom = (h) => Math.min(3, Math.max(1, Number(h.zoom) || 1));
function heroBox(h) {   // size and place of the original inside the frame, in % of the frame
  const ir = h.srcW / h.srcH, fr = 16 / 9, z = heroZoom(h);
  const w = ir > fr ? 100 * z * ir / fr : 100 * z, hh = ir > fr ? 100 * z : 100 * z * fr / ir;
  const [px, py] = (POS.test(h.pos || "") ? h.pos : "50% 50%").split(" ").map(parseFloat);
  return { w, h: hh, left: (100 - w) * px / 100, top: (100 - hh) * py / 100 };
}
const heroStyle = (h) => { const b = heroBox(h); return `width:${b.w}%;height:${b.h}%;left:${b.left}%;top:${b.top}%`; };
window.layoutHero = () => { const h = E().meta.hero, img = $(".ed-hero-img.has-src img"); if (h && img) img.style.cssText = heroStyle(h); };
function heroHTML(S) {
  const m = S.meta, h = m.hero, cab = m.cabecera || "";
  let inner, src = false;
  if (h) {
    src = !!h.srcW;
    const url = parent.heroSrc ? parent.heroSrc(m) : `${m.imgBase}${h.file}-1280.jpg?v=${S.heroV || 0}`;
    const crop = src ? ((h.srcW / h.srcH > 16 / 9 ? h.srcH * 16 / 9 : h.srcW) / heroZoom(h)) : 0;
    const hint = !src ? "Para encuadrar o acercar esta portada, elige la foto otra vez con «Cambiar foto»."
      : `Arrastra la foto para moverla; con + y − la acercas.${crop && crop < 1600 ? (heroZoom(h) > 1 ? " Ojo: tan cerca, la foto queda con poca resolución para pantallas grandes." : " Ojo: esta foto tiene poca resolución para una portada; en pantallas grandes se verá algo borrosa.") : ""}`;
    const zoom = src ? `<button class="btn btn-light btn-sm rounded-0" data-hero="zoom-out" title="Alejar" aria-label="Alejar">−</button><span class="ed-hero-zoom">${Math.round(heroZoom(h) * 100)} %</span><button class="btn btn-light btn-sm rounded-0" data-hero="zoom-in" title="Acercar" aria-label="Acercar">+</button>` : "";
    inner = `<img src="${url}" style="${src ? heroStyle(h) : `object-position: ${esc(h.pos || "50% 50%")}`}" alt="" draggable="false"><div class="ed-hero-actions">${zoom}<button class="btn btn-light btn-sm rounded-0" data-hero="replace">Cambiar foto</button></div><div class="ed-hero-hint">${hint}</div>`;
    // The cover's video (Artículo → Video de YouTube): the same button as on the site, bottom right of the photo
    if (m.youtube) inner += `<div class="hero-controls ed-hero-video"><div class="container d-flex justify-content-end"><span class="btn btn-primary btn-sm font-ui hero-play" title="Video de la portada: se cambia en la pestaña Artículo, «Video de YouTube»">▶ Ver el video</span></div></div>`;
  } else inner = `<div class="ed-hero-empty"><div><strong>Foto principal</strong><br>Arrastra una foto aquí o haz clic para elegirla</div></div>`;
  const photo = `<div class="ed-hero-img ${h ? "" : "ed-hero-empty"}${src ? " has-src can-drag" : ""}" data-hero="${h ? "img" : "pick"}">${inner}</div>`;
  const caption = h ? `<div class="container pt-2">${inl('data-m="hero.caption"', h.caption, "Descripción de la portada (opcional)", "figure-caption cap-field")}</div>` : "";
  const tape = `<span class="tape">${esc((parent.SECTION_NAMES || {})[m.section] || m.section || "Sección")}</span>`;
  const title = `<textarea class="ed-field ed-title" rows="1" data-m="title" placeholder="Título del artículo">${esc(m.title || "")}</textarea>`;
  const label = { debajo: "título debajo de la foto", titulo: "título arriba", texto: "solo título" }[cab];
  // Under the header, as on the site: the subtitle (big, light) and the byline (author, date, reading time; automatic)
  const fecha = m.date ? new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m.date)) : "Sin fecha";
  const words = S.blocks.reduce((n, b) => n + String((b.items || []).join(" ") + " " + (b.text || "") + " " + (b.title || "")).replace(/[*#>\[\]()]/g, " ").split(/\s+/).filter(Boolean).length, 0);
  const byline = `<ul class="list-inline small-meta mb-0 ed-byline" data-byline title="El autor y la fecha se cambian en la pestaña Artículo; el tiempo de lectura se calcula solo"><li class="list-inline-item me-4"><strong class="text-body">Por ${esc(m.author || "—")}</strong></li><li class="list-inline-item me-4">${esc(fecha)}</li><li class="list-inline-item">${Math.max(1, Math.round(words / 200))} min de lectura</li></ul>`;
  const aid = m.draft || label ? `<div class="ed-date font-ui">${[m.draft ? "Borrador" : "", label ? `Cabecera: ${label}` : ""].filter(Boolean).join(" · ")}</div>` : "";
  const sub = inl('data-m="subtitle"', m.subtitle, "Subtítulo (opcional): una o dos frases que resumen el artículo", "lead measure mb-0 ed-sub");
  const intro = `<div class="container pt-4 pt-lg-5"><div class="row"><div class="col-xl-10 d-grid gap-4">${sub}${byline}${aid}</div></div></div>`;
  const ai = m.ai ? `<div class="notice-band tone-amarillo mt-4" role="note"><div class="container py-3"><strong>Versión de prueba.</strong> Este artículo fue escrito enteramente con inteligencia artificial, solo para probar el diseño de la revista. El texto definitivo lo escribirá el autor.</div></div>` : "";
  const titles = (pad) => `<div class="container d-grid gap-3 ed-titles ${pad}">${tape}${title}</div>`;
  if (cab === "texto") return `<header class="ed-hero-wrap ed-cab-texto">${titles("pt-5")}</header>${ai}${intro}`;
  if (cab === "titulo") return `<header class="ed-hero-wrap ed-cab-titulo">${titles("pt-5")}<div class="container mt-4">${photo}</div>${caption}</header>${ai}${intro}`;
  if (cab === "debajo" || !h) return `<header class="ed-hero-wrap ed-cab-debajo">${photo}${caption}${titles("pt-4")}</header>${ai}${intro}`;
  return `<header class="ed-hero-wrap ed-cab-foto"><div class="ed-hero-stack">${photo}<div class="ed-hero-text"><div class="container d-grid gap-3">${tape}${title}</div></div></div>${caption}</header>${ai}${intro}`;
}

function render() {
  const S = E(); if (!S || !S.meta) { root.innerHTML = ""; return; }
  const y = scrollY;
  let html = heroHTML(S) + `<main><div class="article-body">${ins(0)}`;
  S.blocks.forEach((b, i) => { html += blockHTML(b, i, S) + ins(i + 1); });
  html += `</div><div class="drop-overlay">Sobre una foto: forman un mosaico · Entre dos bloques: una foto sola</div></main>`;
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

// Mosaics: the pink handle under a mosaic changes its height (every crop by the same factor). A pink bar between two
// photos, or two groups of photos, moves the border between them: one side grows and the other shrinks by the same
// amount, so the rest of the mosaic does not move. The border sticks to the edges of the other photos.
const leavesOf = (n) => (Array.isArray(n) ? n.flatMap(leavesOf) : [n]);
const nodeAt = (t, cp) => (cp === "" ? t : cp.split(".").reduce((a, k) => a[Number(k)], t));
const cellBox = (el) => (el.matches(".fila-item") ? el.querySelector(".ratio") : el).getBoundingClientRect();   // a photo's frame, without its caption
function layoutRows() {
  document.querySelectorAll("[data-row]").forEach((row) => {
    row.querySelectorAll(".divider").forEach((d) => d.remove());
    const rr = row.getBoundingClientRect();
    for (const c of [row, ...row.querySelectorAll(".fila-in, .fila-col")]) {
      const dir = c.dataset.dir, kids = [...c.children].filter((x) => x.hasAttribute("data-cp"));
      if (kids.length < 2) continue;
      if ((dir === "r") !== getComputedStyle(c).flexDirection.startsWith("row")) continue;   // phones: a simple row turns into a column
      for (let k = 0; k < kids.length - 1; k++) {
        const a = cellBox(kids[k]), b = cellBox(kids[k + 1]);
        const d = document.createElement("div");
        d.className = "divider " + (dir === "r" ? "dv-v" : "dv-h"); d.dataset.cp = c.dataset.cp; d.dataset.k = k; d.dataset.dir = dir;
        if (dir === "r") {
          d.title = "Arrastra a los lados: una foto se hace más ancha y la otra más angosta";
          const top = Math.min(a.top, b.top), bot = Math.max(a.bottom, b.bottom);
          Object.assign(d.style, { left: (a.right + b.left) / 2 - rr.left - 8 + "px", top: top - rr.top + "px", height: bot - top + "px" });
        } else {
          d.title = "Arrastra hacia arriba o abajo: una foto se hace más alta y la otra más baja";
          const l = Math.min(a.left, b.left), r = Math.max(a.right, b.right);
          Object.assign(d.style, { top: (a.bottom + b.top) / 2 - rr.top - 8 + "px", left: l - rr.left + "px", width: r - l + "px" });
        }
        row.appendChild(d);
      }
    }
  });
}
const clampR = (r) => Math.round(Math.max(0.2, Math.min(8, r)) * 1000) / 1000;
function patchRatios(row, ratios) {
  row.querySelectorAll(".fila-item").forEach((it, k) => { it.style.setProperty("--g", ratios[k].toFixed(3)); it.querySelector(".ratio").style.setProperty("--bs-aspect-ratio", (100 / ratios[k]).toFixed(3) + "%"); });
}
root.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const rh = e.target.closest(".row-handle"), dv = e.target.closest(".divider");
  if (!rh && !dv) return;
  const row = e.target.closest("[data-row]"), S = E(), i = Number(row.closest(".blk").dataset.i), blk = S.blocks[i];
  const t = blk.tree || blk.ids, ids = leavesOf(t), nested = row.hasAttribute("data-nested");
  const r0 = Object.fromEntries(ids.map((id) => [id, ratioOf(S.photos[id])]));
  e.preventDefault(); const cap = e.target; cap.setPointerCapture(e.pointerId);
  A().select(i, null);
  const sx = e.clientX, sy = e.clientY; let cur = r0;
  const apply = () => (nested ? patchGrid(row, t, cur) : patchRatios(row, ids.map((id) => cur[id])));
  let move;
  if (rh) {
    const h0 = nested ? row.getBoundingClientRect().height : row.querySelector(".ratio").getBoundingClientRect().height;
    move = (ev) => { const k = h0 / Math.max(40, h0 + (ev.clientY - sy)); cur = Object.fromEntries(ids.map((id) => [id, clampR(r0[id] * k)])); apply(); };
  } else {
    const cp = dv.dataset.cp, k = Number(dv.dataset.k), dir = dv.dataset.dir, pre = cp === "" ? "" : cp + ".";
    const cont = nodeAt(t, cp), side1 = leavesOf(cont[k]), side2 = leavesOf(cont[k + 1]);
    const ea = cellBox(row.querySelector(`[data-cp="${pre + k}"]`)), eb = cellBox(row.querySelector(`[data-cp="${pre + (k + 1)}"]`));
    const sizeA = dir === "r" ? ea.width : ea.height, sizeB = dir === "r" ? eb.width : eb.height;
    // the edges the border can stick to: the other photos of this mosaic, and (side to side) everything else on the page
    const others = [...row.querySelectorAll(".fila-item")].filter((it) => !side1.includes(it.dataset.item) && !side2.includes(it.dataset.item)).map(cellBox);
    const lines = dir === "r" ? [...others.flatMap((o) => [o.left, o.right]), ...photoEdges(blkOf(row))] : others.flatMap((o) => [o.top, o.bottom]);
    const end0 = dir === "r" ? ea.right : ea.bottom;
    move = (ev) => {
      let d = dir === "r" ? ev.clientX - sx : ev.clientY - sy;
      const snap = nearest(end0 + d, lines, 8); if (snap != null) d = snap - end0;
      d = Math.max(40 - sizeA, Math.min(sizeB - 40, d));
      const nA = sizeA + d, nB = sizeB - d;
      // side by side a photo's crop gets wider as it grows; stacked, it gets taller (its width stays)
      const kA = dir === "r" ? nA / sizeA : sizeA / nA, kB = dir === "r" ? nB / sizeB : sizeB / nB;
      cur = { ...r0 }; side1.forEach((id) => { cur[id] = clampR(r0[id] * kA); }); side2.forEach((id) => { cur[id] = clampR(r0[id] * kB); });
      apply(); showGuide(dir === "r" ? snap : null); showGuideH(dir === "c" ? snap : null);
    };
  }
  const up = () => {
    cap.removeEventListener("pointermove", move); cap.removeEventListener("pointerup", up); showGuide(null); showGuideH(null);
    const changed = Object.fromEntries(ids.filter((id) => Math.abs(cur[id] - r0[id]) > 0.001).map((id) => [id, cur[id]]));
    if (Object.keys(changed).length) A().setRatios(changed); else layoutRows();
  };
  cap.addEventListener("pointermove", move); cap.addEventListener("pointerup", up);
});

// Where "below this floating block" is: before the first block that already starts below it (the text beside it,
// and a paragraph that runs past its bottom, stay before).
function afterFloat(i) {
  const f = document.querySelector(`.blk[data-i="${i}"]`); if (!f) return i + 1;
  const bottom = f.getBoundingClientRect().bottom - 1;
  for (const el of document.querySelectorAll(".article-body > .blk")) {
    const k = Number(el.dataset.i); if (k <= i) continue;
    if (el.getBoundingClientRect().top >= bottom) return k;
  }
  return E().blocks.length;
}

// ---- events ------------------------------------------------------------------
let openMenu = null;
const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu.closest(".ins")?.classList.remove("is-open"); openMenu = null; } };

root.addEventListener("click", (e) => {
  const t = e.target;
  const insBtn = t.closest(".ins > button");
  if (insBtn) {
    const bar = insBtn.parentElement; const was = openMenu && openMenu.parentElement === bar; closeMenu(); if (was) return;
    if (bar.dataset.under) bar.dataset.at = afterFloat(Number(bar.closest(".blk").dataset.i));
    const m = document.createElement("div"); m.className = "ins-menu";
    m.innerHTML = (parent.INSERT_MENU || []).map(([k, l]) => (k ? `<button data-add="${k}">${l}</button>` : `<h6>${l}</h6>`)).join("");
    bar.appendChild(m); bar.classList.add("is-open"); openMenu = m; return;
  }
  const add = t.closest("[data-add]");
  if (add) { const bar = add.closest(".ins"), at = Number(bar.dataset.at); closeMenu(); A().add(add.dataset.add, at, { under: !!bar.dataset.under }); return; }
  closeMenu();
  const hero = t.closest("[data-hero]");
  if (hero && (t.closest('[data-hero="replace"]') || hero.dataset.hero === "pick")) { A().pickHero(); return; }
  if (t.closest("[data-byline]")) { A().focusArticle("m.author"); return; }
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
  if (e.target.closest(".rz")) return;   // the resize handles have their own drag
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

// Cover: drag the photo inside its 16:9 frame (both directions when it is zoomed in); + / − zoom
root.addEventListener("pointerdown", (e) => {
  const box = e.target.closest('[data-hero="img"]'); if (!box || e.target.closest("button") || e.button !== 0) return;
  const S = E(), h = S.meta.hero, img = box.querySelector("img"); if (!h || !box.classList.contains("can-drag")) return;
  e.preventDefault(); box.setPointerCapture(e.pointerId);
  const rect = box.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, b = heroBox(h);
  const [px0, py0] = (POS.test(h.pos || "") ? h.pos : "50% 50%").split(" ").map(parseFloat);
  const overW = rect.width * (b.w / 100 - 1), overH = rect.height * (b.h / 100 - 1);
  let pos = h.pos || "50% 50%";
  const move = (ev) => {
    const px = overW > 1 ? px0 - ((ev.clientX - sx) / overW) * 100 : px0, py = overH > 1 ? py0 - ((ev.clientY - sy) / overH) * 100 : py0;
    pos = `${Math.round(Math.max(0, Math.min(100, px)))}% ${Math.round(Math.max(0, Math.min(100, py)))}%`;
    img.style.cssText = heroStyle({ ...h, pos });
  };
  box.classList.add("is-dragging");
  const up = () => { box.classList.remove("is-dragging"); box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); if (pos !== (h.pos || "50% 50%")) A().setHeroPos(pos); };
  box.addEventListener("pointermove", move); box.addEventListener("pointerup", up);
});
const ZOOMS = [1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
root.addEventListener("click", (e) => {
  const z = e.target.closest('[data-hero="zoom-in"], [data-hero="zoom-out"]'); if (!z) return;
  e.stopPropagation(); const h = E().meta.hero, cur = heroZoom(h);
  const next = z.dataset.hero === "zoom-in" ? ZOOMS.find((x) => x > cur + 0.001) ?? 3 : [...ZOOMS].reverse().find((x) => x < cur - 0.001) ?? 1;
  A().setHeroPos(h.pos || "50% 50%", next);
}, true);

// ---- drag and drop ------------------------------------------------------------------------------
// Three things can be dragged onto the page: a block by its grip (to move it between blocks), a photo of the page by its
// grip ✥, and photos from the computer. Before they are dropped, a pink line or box shows where they will land:
//   onto a photo: it joins that photo as a mosaic, on the side of the photo where it falls; near the edge of a mosaic,
//     on that side of all its photos;
//   beside the text (only photos of the page): the photo floats on that side of the text; further out it hangs out to
//     the margin, or runs to the edge of the screen;
//   anywhere else: between two blocks, on its own row.
let dragFrom = null, dragPhoto = null, dragEl = null;
root.addEventListener("dragstart", (e) => {
  const g = e.target.closest(".item-grip, .blk-handle"); if (!g) return;
  const blk = g.closest(".blk"), i = Number(blk.dataset.i), b = E().blocks[i];
  if (g.matches(".item-grip")) { const it = g.closest("[data-item]"); dragPhoto = { i, id: it.dataset.item }; dragEl = it; }
  else if (b && b.type === "foto") { dragPhoto = { i, id: b.id }; dragEl = blk; }
  else { dragFrom = i; dragEl = blk; }
  e.dataTransfer.setData("text/x-relieve", "1"); e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setDragImage(dragPhoto ? dragEl.querySelector(".ratio") || dragEl : dragEl, 20, 20);
  const el = dragEl; setTimeout(() => el.classList.add("blk-dragging"), 0);
  e.stopPropagation();
});
const endDrag = () => { dragFrom = null; dragPhoto = null; dragEl = null; showDrop(null); document.body.classList.remove("is-file-drag"); document.querySelectorAll(".blk-dragging,.is-drop").forEach((n) => n.classList.remove("blk-dragging", "is-drop")); };
root.addEventListener("dragend", endDrag);

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
function nearestBar(y) {
  let best = null, d = 1e9;
  document.querySelectorAll(".article-body .ins:not(.ins-under)").forEach((b) => { const r = b.getBoundingClientRect(); const dd = Math.abs(r.top - y); if (dd < d) { d = dd; best = b; } });
  return best;
}
// Onto a photo or a mosaic: which photo, and which of its sides (left, right, top, bottom). Floating photos and panoramas
// do not take other photos.
function photoTarget(x, y, src) {
  const el = document.elementFromPoint(x, y), blk = el && el.closest(".article-body > .blk");
  if (!blk) return null;
  const i = Number(blk.dataset.i), b = E().blocks[i];
  if (!b || !(b.type === "fila" || (b.type === "foto" && !(b.wrap && b.wrap.side)))) return null;
  const items = b.type === "foto" ? [{ id: b.id, r: blk.querySelector(".ratio")?.getBoundingClientRect() }] : [...blk.querySelectorAll(".fila-item[data-item]")].map((it) => ({ id: it.dataset.item, r: cellBox(it) }));
  if (!items.length || !items[0].r) return null;
  const R = { left: Math.min(...items.map((o) => o.r.left)), right: Math.max(...items.map((o) => o.r.right)), top: Math.min(...items.map((o) => o.r.top)), bottom: Math.max(...items.map((o) => o.r.bottom)) };
  R.width = R.right - R.left; R.height = R.bottom - R.top;
  if (x < R.left - 4 || x > R.right + 4 || y < R.top - 4 || y > R.bottom + 4) return null;   // e.g. over a caption: between blocks instead
  if (src && src.i === i && b.type === "foto") return { kind: "none" };   // a photo onto itself
  const many = items.length > 1;
  let side = null, ref = "root", box = R;
  if (many) {   // a band along the top or the bottom of the whole mosaic: a new row above or below all the photos
    const bh = Math.min(36, Math.max(16, R.height * 0.09));
    if (y < R.top + bh) side = "top"; else if (y > R.bottom - bh) side = "bottom";
  }
  if (!side) {   // the photo under the pointer (or the nearest one, in a gap), and its nearest side
    let best = null, bd = Infinity;
    for (const it of items) { const r = it.r, d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)); if (d < bd) { bd = d; best = it; } }
    const r = best.r, fx = (x - r.left) / r.width, fy = (y - r.top) / r.height, ds = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
    side = Object.keys(ds).reduce((a, k) => (ds[k] < ds[a] ? k : a));
    if (src && src.i === i && best.id === src.id) return { kind: "none" };
    if (many) { ref = best.id; box = r; }
  }
  return { kind: "mosaic", i, ref, side, box, all: many && ref === "root", items };
}
// Between two blocks; a photo of the page dragged beside the text floats on that side
function barTarget(x, y, canFloat) {
  const bar = nearestBar(y); if (!bar) return null;
  const at = Number(bar.dataset.at);
  if (canFloat) {
    const C = contentBox(), colL = C.x0 + C.defL / 100 * C.cw, colR = C.x0 + C.defR / 100 * C.cw, colW = colR - colL;
    const side = x < colL + colW * 0.28 ? "left" : x > colR - colW * 0.28 ? "right" : null;
    if (side && innerWidth >= 768) {
      const W = document.documentElement.clientWidth, margin = (W - C.cw) / 2, dist = side === "right" ? W - x : x;
      const mode = dist < 70 ? "edge" : margin > 110 && dist < margin + 40 ? "hang" : "in";
      return { kind: "bar", at, side, mode, bar, C, colL, colR };
    }
  }
  return { kind: "bar", at, side: "center", bar };
}
function dropTarget(x, y, src) {
  const el = document.elementFromPoint(x, y);
  if (el && el.closest("[data-hero], .ed-hero-wrap")) return src ? { kind: "none" } : null;
  return photoTarget(x, y, src) || barTarget(x, y, !!src);
}
// The pink line or box, with a short label of what will happen
let ind = null;
function showDrop(t, ratio = 1.5) {
  document.querySelectorAll(".is-drop").forEach((n) => n.classList.remove("is-drop"));
  if (!ind) { ind = document.createElement("div"); ind.className = "drop-ind"; ind.innerHTML = '<span class="drop-tag"></span>'; document.body.appendChild(ind); }
  if (!t || t.kind === "none") { ind.hidden = true; return; }
  let r, label, boxy = false;
  if (t.kind === "mosaic") {
    const b = t.box, L = 6;
    r = t.side === "left" ? [b.left - L / 2, b.top, L, b.height] : t.side === "right" ? [b.right - L / 2, b.top, L, b.height]
      : t.side === "top" ? [b.left, b.top - L / 2, b.width, L] : [b.left, b.bottom - L / 2, b.width, L];
    // dropped in the gap between two photos: say so
    // dropped in the gap between two photos: the line goes in the middle of the gap, and says so
    // (only a neighbour in the same row, or the same column: same top and bottom, or same left and right edges)
    const sameRow = (o) => Math.abs(o.r.top - b.top) < 4 && Math.abs(o.r.bottom - b.bottom) < 4, sameCol = (o) => Math.abs(o.r.left - b.left) < 4 && Math.abs(o.r.right - b.right) < 4;
    const nb = t.all ? null : t.items.find((o) => {
      if (t.side === "left") return Math.abs(o.r.right - b.left) < 30 && sameRow(o);
      if (t.side === "right") return Math.abs(o.r.left - b.right) < 30 && sameRow(o);
      if (t.side === "top") return Math.abs(o.r.bottom - b.top) < 30 && sameCol(o);
      return Math.abs(o.r.top - b.bottom) < 30 && sameCol(o);
    });
    const between = !!nb;
    if (nb) {
      if (t.side === "left") r[0] = (nb.r.right + b.left) / 2 - L / 2; else if (t.side === "right") r[0] = (b.right + nb.r.left) / 2 - L / 2;
      else if (t.side === "top") r[1] = (nb.r.bottom + b.top) / 2 - L / 2; else r[1] = (b.bottom + nb.r.top) / 2 - L / 2;
    }
    const single = t.items.length === 1;
    label = t.all ? { top: "Arriba de todas las fotos", bottom: "Debajo de todas las fotos", left: "A la izquierda de todas", right: "A la derecha de todas" }[t.side]
      : between ? "Entre estas fotos"
      : { left: "A la izquierda de esta foto", right: "A la derecha de esta foto", top: "Encima de esta foto", bottom: "Debajo de esta foto" }[t.side];
    if (single) label = "Mosaico: " + label.charAt(0).toLowerCase() + label.slice(1);
  } else if (t.side === "center") {
    t.bar.classList.add("is-drop");
    const br = t.bar.getBoundingClientRect(); r = [br.left, br.top - 2, br.width, 4]; label = "Aquí, en su propia fila";
  } else {
    boxy = true;
    const C = t.C, colW = t.colR - t.colL, W = document.documentElement.clientWidth, y0 = t.bar.getBoundingClientRect().top;
    const w = t.mode === "hang" ? C.cw * 0.4 : colW * 0.4, outer = t.mode === "edge" ? 0 : t.mode === "hang" ? C.x0 : t.colL;
    const width = t.mode === "edge" ? t.colL + colW * 0.4 : w, h = Math.max(80, Math.min(360, width / ratio));
    r = t.side === "left" ? [outer, y0, width, h] : [W - outer - width, y0, width, h];
    if (t.side === "right" && t.mode === "in") r[0] = t.colR - width;
    label = (t.side === "left" ? "Flota a la izquierda del texto" : "Flota a la derecha del texto") + (t.mode === "hang" ? ", hasta el margen" : t.mode === "edge" ? ", hasta el borde" : "");
  }
  ind.hidden = false; ind.classList.toggle("is-box", boxy);
  Object.assign(ind.style, { left: r[0] + "px", top: r[1] + "px", width: r[2] + "px", height: r[3] + "px" });
  ind.firstChild.textContent = label;
}
document.addEventListener("dragenter", (e) => { if (isFiles(e)) document.body.classList.add("is-file-drag"); });
document.addEventListener("dragover", (e) => {
  const files = isFiles(e);
  if (dragFrom === null && !dragPhoto && !files) return;
  e.preventDefault();
  if (dragFrom !== null) { showDrop(null); nearestBar(e.clientY)?.classList.add("is-drop"); return; }
  const t = dropTarget(e.clientX, e.clientY, files ? null : dragPhoto);
  const p = dragPhoto && E().photos[dragPhoto.id];
  showDrop(t, p ? ratioOf(p) : 1.5);
});
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) { document.body.classList.remove("is-file-drag"); showDrop(null); } });
document.addEventListener("drop", (e) => {
  e.preventDefault(); document.body.classList.remove("is-file-drag");
  const files = isFiles(e), src = dragPhoto, from = dragFrom;
  const t = from === null ? dropTarget(e.clientX, e.clientY, files ? null : src) : null;
  endDrag();
  if (from !== null) { const bar = nearestBar(e.clientY); if (bar) A().moveTo(from, Number(bar.dataset.at)); return; }
  if (src) {
    if (!t || t.kind === "none") return;
    A().movePhoto(src, t.kind === "mosaic" ? { kind: "mosaic", i: t.i, ref: t.ref, side: t.side } : { kind: "bar", at: t.at, side: t.side, mode: t.mode });
    return;
  }
  if (files) {
    const list = [...e.dataTransfer.files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tif?f)$/i.test(f.name));
    if (!list.length) return;
    if (e.target.closest && e.target.closest("[data-hero]")) A().setHeroFile(list[0]);
    else if (t && t.kind === "mosaic") A().dropFilesOn(list, { i: t.i, ref: t.ref, side: t.side });
    else { const bar = t && t.bar ? t.bar : nearestBar(e.clientY); A().dropFiles(list, bar ? Number(bar.dataset.at) : E().blocks.length); }
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
let guideH = null;
const showGuideH = (y) => { if (!guideH) { guideH = document.createElement("div"); guideH.className = "snap-guide snap-guide-h"; document.body.appendChild(guideH); } guideH.style.top = y + "px"; guideH.hidden = y == null; };
const nearest = (v, list, tol) => { let best = null, d = tol; for (const t of list) { const dd = Math.abs(v - t); if (dd < d) { d = dd; best = t; } } return best; };
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".box-handle"); if (!h || e.button !== 0) return;
  e.preventDefault(); h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"), i = Number(blk.dataset.i), side = h.dataset.side, b = E().blocks[i];
  const C = contentBox(), rect = blk.getBoundingClientRect();
  // what an edge can stick to (page x): the photos' margins, the text column, the centre and the edges of everything else
  const xs = [C.x0, C.x0 + C.cw, C.x0 + C.defL / 100 * C.cw, C.x0 + C.defR / 100 * C.cw, C.x0 + C.cw / 2, ...photoEdges(blk)];
  A().select(i, null);
  if (h.dataset.float) {   // floating card or quote: the inner edge sets its width (a share of the text column, or of the photos' width when it hangs out)
    const col = (C.defR - C.defL) / 100 * C.cw, base = b.wrap.hang ? C.cw : col, edgePx = b.wrap.edge ? rect.width - col * (b.wrap.size || 40) / 100 : 0;
    let size = b.wrap.size || 40;
    const move = (ev) => {
      let x = ev.clientX; const t = nearest(x, xs, 12); if (t != null) x = t;
      const w = side === "l" ? rect.right - x : x - rect.left;
      size = Math.round(Math.max(15, Math.min(70, ((w - edgePx) / base) * 100)));
      blk.style.setProperty("--ws", size / 100); showGuide(t);
    };
    const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); showGuide(null); if (size !== (b.wrap.size || 40)) A().setPhotoFrame(i, { size }); };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
    return;
  }
  // edges as numbers while dragging; an edge left on the reading column is stored as "texto"
  let l = (rect.left - C.x0) / C.cw * 100, r = (rect.right - C.x0) / C.cw * 100, moved = false;
  let lv = b.box ? b.box.l : null, rv = b.box ? b.box.r : null;
  const isCol = (x) => Math.abs(x - (C.x0 + C.defL / 100 * C.cw)) < 0.5 || Math.abs(x - (C.x0 + C.defR / 100 * C.cw)) < 0.5;
  const move = (ev) => {
    moved = true;
    let x = ev.clientX; const t = nearest(x, xs, 12); if (t != null) x = t;
    const v = (x - C.x0) / C.cw * 100;
    if (side === "l") { l = Math.max(0, Math.min(r - 15, v)); lv = t != null && isCol(t) ? "texto" : Math.round(l * 10) / 10; }
    else { r = Math.min(100, Math.max(l + 15, v)); rv = t != null && isCol(t) ? "texto" : Math.round(r * 10) / 10; }
    const cur = { l: lv ?? (Math.abs(l - C.defL) < 0.3 ? "texto" : Math.round(l * 10) / 10), r: rv ?? (Math.abs(r - C.defR) < 0.3 ? "texto" : Math.round(r * 10) / 10) };
    blk.classList.add("has-box"); blk.style.cssText = boxVars(cur); blk.dataset.box = JSON.stringify(cur);
    showGuide(t);
  };
  const up = () => {
    h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); showGuide(null);
    if (!moved) return;
    const box = JSON.parse(blk.dataset.box);
    const normal = WIDE.includes(b.type) ? box.l === 0 && box.r === 100 : box.l === "texto" && box.r === "texto";
    A().setBox(i, normal ? null : box);
  };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
});
root.addEventListener("dblclick", (e) => { const h = e.target.closest(".box-handle"); if (!h) return; const i = Number(h.closest(".blk").dataset.i); if (h.dataset.float) A().setPhotoFrame(i, { size: 40 }); else A().setBox(i, null); });

// ---- resize a photo by its handles ----------------------------------------------------------
// Left and right edges of everything else on the page: each photo (also inside rows), paragraphs and titles (their
// column or free width), text boxes, cards, quotes, facts rows, videos, maps, floating blocks… in page coordinates
function photoEdges(except) {
  const xs = [], add = (el) => { if (!el || (except && except.contains(el))) return; const b = el.getBoundingClientRect(); if (b.width > 8) xs.push(b.left, b.right); };
  document.querySelectorAll(".article-body .ratio").forEach(add);
  document.querySelectorAll(".article-body > .blk").forEach((blk) => {
    if (blk === except || blk.classList.contains("blk-pano") || blk.classList.contains("blk-space")) return;
    add(blk.querySelector(":scope > .container > figure, :scope > .container > .datos-wrap, :scope > .container > .fila, :scope > .container > dl") || blk);
    blk.querySelectorAll(".recuadro, .ficha, .ed-desplegable, .ed-btn").forEach(add);
  });
  return xs;
}
const photoHeights = (except) => [...document.querySelectorAll(".article-body .ratio")].filter((r) => !(except && except.contains(r))).map((r) => r.getBoundingClientRect().height).filter(Boolean);
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".rz"); if (!h || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation(); h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"), i = Number(blk.dataset.i), S = E(), b = S.blocks[i], frame = h.closest(".ratio"), p = S.photos[b.id];
  const k = h.dataset.rz, hx = k.includes("l") ? "l" : k.includes("r") ? "r" : null, vy = k.includes("t") ? "t" : k.includes("b") ? "b" : null;
  const C = contentBox(), rect = frame.getBoundingClientRect(), r0 = ratioOf(p), sx = e.clientX, sy = e.clientY;
  const float = b.wrap && b.wrap.side ? b.wrap : null;
  const xs = [C.x0, C.x0 + C.cw, C.x0 + C.cw / 2, C.x0 + C.defL / 100 * C.cw, C.x0 + C.defR / 100 * C.cw, ...photoEdges(blk)];
  const hs = photoHeights(blk);
  // a floating photo's width is a share of the text column (or of the photos' width when it hangs out); "borde" adds the margin
  const col = C.defR / 100 * C.cw - C.defL / 100 * C.cw, edgePx = float && float.edge ? rect.width - col * (float.size || 40) / 100 : 0;
  A().select(i, null);
  let L = rect.left, R = rect.right, H = rect.height, out = null;
  const move = (ev) => {
    let snapX = null;
    if (hx) {
      let x = (hx === "l" ? rect.left : rect.right) + (ev.clientX - sx);
      const t = nearest(x, xs, 10); if (t != null) { x = t; snapX = t; }
      if (hx === "l") L = Math.min(x, R - 120); else R = Math.max(x, L + 120);
    }
    const W = R - L;
    if (vy) {
      H = Math.max(60, rect.height + (vy === "b" ? 1 : -1) * (ev.clientY - sy));
      const th = nearest(H, hs, 8); if (th != null) H = th;
    } else H = W / r0;   // only the width: the photo keeps its shape
    const ratio = Math.round(Math.max(0.4, Math.min(5, W / H)) * 1000) / 1000;
    frame.style.setProperty("--bs-aspect-ratio", (100 / ratio).toFixed(3) + "%");
    if (float) {
      const base = float.hang ? C.cw : col, size = Math.round(Math.max(15, Math.min(70, ((W - edgePx) / base) * 100)));
      blk.style.setProperty("--ws", size / 100); out = { ratio, size };
    } else {
      const l = Math.max(0, (L - C.x0) / C.cw * 100), r = Math.min(100, (R - C.x0) / C.cw * 100);
      const tok = (v, side) => (Math.abs(v - (side === "l" ? C.defL : C.defR)) < 0.3 ? "texto" : Math.round(v * 10) / 10);
      const box = { l: tok(l, "l"), r: tok(r, "r") };
      if (hx) { blk.classList.add("has-box"); blk.style.cssText = boxVars(box); }
      out = { ratio, box: hx ? box : undefined };
    }
    showGuide(snapX);
  };
  const up = () => {
    h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); showGuide(null);
    if (out) { if (out.box && out.box.l === 0 && out.box.r === 100) out.box = null; A().setPhotoFrame(i, out); }
  };
  h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
});

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
  render();   // nobody else draws this frame: the main canvas is redrawn by the editor, this copy only once
  document.querySelectorAll("textarea").forEach((t) => (t.readOnly = true));
}
