// The panel on the right: the Article, Block and Photos tabs and what their buttons do.
import { act, coordsOf, ytId } from "./actions.js";
import { RATIOS, SECTIONS, textTypes } from "./config.js";
import { findLeaf, insertNode, nodeOfBlock, removeNode, setTree, treeOf } from "./mosaic.js";
import { makeGrid, putNode, rowR, setRowHeight, swapLeaf } from "./mosaic-blocks.js";
import { newPhoto, pickFiles } from "./photos.js";
import { convertBlock, linkSelection, wrapSelection } from "./ribbon.js";
import { mutate } from "./state.js";
import { ED, imgSrc } from "./store.js";
import { $, cdoc, choice, esc, fld, frame, inp, toast } from "./util.js";
import { highlight, refresh } from "./views.js";
// ---- inspector --------------------------------------------------------------------------
export function usedIds() { return new Set(ED.blocks.flatMap((b) => (b.type === "foto" || b.type === "pano" ? [b.id] : b.type === "fila" ? b.ids : b.type === "ficha" && ED.fichas[b.id]?.photo ? [ED.fichas[b.id].photo] : []))); }
export function renderInspectorSoft() { /* alt text changed: refresh the red "falta alt" tags without stealing focus */ const w = frame().contentWindow; const a = document.activeElement; w.render && w.render(); a && a.focus && a.focus(); }
export function renderInspector() {
  const el = $("#insp"); if (!ED.meta) { el.innerHTML = ""; return; }
  const sel = ED.sel && ED.blocks[ED.sel.i] ? ED.sel : null;
  const tabs = [["article", "Artículo"], ["block", "Bloque"], ["photos", "Fotos"]];
  if (ED.tab === "block" && !sel) ED.tab = "article";
  const focused = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
  el.innerHTML = `<div class="insp-tabs"><div class="btn-group w-100">${tabs.map(([k, l]) => `<button data-tab="${k}" class="btn btn-outline-dark ${ED.tab === k ? "active" : ""}" ${k === "block" && !sel ? "disabled" : ""}>${l}</button>`).join("")}</div></div>` +
    `<div class="pane">${ED.tab === "article" ? paneArticle() : ED.tab === "block" ? paneBlock(sel) : panePhotos()}</div>`;
  if (focused) { const f = el.querySelector(`[data-k="${CSS.escape(focused)}"]`); f && f.focus(); }
}
$("#insp").addEventListener("mousedown", (e) => { if (e.target.closest("[data-do=bold],[data-do=italic],[data-do=link],[data-do=unlink]")) e.preventDefault(); });
$("#insp").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]"); if (t) { ED.tab = t.dataset.tab; renderInspector(); return; }
  const b = e.target.closest("[data-do]"); if (b) doAction(b.dataset.do, b.dataset);
});
$("#insp").addEventListener("input", (e) => {
  const t = e.target, k = t.dataset.k; if (!k) return;
  if (k.startsWith("m.")) { const v = t.type === "checkbox" ? t.checked : t.value; act.setMeta(k.slice(2), v || undefined, t.type !== "checkbox"); if (k === "m.description") $("#desc-n").textContent = t.value.length; if (k === "m.date" || k === "m.author" || k === "m.youtube") { const w = frame().contentWindow; w.render && w.render(); } if (t.type === "checkbox") renderInspector(); }
  else if (k.startsWith("p.")) { const [, id, f] = k.split("."); act.setPhoto(id, { [f]: t.value }, true); t.classList.toggle("invalid", f === "alt" && !t.value.trim()); const h = t.parentElement.querySelector(".hint.bad"); if (h && f === "alt") h.hidden = !!t.value.trim(); }
  else if (k === "bt") { act.setText(ED.sel.i, t.value); renderInspectorSoft(); }
  else if (k.startsWith("route.") || k.startsWith("src.")) { editList(k, t.value); }
  else if (k === "focus") { act.setPhoto(ED.blocks[ED.sel.i].id, { focus: Number(t.value) }, true); }
  else if (k.startsWith("f.")) { const [, id, f, idx, sub] = k.split("."); mutate(() => { const fi = ED.fichas[id]; if (f === "row") fi.rows[idx][sub] = t.value; else if (t.value) fi[f] = t.value; else delete fi[f]; }, { typing: true }); }
  else if (k === "rowh") { setRowHeight(Number(t.value)); }
  else if (k === "herozoom") { act.setHeroPos(ED.meta.hero.pos || "50% 50%", Number(t.value) / 100, true); const hn = t.parentElement.querySelector(".hint"); if (hn) hn.firstChild.textContent = `${t.value} %. `; }
  else if (k.startsWith("drow.")) { const [, r, f] = k.split("."); act.setField(ED.sel.i, `rows.${r}.${f}`, t.value); renderInspectorSoft(); }
  else if (k === "panoh") { act.setField(ED.sel.i, "h", Number(t.value)); renderInspectorSoft(); }
  else if (k === "spaceh") { act.setField(ED.sel.i, "size", Number(t.value)); renderInspectorSoft(); }
  else if (k.startsWith("bf.")) { const key = k.slice(3); const v = key === "id" ? ytId(t.value) : key === "coords" ? coordsOf(t.value) : t.value; act.setField(ED.sel.i, key, v.trim()); renderInspectorSoft(); }
  else if (k === "rowfull") { mutate(() => { const bl = ED.blocks[ED.sel.i]; if (t.checked) bl.full = true; else delete bl.full; }); }
});
$("#insp").addEventListener("change", (e) => {
  const t = e.target, k = t.dataset.k; if (!k) return;
  if (k === "m.cabecera" || k === "m.ai") { refresh(); return; }
  if (k === "m.section") { act.setMeta("section", t.value); const slug = (ED.meta.permalink || "").split("/").filter(Boolean).pop(); act.setMeta("permalink", `/es/${t.value}/${slug}/`); }
  else if (k === "pmode") mutate(() => { ED.blocks[ED.sel.i].mode = t.value; });
  else if (k === "focus") mutate(() => {});
  else if (k === "btype") convertBlock(ED.sel.i, t.value);
  else if (k.startsWith("f.") && !k.includes("row")) { const [, id, f] = k.split("."); mutate(() => { ED.fichas[id][f] = t.value; if (!t.value) delete ED.fichas[id][f]; }); }
  else if (k === "whang") mutate(() => { const w = ED.blocks[ED.sel.i].wrap; w.hang = t.checked; if (t.checked) delete w.edge; });
  else if (k === "wedge") mutate(() => { const w = ED.blocks[ED.sel.i].wrap; if (t.checked) { w.edge = true; w.hang = false; } else delete w.edge; });
});
export function editList(k, v) {
  const [kind, idx, f] = k.split(".");
  mutate(() => {
    if (kind === "route") { ED.meta.route = ED.meta.route || []; ED.meta.route[idx] = ED.meta.route[idx] || { label: "", value: "" }; ED.meta.route[idx][f] = v; }
    else { ED.meta.sources = ED.meta.sources || []; ED.meta.sources[idx] = v; }
  }, { typing: true });
}
export function doAction(a, d) {
  const sel = ED.sel; const bl = sel ? ED.blocks[sel.i] : null;
  switch (a) {
    case "bold": return wrapSelection("**");
    case "italic": return wrapSelection("*");
    case "link": return linkSelection();
    case "unlink": { const w = cdoc().defaultView; if (!w.formatText("unlink")) toast("Pon el cursor dentro del enlace primero.", true); return; }
    case "ratio": return act.setPhoto(d.id, { ratio: Number(d.v) }, false, true);
    case "pos0": return act.setPhoto(d.id, { pos: "" }, false, true);
    case "pick-item": ED.sel = { i: sel.i, id: d.id }; highlight(); return renderInspector();
    case "join": return mutate(() => {   // this photo or mosaic and the next one become one mosaic, side by side
      const nx = ED.blocks[sel.i + 1]; const a = nodeOfBlock(bl), b2 = nodeOfBlock(nx);
      putNode(sel.i, { d: "r", k: [a, b2] }); ED.blocks.splice(sel.i + 1, 1); ED.sel = { i: sel.i };
    });
    case "swap": return swapLeaf(sel.i, d.id, Number(d.dir));
    case "grid": return makeGrid(bl, Number($("#grid-cols").value));
    case "ungrid": return mutate(() => { delete bl.tree; });
    case "split-row": return mutate(() => { ED.blocks.splice(sel.i, 1, ...bl.ids.map((id) => ({ type: "foto", id }))); ED.sel = { i: sel.i }; });
    case "out-row": return mutate(() => { const left = putNode(sel.i, removeNode(nodeOfBlock(bl), d.id)); ED.blocks.splice(left ? sel.i + 1 : sel.i, 0, { type: "foto", id: d.id }); ED.sel = { i: left ? sel.i + 1 : sel.i }; });
    case "row-add": return pickFiles(true).then(async (files) => { if (!files.length) return; const made = []; for (const f of files) made.push(await newPhoto(f)); mutate(() => { for (const m of made) ED.photos[m.id] = m.photo; putNode(sel.i, insertNode(nodeOfBlock(bl), "root", "right", made.map((m) => m.id))); ED.sel = { i: sel.i, id: made[0].id }; }); });
    case "replace": return pickFiles(false).then(async ([f]) => { if (!f) return; try { const m = await newPhoto(f); mutate(() => { const old = ED.photos[d.id]; ED.photos[m.id] = { ...m.photo, alt: old.alt, caption: old.caption }; if (bl.type === "fila") { const sw = (t) => t.map((x) => (Array.isArray(x) ? sw(x) : x === d.id ? m.id : x)); const t = sw(treeOf(bl)); setTree(bl, t); } else bl.id = m.id; if (ED.sel) ED.sel.id = bl.type === "fila" ? m.id : null; }); } catch (er) { toast(er.message, true); } });
    case "present": return mutate(() => {   // one "Foto" block, three ways to show it
      const id = bl.id, h = bl.h;
      ED.blocks[sel.i] = d.v === "normal" ? { type: "foto", id, ...(bl.box ? { box: bl.box } : {}) } : d.v === "pantalla" ? { type: "pano", id, mode: "completa" } : { type: "pano", id, mode: "", ...(h ? { h } : {}) };
    });
    case "drow-add": return mutate(() => { bl.rows.push({ label: "", value: "" }); });
    case "drow-del": return mutate(() => { bl.rows.splice(Number(d.i), 1); });
    case "insert-photo": return mutate(() => { const p = ED.photos[d.id]; const at = sel ? sel.i + 1 : ED.blocks.length; ED.blocks.splice(at, 0, p.w / p.h > 2.2 ? { type: "pano", id: d.id, mode: "" } : { type: "foto", id: d.id }); ED.sel = { i: at }; ED.tab = "block"; });
    case "marco": return mutate(() => { bl.marco = !bl.marco; });
    case "linea": return act.cycleLine(sel.i);
    case "box-reset": return act.setBox(sel.i, null);
    case "bset": return mutate(() => { if (d.v) bl[d.key] = d.v; else delete bl[d.key]; });
    case "wrap-none": return mutate(() => { delete bl.wrap; });
    case "wrap-side": return mutate(() => { bl.wrap = { side: d.side, size: bl.wrap?.size || 40, hang: bl.wrap ? bl.wrap.hang : true, ...(bl.wrap?.edge ? { edge: true } : {}) }; });
    case "wrap-size": return mutate(() => { bl.wrap.size = Number(d.v); });
    case "frow-add": return mutate(() => { ED.fichas[bl.id].rows.push({ label: "", value: "" }); });
    case "frow-del": return mutate(() => { ED.fichas[bl.id].rows.splice(Number(d.i), 1); });
    case "fphoto": return pickFiles(false).then(async ([f]) => { if (!f) return; try { const m = await newPhoto(f); mutate(() => { ED.photos[m.id] = m.photo; ED.fichas[bl.id].photo = m.id; }); } catch (er) { toast(er.message, true); } });
    case "fphoto-del": return mutate(() => { delete ED.fichas[bl.id].photo; });
    case "hero-replace": return act.pickHero();
    case "hero-center": return act.setHeroPos("50% 50%");
    case "route-add": return mutate(() => { (ED.meta.route = ED.meta.route || []).push({ label: "", value: "" }); });
    case "route-del": return mutate(() => { ED.meta.route.splice(Number(d.i), 1); if (!ED.meta.route.length) delete ED.meta.route; });
    case "src-add": return mutate(() => { (ED.meta.sources = ED.meta.sources || []).push(""); });
    case "src-del": return mutate(() => { ED.meta.sources.splice(Number(d.i), 1); if (!ED.meta.sources.length) delete ED.meta.sources; });
  }
}
export function paneArticle() {
  const m = ED.meta, h = m.hero;
  const hero = h ? `<div class="btnrow"><button class="btn btn-outline-dark" data-do="hero-replace">Cambiar foto</button><button class="btn btn-outline-dark" data-do="hero-center">Centrar</button></div>
    ${h.srcW ? fld("Acercar la portada", `<input class="form-range" type="range" min="100" max="300" step="5" data-k="herozoom" value="${Math.round((h.zoom || 1) * 100)}">`, `<p class="hint">${Math.round((h.zoom || 1) * 100)} %. Acércala y arrastra la foto en la página para elegir el recorte; también con los botones + y − sobre la foto.</p>`) : '<p class="hint">Para encuadrar o acercar esta portada, elige la foto otra vez con «Cambiar foto».</p>'}
    ${fld("Texto alternativo de la portada", `<textarea data-k="m.hero.alt" class="form-control ${h.alt ? "" : "invalid"}" placeholder="Describe lo que se ve en la foto">${esc(h.alt)}</textarea>`, h.alt ? "" : '<p class="hint bad">Obligatorio: describe la foto.</p>')}` : `<button class="btn btn-outline-dark" data-do="hero-replace">Elegir la foto principal</button>`;
  return `
${fld("Título", `<textarea class="form-control" data-k="m.title" rows="2">${esc(m.title)}</textarea>`)}
${fld("Descripción para Google", `<textarea class="form-control" data-k="m.description" rows="3" class="${m.description ? "" : "invalid"}">${esc(m.description)}</textarea>`, `<p class="hint"><span id="desc-n">${(m.description || "").length}</span> de unos 155 caracteres</p>`)}
${fld("Sección", `<select class="form-select" data-k="m.section">${SECTIONS.map(([k, l]) => `<option value="${k}" ${m.section === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
${fld("Fecha", inp("m.date", m.date, "", "date"))}
${fld("Video de YouTube", inp("m.youtube", m.youtube, "Pega el enlace o el código"), '<p class="hint">Se reproduce al hacer clic sobre la portada.</p>')}
<div class="form-check"><input class="form-check-input" type="checkbox" id="c-draft" data-k="m.draft" ${m.draft ? "checked" : ""}><label class="form-check-label" for="c-draft">Borrador (no sale en el inicio, la sección ni el buscador; Google no lo indexa)</label></div>
<div class="form-check"><input class="form-check-input" type="checkbox" id="c-ai" data-k="m.ai" ${m.ai ? "checked" : ""}><label class="form-check-label" for="c-ai">Mostrar aviso de texto escrito con IA</label></div>
<hr>${fld("Cabecera", `<select class="form-select" data-k="m.cabecera">${[["", "Foto grande con el título encima"], ["debajo", "Foto grande con el título debajo"], ["titulo", "Título arriba y la foto debajo"], ["texto", "Solo el título, sin foto"]].map(([v, l]) => `<option value="${v}" ${(m.cabecera || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
${hero}<hr>
${fld("Crédito de las fotos", inp("m.credit", m.credit))}
${fld("Autor", inp("m.author", m.author))}
<div><label class="form-label">Fuentes</label>${(m.sources || []).map((s, i) => `<div class="rowpair"><input class="form-control" type="text" data-k="src.${i}" value="${esc(s)}"><button class="btn btn-outline-danger" data-do="src-del" data-i="${i}" aria-label="Quitar">×</button></div>`).join("")}<button class="btn btn-outline-dark" data-do="src-add">Agregar fuente</button></div>`;
}

export function photoForm(id) {
  const p = ED.photos[id]; if (!p) return "";
  const cur = Number(p.ratio) > 0 ? Number(p.ratio) : 0;
  return `${fld("Texto alternativo", `<textarea data-k="p.${id}.alt" class="form-control ${p.alt ? "" : "invalid"}" placeholder="Describe lo que se ve en la foto">${esc(p.alt)}</textarea>`, `<p class="hint bad" ${p.alt ? "hidden" : ""}>Obligatorio: sirve para accesibilidad y Google.</p>`)}
<div><label class="form-label">Recorte</label><div class="btnrow">${RATIOS.map(([l, v]) => `<button class="btn btn-outline-dark ${Math.abs(cur - v) < 0.01 ? "active" : ""}" data-do="ratio" data-id="${esc(id)}" data-v="${v}">${l}</button>`).join("")}</div>
<p class="hint">Arrastra la foto para encuadrar. Arrastra la barra inferior para recortar a mano.</p><div class="btnrow"><button class="btn btn-outline-dark" data-do="pos0" data-id="${esc(id)}">Centrar</button></div></div>`;
}

export function wrapPane(b) {
  const w = b.wrap && b.wrap.side ? b.wrap : null;
  return `<div><label class="form-label">Ajuste del texto</label><div class="btnrow">
<button class="btn btn-outline-dark ${!w ? "active" : ""}" data-do="wrap-none">En su propia fila</button>
<button class="btn btn-outline-dark ${w && w.side === "left" ? "active" : ""}" data-do="wrap-side" data-side="left">Flotar a la izquierda</button>
<button class="btn btn-outline-dark ${w && w.side === "right" ? "active" : ""}" data-do="wrap-side" data-side="right">Flotar a la derecha</button></div>
${w ? `<div class="btnrow">${[[33, "Pequeño"], [40, "Mediano"], [50, "Grande"]].map(([v, l]) => `<button class="btn btn-outline-dark ${w.size === v ? "active" : ""}" data-do="wrap-size" data-v="${v}">${l}</button>`).join("")}</div><p class="hint">Ancho: ${w.size || 40} % de la columna de texto${w.hang ? " (del ancho de las fotos, porque sobresale)" : ""}.${b.type === "foto" ? " También se cambia arrastrando el cuadrito rosa del lado interior de la foto." : " También se cambia arrastrando la barra rosa de su lado interior."}</p>
<div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="c-hang" data-k="whang" ${w.hang ? "checked" : ""}><label class="form-check-label" for="c-hang">Sobresale hasta el margen exterior</label></div>${b.type === "foto" ? `<div class="form-check"><input class="form-check-input" type="checkbox" id="c-edge" data-k="wedge" ${w.edge ? "checked" : ""}><label class="form-check-label" for="c-edge">Hasta el borde de la pantalla</label></div><p class="hint">También puedes arrastrar la barra rosa del lado de la foto hacia el borde de la pantalla.</p>` : ""}` : ""}
${b.type === "foto" ? '<p class="hint">También puedes arrastrar la foto por su manija ✥ (arriba a la izquierda) y soltarla a un lado de un párrafo: flota de ese lado; más afuera, sobresale hasta el margen o llega al borde de la pantalla. Soltada entre dos párrafos, al centro, vuelve a su propia fila.</p>' : ""}<p class="hint">Como el "Cuadrado" de Word: el texto rodea el elemento y después vuelve a todo el ancho. Los títulos y las fotos grandes siempre empiezan debajo. En celular cada elemento ocupa su propia fila.</p></div>`;
}
export function fichaPane(b) {
  const f = ED.fichas[b.id]; if (!f) return "";
  const ph = f.photo && ED.photos[f.photo];
  return `<div><label class="form-label">Datos</label>${rowList(f.rows, "frow-del")}<button class="btn btn-outline-dark" data-do="frow-add">Agregar dato</button><p class="hint">El título y los datos se escriben directamente en la ficha. Para enlazar el título, selecciónalo y usa el botón de enlace de la barra de arriba.</p></div>
${fld("Formato", `<select class="form-select" data-k="f.${b.id}.format"><option value="lista" ${f.format !== "tabla" ? "selected" : ""}>Lista (Dato: valor)</option><option value="tabla" ${f.format === "tabla" ? "selected" : ""}>Tabla de dos columnas</option></select>`)}
${fld("Color", `<select class="form-select" data-k="f.${b.id}.tone">${[["gris", "Gris"], ["sin fondo", "Sin fondo"], ["amarillo", "Amarillo (advertencia)"], ["rojo", "Rojo (importante)"], ["verde", "Verde (llamar la atención)"]].map(([v, l]) => `<option value="${v}" ${(f.tone || "gris") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
<div><label class="form-label">Foto de la ficha (opcional)</label><div class="btnrow"><button class="btn btn-outline-dark" data-do="fphoto">${ph ? "Cambiar foto" : "Agregar foto"}</button>${ph ? '<button class="btn btn-outline-danger" data-do="fphoto-del">Quitar foto</button>' : ""}</div></div>
${ph ? photoForm(f.photo) : ""}`;
}
// Rows of a card or a facts row: the text is written on the page; here you only add or remove rows
export const plainMd = (t) => String(t || "").replace(/\*+/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
export const rowList = (rows, del) => `<ul class="list-unstyled mb-2">${(rows || []).map((r, i) => `<li class="rowpair single"><span class="flex-grow-1 text-truncate">${esc(plainMd(r.label) || "Dato")} · <span class="text-secondary">${esc(plainMd(r.value) || "sin valor")}</span></span><button class="btn btn-outline-danger" data-do="${del}" data-i="${i}" aria-label="Quitar este dato" title="Quitar este dato">×</button></li>`).join("")}</ul>`;
// Text box: background, frame and line are independent; none of them moves the text
export function calloutPane(b) {
  const L = { rosa: "Rosa", amarillo: "Amarilla", verde: "Verde", rojo: "Roja", "": "Sin línea" };
  return `<div><label class="form-label">Fondo</label>${choice(b, "fondo", [["gris", "Gris"], ["sin-fondo", "Sin fondo"], ["amarillo", "Amarillo"], ["rojo", "Rojo"], ["verde", "Verde"]])}</div>
<div class="btnrow mt-2"><button class="btn btn-outline-dark ${b.marco ? "active" : ""}" data-do="marco">Marco${b.marco ? ": sí" : ": no"}</button><button class="btn btn-outline-dark" data-do="linea" title="Cada clic cambia el color: rosa, amarillo, verde, rojo, sin línea">Línea: ${L[b.linea || ""]}</button></div>
<p class="hint">El marco toma el color del fondo (negro si es gris o sin fondo). La línea también cambia con un clic en el borde izquierdo del recuadro. El texto no se mueve con ninguno de los dos.</p>`;
}
export function boxPane(b) {
  const wide = ["datos", "foto", "fila", "quote", "video", "map", "ficha"].includes(b.type);
  const normal = wide ? "el ancho de las fotos" : "la columna de texto", back = wide ? "al ancho de las fotos" : "a la columna de texto";
  if (!b.box) return `<div><label class="form-label">Ancho</label><p class="hint">Normal: ${normal}. ${b.type === "foto" ? "Arrastra los cuadritos rosas de los lados de la foto" : "Arrastra las barras rosas a los lados del bloque"} para cambiarlo; los bordes se pegan a los márgenes de las fotos, a los de la columna de texto, al centro y a los bordes de las otras fotos.</p></div>`;
  const edge = (v, side) => v === "texto" ? "el margen de la columna de texto" : v === 0 || v === 100 ? "el margen de las fotos" : v === 50 ? "el centro" : `${side === "l" ? v : 100 - v}% ${side === "l" ? "desde el margen izquierdo" : "antes del margen derecho"} de las fotos`;
  return `<div><label class="form-label">Ancho</label><p class="hint mb-2">Izquierda: ${edge(b.box.l, "l")}. Derecha: ${edge(b.box.r, "r")}. Doble clic en una barra rosa, o el botón, lo devuelve ${back}. En celular vuelve a la columna normal.</p><button class="btn btn-outline-dark" data-do="box-reset">Volver al ancho normal</button></div>`;
}
// What the selected block is, what it is for and how to add one: so the writer learns the blocks while editing
export const KINDS = {
  p: ["Párrafo", "El texto normal del artículo.", "Enter al final de otro párrafo, o Insertar → Párrafo. Ctrl + Shift + N vuelve cualquier bloque de texto a párrafo."],
  h2: ["Título", "Abre una sección del artículo. Siempre empieza debajo de las fotos y fichas flotantes.", "Escribe «## » al empezar un párrafo, Ctrl + Alt + 1, o Estilo → Título en la barra."],
  h3: ["Subtítulo", "Divide una sección en partes más pequeñas.", "Escribe «### » al empezar un párrafo, Ctrl + Alt + 2, o Estilo → Subtítulo."],
  ul: ["Lista con viñetas", "Puntos sin orden: equipo, consejos, listas cortas.", "Escribe «- » al empezar un párrafo, Ctrl + Shift + L, o el botón de viñetas de la barra."],
  ol: ["Lista numerada", "Pasos que van en orden.", "Escribe «1. » al empezar un párrafo, o el botón de lista numerada de la barra."],
  quote: ["Cita destacada", "Una frase grande para destacar una idea, con autor opcional. Puede flotar junto al texto.", "Escribe «> » al empezar un párrafo, o Insertar → Cita destacada."],
  callout: ["Recuadro de texto", "Resalta un consejo, un dato o una advertencia, con fondo, marco y línea de color.", "Insertar → Recuadro de texto, o Estilo → Recuadro de texto."],
  details: ["Desplegable", "Pregunta y respuesta que el lector abre con un clic. Varios seguidos forman unas preguntas frecuentes.", "Insertar → Desplegable."],
  foto: ["Foto", "Una foto al ancho de las fotos, con recorte libre. Puede flotar junto al texto o ir de borde a borde.", "Arrastra la foto sobre la página, o Insertar → Foto…"],
  pano: ["Foto", "", "Arrastra la foto sobre la página, o Insertar → Foto…"],
  fila: ["Mosaico de fotos", "Varias fotos juntas, en una fila o en filas y columnas, que encajan al ancho de una foto sola. Cada foto tiene su tamaño y su recorte.", "Arrastra una foto desde tu computadora y suéltala sobre otra foto de la página, o Insertar → Mosaico de fotos…"],
  video: ["Video de YouTube", "La miniatura del video; se carga solo cuando el lector hace clic.", "Insertar → Video de YouTube."],
  map: ["Mapa", "Un mapa de OpenStreetMap con una marca en el lugar.", "Insertar → Mapa."],
  datos: ["Datos en fila", "Datos grandes entre dos líneas: lugar, distancia, desnivel, dificultad…", "Insertar → Datos en fila."],
  button: ["Botón", "Un enlace grande y visible, para reservar, comprar o ver más.", "Insertar → Botón."],
  hr: ["Línea separadora", "Separa dos partes del artículo.", "Insertar → Línea separadora, o escribe «---» en un párrafo y pulsa Enter."],
  space: ["Espacio en blanco", "Aire entre dos bloques; la altura se arrastra con la barra rosa.", "Insertar → Espacio en blanco."],
  ficha: ["Ficha de datos", "Un cuadro con título, datos y foto opcional. Puede flotar junto al texto.", "Insertar → Ficha de datos."],
  raw: ["Código HTML", "HTML o Markdown que el editor no conoce; se publica tal cual.", "Insertar → Código HTML."],
};
export function kindHead(b) {
  const k = KINDS[b.type]; if (!k) return "";
  let [name, what, how] = k;
  if (b.type === "pano") { name = b.mode === "completa" ? "Foto · ancho de pantalla" : "Foto · panorámica deslizable"; what = b.mode === "completa" ? "La foto entera, de borde a borde de la pantalla." : "De borde a borde con altura limitada; el lector la desliza a los lados."; how += " Luego elige su presentación aquí abajo."; }
  const tags = [b.wrap && b.wrap.side ? (b.wrap.side === "left" ? "flota a la izquierda" : "flota a la derecha") : "", b.align === "center" ? "centrado" : "", b.box ? "ancho libre" : ""].filter(Boolean);
  return `<div class="kind"><div class="d-flex flex-wrap align-items-center gap-2"><span class="tape">${name}</span>${tags.map((t) => `<span class="kind-tag">${t}</span>`).join("")}</div><p class="hint mb-1 mt-2">${what}</p><p class="hint mb-0"><strong>Para agregar uno:</strong> ${how}</p></div><hr>`;
}
export const presentPane = (b) => { const cur = b.type === "foto" ? "normal" : b.mode === "completa" ? "pantalla" : "deslizable";
  return `<div><label class="form-label">Presentación de la foto</label><div class="btnrow">${[["normal", "Normal"], ["pantalla", "Ancho de pantalla"], ["deslizable", "Panorámica deslizable"]].map(([v, l]) => `<button class="btn btn-outline-dark ${cur === v ? "active" : ""}" data-do="present" data-v="${v}">${l}</button>`).join("")}</div>
<p class="hint">Normal: al ancho de las fotos, con recorte libre y ajuste de texto. Ancho de pantalla: de borde a borde, entera. Panorámica deslizable: de borde a borde con altura limitada; el lector la desliza. Las fotos muy anchas entran como panorámicas.</p></div>`; };
export function paneBlock(sel) {
  const b = ED.blocks[sel.i]; if (!b) return "";
  return kindHead(b) + paneBlockBody(sel, b);
}
export function paneBlockBody(sel, b) {
  if (b.type === "quote") return `${wrapPane(b)}<p class="hint">El autor se escribe debajo de la cita, en la página. El formato del texto está en la barra de arriba.</p>${b.wrap ? "" : boxPane(b)}`;
  if (textTypes.includes(b.type)) return `<p class="hint">El estilo, el formato y la alineación están en la barra de arriba, como en Word. Enter crea un párrafo nuevo; Shift+Enter, un salto de línea.</p>${boxPane(b)}`;
  if (b.type === "ul" || b.type === "ol") return `<p class="hint">Enter agrega otro punto. Enter en un punto vacío, o Backspace al inicio del primero, sale de la lista. También puedes empezar un párrafo con «- » o «1. ».</p>${boxPane(b)}`;
  if (b.type === "callout") return `${calloutPane(b)}${boxPane(b)}`;
  if (b.type === "details") return `<p class="hint">Escribe el título en la línea gruesa y el contenido debajo. En el sitio se abre y se cierra con un clic. Varios seguidos forman una lista de preguntas.</p>${boxPane(b)}`;
  if (b.type === "button") return `${fld("Dirección del enlace", inp("bf.url", b.url, "https://…"), b.url ? "" : '<p class="hint bad">Falta la dirección.</p>')}<div><label class="form-label">Estilo</label>${choice(b, "style", [["primario", "Principal (rosa)"], ["secundario", "Secundario (borde)"]])}</div><div><label class="form-label">Alineación</label>${choice(b, "align", [["", "Izquierda"], ["center", "Centrada"]])}</div><p class="hint">El texto del botón se escribe directamente en la página.</p>${boxPane(b)}`;
  if (b.type === "video") return `${fld("Enlace de YouTube", inp("bf.id", b.id ? `https://youtu.be/${b.id}` : "", "Pega el enlace del video"), '<p class="hint">Se muestra la miniatura; el video se carga solo cuando el lector hace clic.</p>')}${boxPane(b)}`;
  if (b.type === "map") return `${fld("Lugar", `<input class="form-control" type="text" data-k="bf.coords" value="${esc(b.coords)}" placeholder="Pega un enlace de Google Maps o coordenadas">`, b.coords ? '<p class="hint">Coordenadas: latitud, longitud.</p>' : '<p class="hint bad">Abre el lugar en Google Maps, copia el enlace de la barra del navegador y pégalo aquí.</p>')}
${fld("Nombre del lugar (opcional)", inp("bf.label", b.label, "Caprock Canyons"))}
<div><label class="form-label">Acercamiento</label>${choice(b, "zoom", [["7", "Región"], ["11", "Zona"], ["14", "Pueblo"], ["16", "Calle"]])}</div>
<p class="hint">El mapa es de OpenStreetMap: no necesita cuenta y no rastrea al lector.</p>${boxPane(b)}`;
  if (b.type === "hr") return `<p class="hint">Una línea que separa dos partes del artículo, al ancho del texto.</p>${boxPane(b)}`;
  if (b.type === "space") return fld("Altura del espacio", `<input class="form-range" type="range" min="0.5" max="16" step="0.5" data-k="spaceh" value="${Number(b.size) || 3}">`, `<p class="hint">${Number(b.size) || 3} rem. También puedes arrastrar la barra rosa bajo el espacio.</p>`);
  if (b.type === "raw") return `${fld("Código", `<textarea class="form-control font-monospace" data-k="bt" rows="10" spellcheck="false">${esc(b.text)}</textarea>`, '<p class="hint">HTML o Markdown tal cual. Se publica sin cambios; revisa la vista previa.</p>')}`;
  if (b.type === "ficha") return `${wrapPane(b)}${b.wrap ? "" : `<hr>${boxPane(b)}`}<hr>${fichaPane(b)}`;
  if (b.type === "foto") {
    const nx = ED.blocks[sel.i + 1]; const canJoin = nx && (nx.type === "foto" || nx.type === "fila");
    return `${presentPane(b)}<hr>${wrapPane(b)}${b.wrap ? "" : `<hr>${boxPane(b)}`}<p class="hint">Los cuadritos rosas alrededor de la foto cambian su tamaño: los lados, el ancho; arriba y abajo, el alto (el recorte); las esquinas, las dos cosas. Sus bordes se pegan a los de las otras fotos, a los márgenes y a la columna de texto.</p><hr>${photoForm(b.id)}<hr><div class="btnrow">${canJoin && !b.wrap ? '<button class="btn btn-outline-dark" data-do="join">Hacer un mosaico con la siguiente</button>' : ""}<button class="btn btn-outline-dark" data-do="replace" data-id="${esc(b.id)}">Cambiar foto</button></div><p class="hint">${MOVE_HINT}</p>`;
  }
  if (b.type === "fila") {
    const id = sel.id && b.ids.includes(sel.id) ? sel.id : b.ids[0];
    const nx = ED.blocks[sel.i + 1]; const canJoin = nx && (nx.type === "foto" || nx.type === "fila");
    const alto = Math.round(100 / rowR(b));
    return `${b.full ? "" : `${boxPane(b)}<hr>`}<div class="form-check"><input class="form-check-input" type="checkbox" id="c-full" data-k="rowfull" ${b.full ? "checked" : ""}><label class="form-check-label" for="c-full">Ancho completo de la pantalla</label></div>${fld("Altura del mosaico", `<input class="form-range" type="range" min="14" max="160" step="1" data-k="rowh" value="${Math.min(160, alto)}">`, '<p class="hint">También puedes arrastrar la barra rosa bajo el mosaico.</p>')}
<p class="hint"><strong>Tamaño de cada foto:</strong> arrastra las barras rosas que aparecen entre las fotos; reparten el espacio entre las dos fotos (o grupos) que separan, y se pegan a los bordes de las demás. <strong>Recorte:</strong> arrastra dentro de una foto para encuadrarla.</p>
<hr><div><label class="form-label">Fotos del mosaico</label><div class="thumbs">${b.ids.map((x) => `<button class="thumb ${x === id ? "on" : ""} ${ED.photos[x]?.alt ? "" : "miss"}" data-do="pick-item" data-id="${esc(x)}"><img src="${imgSrc(ED.meta.imgBase, ED.photos[x]?.file, "-sm.jpg")}" alt=""><span>${ED.photos[x]?.alt ? "Foto " + (b.ids.indexOf(x) + 1) : "Falta texto alternativo"}</span></button>`).join("")}</div></div>
${structPane(b, id)}<hr>${photoForm(id)}<hr><div class="btnrow"><button class="btn btn-outline-dark" data-do="row-add">Agregar fotos al mosaico</button>${canJoin ? '<button class="btn btn-outline-dark" data-do="join">Unir con el siguiente</button>' : ""}<button class="btn btn-outline-dark" data-do="out-row" data-id="${esc(id)}">Sacar esta foto del mosaico</button><button class="btn btn-outline-dark" data-do="replace" data-id="${esc(id)}">Cambiar esta foto</button><button class="btn btn-outline-dark" data-do="split-row">Separar todas</button></div>`;
  }
  if (b.type === "pano") {
    const p = ED.photos[b.id] || {};
    return `${presentPane(b)}
${b.mode !== "completa" ? fld("Altura", `<input class="form-range" type="range" min="25" max="90" step="1" data-k="panoh" value="${b.h || 50}">`, '<p class="hint">También puedes arrastrar la barra rosa bajo la foto. Es una parte del alto de la pantalla del lector.</p>') + fld("Punto de inicio", `<input class="form-range" type="range" min="0" max="100" data-k="focus" value="${Number.isFinite(p.focus) ? p.focus : 50}">`, '<p class="hint">Qué parte de la foto aparece centrada al abrirla.</p>') : ""}
<hr>${photoForm(b.id)}<hr><div class="btnrow"><button class="btn btn-outline-dark" data-do="replace" data-id="${esc(b.id)}">Cambiar foto</button></div>`;
  }
  if (b.type === "datos") return `<div><label class="form-label">Datos</label>${rowList(b.rows, "drow-del")}<button class="btn btn-outline-dark" data-do="drow-add">Agregar dato</button></div><p class="hint">Una fila de datos grandes entre dos líneas, como la ficha de una etapa. Los nombres y los valores se escriben directamente en la página. Se puede usar en cualquier parte del artículo y las veces que quieras. En celular se acomoda en dos columnas.</p>${boxPane(b)}`;
  return `<p class="hint">Este bloque tiene un formato que el editor no conoce. Se conserva tal cual.</p>`;
}

// Order of the selected photo and quick layouts. Building the mosaic by hand is done by dragging photos on the page.
export function structPane(b, id) {
  const f = findLeaf(nodeOfBlock(b), id); if (!f) return "";
  const inRow = !f.parent || f.parent.d === "r", n = f.parent ? f.parent.k.length : 1;
  const swap = (dir, ok, text) => (ok ? `<button class="btn btn-outline-dark" data-do="swap" data-id="${esc(id)}" data-dir="${dir}">${text}</button>` : "");
  return `<div><label class="form-label">Organizar</label><div class="btnrow">
${swap(-1, f.j > 0, inRow ? "← Pasar a la izquierda" : "↑ Pasar arriba")}${swap(1, f.j < n - 1, inRow ? "Pasar a la derecha →" : "Pasar abajo ↓")}
${b.tree ? '<button class="btn btn-outline-dark" data-do="ungrid">Todas en una fila</button>' : ""}</div>
<div class="d-flex flex-wrap gap-2 align-items-center mt-2"><button class="btn btn-outline-dark" data-do="grid">Ordenar en cuadrícula de</button><input class="form-control" style="width: 4.5rem" type="number" min="1" max="6" value="2" id="grid-cols" aria-label="Columnas"><span class="hint m-0">columnas</span></div>
<p class="hint">${MOVE_HINT}</p></div>`;
}
export const MOVE_HINT = "Para armar un mosaico, arrastra una foto desde tu computadora, o la manija ✥ de otra foto de la página, y suéltala sobre una foto: entra a la izquierda, a la derecha, arriba o abajo de esa foto según el lado donde la sueltes; cerca del borde de arriba o de abajo del mosaico, entra en una fila nueva arriba o abajo de todas. Una línea rosa muestra dónde va a quedar. Arrastrada junto a un párrafo, la foto flota a ese lado del texto.";

export function panePhotos() {
  const used = usedIds(); const ids = Object.keys(ED.photos);
  if (!ids.length) return '<p class="empty">Todavía no hay fotos. Arrástralas sobre la página o usa el botón + entre los bloques.</p>';
  return `<p class="hint">Haz clic en una foto para insertarla debajo del bloque seleccionado (o al final).</p><div class="thumbs">${ids.map((id) => `<button class="thumb ${used.has(id) ? "" : "on"} ${ED.photos[id].alt ? "" : "miss"}" data-do="insert-photo" data-id="${esc(id)}"><img src="${imgSrc(ED.meta.imgBase, ED.photos[id].file, "-sm.jpg")}" alt=""><span>${used.has(id) ? "En el artículo" : "Sin usar"}${ED.photos[id].alt ? "" : " · falta alt"}</span></button>`).join("")}</div>`;
}
