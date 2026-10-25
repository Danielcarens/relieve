// RELIEVE editor: state, actions and inspector. The canvas (canvas.js) calls window.act.
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SECTIONS = [["viajes", "Viajes"], ["bici", "Bici"], ["moto", "Moto"], ["reviews", "Reviews"], ["videos", "Videos"], ["opinion", "Opinión"]];
const RATIOS = [["Original", 0], ["3:2", 1.5], ["4:3", 4 / 3], ["16:9", 16 / 9], ["2:1", 2], ["1:1", 1], ["4:5", 0.8], ["3:4", 0.75]];
const PANO_MODES = [["", "Deslizable"], ["alta", "Deslizable, más alta"], ["completa", "Ancho completo, sin deslizar"]];

// What can be inserted, grouped like Squarespace's block menu. [type, label] or ["", group title]
window.INSERT_MENU = [
  ["", "Texto"], ["p", "Párrafo"], ["h2", "Título"], ["h3", "Subtítulo"], ["ul", "Lista con viñetas"], ["ol", "Lista numerada"],
  ["quote", "Cita destacada"], ["callout", "Recuadro de texto"], ["details", "Desplegable (pregunta y respuesta)"],
  ["", "Fotos y video"], ["foto", "Foto…"], ["fila", "Fila o cuadrícula de fotos…"], ["video", "Video de YouTube"], ["map", "Mapa"],
  ["", "Diseño"], ["datos", "Datos en fila (lugar, distancia…)"], ["button", "Botón"], ["hr", "Línea separadora"], ["space", "Espacio en blanco"], ["ficha", "Ficha de datos"], ["raw", "Código HTML"],
];
const ED = window.ED = { path: null, meta: null, photos: {}, fichas: {}, blocks: [], sel: null, tab: "article", problems: [], heroV: 0, cfg: {} };
let hist = [], fut = [], lastType = 0, saveTimer = null, saving = false, dirty = false, device = "desktop";
const frame = () => $("#canvas");
window.imgSrc = (base, file, suf) => (MODE === "web" && web && web.pendingUrl(`src${base}${file}${suf}`)) || `${base}${file}${suf}`;
window.SECTION_NAMES = Object.fromEntries(SECTIONS);
window.heroSrc = (m) => {
  const h = m.hero, dir = (/\/assets\/img\/([^/]+)\//.exec(m.imgBase || "") || [])[1];
  if (MODE === "web") return (web && web.heroSourceUrl(m)) || window.imgSrc(m.imgBase, h.file, "-1280.jpg");
  return h.srcW && dir ? `/originals/${dir}/hero-source.jpg?v=${ED.heroV || 0}` : `${m.imgBase}${h.file}-1280.jpg?v=${ED.heroV || 0}`;
};
const cdoc = () => frame().contentDocument;

// ---- where the editor runs -------------------------------------------------------------------
// local: started with "Iniciar editor.bat" (Node server on this computer, git, Eleventy preview)
// web:   opened from the website (relievemag.com/editor/): GitHub API + the browser (web.js)
const MODE = new URLSearchParams(location.search).get("modo") || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "local" : "web");
let web = null;
window.EDITOR_MODE = MODE;

// ---- tiny API client -------------------------------------------------------------------
async function api(path, opts = {}) {
  if (MODE === "web") return web.handle(opts.method || "GET", path, opts.body);
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Error ${r.status}`), { conflict: !!j.conflict });
  return j;
}
const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
function toast(msg, err = false, ms = 4500) {
  const t = document.createElement("div"); t.className = "alert rounded-0 border-2 mb-0 " + (err ? "alert-danger border-danger" : "bg-body border-strong"); t.textContent = msg;
  $("#toast").appendChild(t); setTimeout(() => t.remove(), ms);
}
function modal(html, onMount) {
  const m = $("#modal"); m.innerHTML = html; m.hidden = false;
  try { const ad = frame().contentDocument.activeElement; ad && ad.blur && ad.blur(); } catch {}  /* keyboard focus must leave the page iframe, or typing in the dialog goes nowhere */
  window.focus();
  m.onmousedown = (e) => { if (e.target === m) closeModal(); };
  onMount && onMount(m);
}
const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };

// ---- history / saving --------------------------------------------------------------
const snap = () => JSON.stringify({ meta: ED.meta, photos: ED.photos, fichas: ED.fichas, blocks: ED.blocks });
function restore(s) {
  const o = JSON.parse(s); ED.meta = o.meta; ED.photos = o.photos; ED.fichas = o.fichas || {}; ED.blocks = o.blocks;
  const i = Math.min(lastCaret ?? -1, ED.blocks.length - 1);
  ED.sel = i >= 0 ? { i } : null; if (i >= 0 && TEXTY.includes(ED.blocks[i].type)) ED.focus = { i };
  refresh(); markDirty();
}
function mutate(fn, { typing = false } = {}) {
  const before = snap();
  fn();
  const now = Date.now();
  if (!typing || now - lastType > 1200) { hist.push(before); if (hist.length > 200) hist.shift(); fut = []; }
  lastType = typing ? now : 0;
  markDirty();
  if (!typing) refresh();
  updateUndo();
}
function updateUndo() { $("#undo").disabled = !hist.length; $("#redo").disabled = !fut.length; }
function undo() { if (!hist.length) return; fut.push(snap()); restore(hist.pop()); updateUndo(); }
function redo() { if (!fut.length) return; hist.push(snap()); restore(fut.pop()); updateUndo(); }
function markDirty() { dirty = true; setState("Cambios sin guardar"); updateCount(); clearTimeout(saveTimer); saveTimer = setTimeout(save, 1200); }
function setState(t) { $("#save-state").textContent = t; }
async function save() {
  clearTimeout(saveTimer);
  if (!ED.path || !dirty) return;
  if (saving) { saveTimer = setTimeout(save, 400); return; }
  saving = true; setState("Guardando…"); dirty = false;
  try { const r = await post("/api/article", { path: ED.path, meta: ED.meta, photos: ED.photos, fichas: ED.fichas, blocks: ED.blocks }); ED.problems = r.problems; setState(dirty ? "Cambios sin guardar" : "Guardado"); }
  catch (e) { dirty = true; setState("No se pudo guardar"); toast("No se pudo guardar: " + e.message, true); }
  saving = false;
}
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h" && ED.meta) { e.preventDefault(); findReplace(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  else if ((e.ctrlKey || e.metaKey) && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) && ["z", "y"].includes(e.key.toLowerCase())) { e.preventDefault(); e.key.toLowerCase() === "z" && !e.shiftKey ? undo() : redo(); }
});
addEventListener("beforeunload", (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ""; } });

// ---- rendering ---------------------------------------------------------------------
function refresh() {
  const w = frame().contentWindow; if (w && w.render) w.render();
  renderInspector();
  $("#crumb").textContent = ED.meta ? ED.meta.title || "Sin título" : "";
}
function highlight() {
  updateRibbon();
  const d = cdoc(); if (!d) return;
  d.querySelectorAll(".is-sel").forEach((n) => n.classList.remove("is-sel"));
  d.querySelectorAll(".is-sel-item").forEach((n) => n.classList.remove("is-sel-item"));
  if (ED.sel) {
    d.querySelector(`.blk[data-i="${ED.sel.i}"]`)?.classList.add("is-sel");
    if (ED.sel.id) d.querySelector(`[data-item="${CSS.escape(ED.sel.id)}"]`)?.classList.add("is-sel-item");
  }
}

// ---- views --------------------------------------------------------------------------
function showView(v) {
  for (const id of ["view-list", "view-edit", "view-panel"]) $("#" + id).hidden = id !== "view-" + v;
  $("#tools").hidden = v !== "edit"; $("#ribbon").hidden = v !== "edit"; $("#nav-crumb").hidden = v !== "edit";
  for (const [id, on] of [["nav-list", v === "list"], ["nav-panel", v === "panel"]]) { $("#" + id).classList.toggle("active", on); if (on) $("#" + id).setAttribute("aria-current", "page"); else $("#" + id).removeAttribute("aria-current"); }
}
const artItem = (a) => `<li class="art border-bottom border-strong" data-path="${esc(a.path)}" ${a.error ? `data-error="${esc(a.error)}"` : ""}>
    ${a.hero ? `<img class="art-thumb" src="${esc(a.hero)}" alt="">` : `<div class="art-thumb"></div>`}
    <div class="min-w-0"><span class="tape tape-secondary mb-2">${esc(a.guia ? "Guía" : (SECTIONS.find((s) => s[0] === a.section) || [, a.section])[1] || "")}</span><h2 class="h3 mb-1">${esc(a.title)}</h2><div class="small-meta">${esc(a.date || "")}</div></div>
    <div class="d-flex flex-wrap gap-2 justify-content-end">${a.error ? `<span class="badge rounded-0 text-bg-danger" title="${esc(a.error)}">Con error</span>` : ""}${a.local ? `<span class="badge rounded-0 text-bg-warning" title="Los cambios están guardados en este navegador. Se suben con «Publicar».">${a.isNew ? "Nuevo, sin publicar" : "Cambios sin publicar"}</span>` : ""}${a.draft && !a.guia ? '<span class="badge rounded-0 text-bg-dark">Borrador</span>' : ""}${a.ai ? '<span class="badge rounded-0 text-bg-dark">Texto con IA</span>' : ""}${a.local && MODE === "web" ? `<button class="btn btn-outline-danger btn-sm" data-discard="${esc(a.path)}">Descartar cambios</button>` : ""}</div></li>`;
async function showList() {
  await save();
  ED.path = null; ED.meta = null; hist = []; fut = [];
  showView("list"); $("#crumb").textContent = "";
  const [list, st] = await Promise.all([api("/api/articles"), api("/api/status")]);
  $("#git-state").textContent = MODE === "web" ? (st.changes ? `${st.changes} artículo${st.changes === 1 ? "" : "s"} con cambios sin publicar en este navegador` : "Todo publicado") : st.ready ? `Rama ${st.branch}${st.changes ? ` · ${st.changes} cambios sin publicar` : ""}` : "El sitio no está listo";
  const arts = list.filter((a) => !a.guia), guides = list.filter((a) => a.guia).sort((a, b) => String(a.path).localeCompare(String(b.path)));
  $("#articles").innerHTML = arts.length ? arts.map(artItem).join("") : '<li class="empty">Todavía no hay artículos. Crea el primero con "Nuevo artículo".</li>';
  $("#guides").innerHTML = guides.map(artItem).join("");
  $("#guides-wrap").hidden = !guides.length;
}
// Older drafts: text boxes had one "tone"; a card's title link was a separate field (now a link inside the title)
function migrate(m) {
  const T = { borde: { fondo: "sin-fondo", marco: true }, acento: { fondo: "gris", linea: "rosa" }, amarillo: { fondo: "amarillo" }, rojo: { fondo: "rojo" }, verde: { fondo: "verde" } };
  for (const b of m.blocks) if (b.type === "callout" && !b.fondo) { Object.assign(b, { fondo: "gris", marco: false, linea: "" }, T[b.tone] || {}); delete b.tone; }
  for (const f of Object.values(m.fichas || {})) if (f.url) { if (f.title && !/\]\(/.test(f.title)) f.title = `[${f.title}](${f.url})`; delete f.url; }
}
async function open(path) {
  const m = await api("/api/article?path=" + encodeURIComponent(path));
  if (Array.isArray(m.meta.route) && m.meta.route.length) {
    m.blocks.unshift({ type: "datos", rows: m.meta.route.map((r) => ({ label: r.label || "", value: [r.value, r.unit].filter(Boolean).join(" ") })) });
    delete m.meta.route; setTimeout(() => { markDirty(); toast("La ficha del recorrido ahora es un bloque «Datos en fila» al inicio del texto: puedes moverlo o repetirlo donde quieras."); }, 300);
  }
  migrate(m);
  Object.assign(ED, { path, meta: m.meta, photos: m.photos, fichas: m.fichas || {}, blocks: m.blocks, problems: m.problems, sel: null, tab: "article", heroV: Date.now() });
  hist = []; fut = []; dirty = false; setState("Guardado"); updateUndo();
  showView("edit"); $("#crumb").textContent = ED.meta.title || "Sin título"; updateCount();
  const w = frame().contentWindow;
  if (w && w.render) refresh(); else frame().addEventListener("load", refresh, { once: true });
  renderInspector();
}
$("#view-list").addEventListener("click", async (e) => {
  const d = e.target.closest("[data-discard]");
  if (d) { e.stopPropagation(); return modal(`<div class="dlg"><h2>Descartar cambios</h2><p>Se borran de este navegador los cambios de «${esc(d.closest(".art").querySelector("h2").textContent)}» que no se han publicado, y sus fotos nuevas. Lo publicado no cambia.</p><div class="acts"><button class="btn btn-outline-dark" id="dc-c">Cancelar</button><button class="btn btn-danger" id="dc-ok">Descartar</button></div></div>`, () => { $("#dc-c").onclick = closeModal; $("#dc-ok").onclick = async () => { await post("/api/discard", { path: d.dataset.discard }); closeModal(); showList(); }; }); }
  const a = e.target.closest(".art"); if (a && a.dataset.error) return toast(a.dataset.error, true, 9000); if (a) open(a.dataset.path).catch((er) => toast(er.message, true)); });
$("#go-list").onclick = $("#nav-list").onclick = (e) => { e.preventDefault(); showList().catch((er) => toast(er.message, true)); };
frame().addEventListener("load", () => { if (ED.meta) refresh(); });

$("#new").onclick = () => modal(`<div class="dlg"><h2>Nuevo artículo</h2>
  <div><label class="form-label" for="n-title">Título</label><input class="form-control" type="text" id="n-title" placeholder="Por ejemplo: Tres días en Big Bend"></div>
  <div><label class="form-label" for="n-sec">Sección</label><select class="form-select" id="n-sec">${SECTIONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
  <div class="acts"><button class="btn btn-outline-dark rounded-0" id="n-cancel">Cancelar</button><button class="btn btn-primary rounded-0" id="n-ok">Crear</button></div></div>`, (m) => {
  $("#n-title").focus(); $("#n-cancel").onclick = closeModal;
  const go = async () => { const title = $("#n-title").value.trim(); if (!title) return $("#n-title").focus();
    try { const r = await post("/api/new", { title, section: $("#n-sec").value }); closeModal(); await open(r.path); } catch (e) { toast(e.message, true); } };
  $("#n-ok").onclick = go; $("#n-title").onkeydown = (e) => { if (e.key === "Enter") go(); };
});
$("#sync").onclick = async () => { try { setBusy("#sync", true); await post("/api/sync", {}); toast("Listo: el sitio está al día con GitHub."); await showList(); } catch (e) { toast(e.message, true, 9000); } setBusy("#sync", false); };
const setBusy = (sel, b) => { const el = $(sel); el.disabled = b; };

// ---- device toggle ---------------------------------------------------------------------
function setDevice(d) { device = d; $("#stage").classList.toggle("is-phone", d === "phone"); $("#dev-phone").classList.toggle("active", d === "phone"); $("#dev-desktop").classList.toggle("active", d === "desktop"); setTimeout(() => frame().contentWindow.render && frame().contentWindow.render(), 60); }
$("#dev-desktop").onclick = () => setDevice("desktop"); $("#dev-phone").onclick = () => setDevice("phone"); setDevice("desktop");
$("#undo").onclick = undo; $("#redo").onclick = redo;

// ---- Buscar y reemplazar (Ctrl+H) -------------------------------------------------------------
function textSlots() {   // every piece of article text the writer typed: [object, key]
  const out = [[ED.meta, "title"], [ED.meta, "subtitle"]];
  for (const b of ED.blocks) {
    if (b.items) b.items.forEach((_, k) => out.push([b.items, k]));
    for (const k of ["text", "title", "by", "caption"]) if (typeof b[k] === "string" && b.type !== "raw") out.push([b, k]);
  }
  for (const p of Object.values(ED.photos)) { if (p.caption) out.push([p, "caption"]); if (p.alt) out.push([p, "alt"]); }
  return out.filter(([o, k]) => typeof o[k] === "string");
}
function findReplace() {
  modal(`<div class="dlg"><h2>Buscar y reemplazar</h2>
  <div><label class="form-label" for="fr-a">Buscar</label><input class="form-control" type="text" id="fr-a"></div>
  <div><label class="form-label" for="fr-b">Reemplazar con</label><input class="form-control" type="text" id="fr-b"></div>
  <div class="form-check"><input class="form-check-input" type="checkbox" id="fr-case"><label class="form-check-label" for="fr-case">Distinguir mayúsculas y minúsculas</label></div>
  <div class="form-check"><input class="form-check-input" type="checkbox" id="fr-word"><label class="form-check-label" for="fr-word">Solo palabras completas</label></div>
  <p class="hint" id="fr-n">Escribe lo que buscas.</p>
  <div class="acts"><button class="btn btn-outline-dark" id="fr-c">Cerrar</button><button class="btn btn-primary" id="fr-ok" disabled>Reemplazar todo</button></div></div>`, () => {
    const rx = () => { const a = $("#fr-a").value; if (!a) return null; const e = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp($("#fr-word").checked ? `(?<![\\p{L}\\p{N}])${e}(?![\\p{L}\\p{N}])` : e, "gu" + ($("#fr-case").checked ? "" : "i")); };
    const count = () => { const r = rx(); if (!r) { $("#fr-n").textContent = "Escribe lo que buscas."; $("#fr-ok").disabled = true; return 0; } const n = textSlots().reduce((a, [o, k]) => a + (o[k].match(r) || []).length, 0); $("#fr-n").textContent = n ? `${n} coincidencia${n === 1 ? "" : "s"} en el artículo.` : "No hay coincidencias."; $("#fr-ok").disabled = !n; return n; };
    ["fr-a", "fr-case", "fr-word"].forEach((id) => $("#" + id).addEventListener("input", count));
    $("#fr-a").focus(); $("#fr-c").onclick = closeModal;
    $("#fr-ok").onclick = () => { const r = rx(), n = count(); if (!n) return; const to = $("#fr-b").value; mutate(() => { for (const [o, k] of textSlots()) o[k] = o[k].replace(r, to); }); closeModal(); toast(`Listo: ${n} reemplazo${n === 1 ? "" : "s"}. Ctrl+Z lo deshace.`); };
  });
}
function shortcutsHelp() {
  const rows = [["Ctrl + B", "Negrita"], ["Ctrl + I", "Cursiva"], ["Ctrl + K", "Enlace"], ["Ctrl + Alt + 1", "Título"], ["Ctrl + Alt + 2", "Subtítulo"], ["Ctrl + Shift + N", "Párrafo normal"],
    ["Ctrl + Shift + L", "Lista con viñetas"], ["Ctrl + E / Ctrl + L", "Centrar / alinear a la izquierda"], ["Ctrl + Z / Ctrl + Y", "Deshacer / rehacer"], ["Ctrl + H", "Buscar y reemplazar"], ["Ctrl + S", "Guardar ahora"],
    ["Enter", "Párrafo nuevo (en una lista: otro punto)"], ["Shift + Enter", "Salto de línea dentro del párrafo"], ["Backspace al inicio", "Une con el bloque de arriba"], ["Supr al final", "Une con el bloque de abajo"],
    ["Flechas", "Pasan de un bloque a otro como en Word"], ["«- » o «1. » al empezar", "Crea una lista"], ["«## » / «### »", "Título / subtítulo"], ["«> »", "Cita destacada"], ["«---» + Enter", "Línea separadora"]];
  modal(`<div class="dlg"><h2>Atajos de teclado</h2><table class="table table-sm mb-0 font-ui"><tbody>${rows.map(([k, v]) => `<tr><th class="text-nowrap pe-3">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table><p class="hint">Pegar desde Word o Google Docs conserva títulos, listas, negritas, cursivas y enlaces. Pegar una imagen la agrega como foto.</p><div class="acts"><button class="btn btn-primary" id="sh-ok">Entendido</button></div></div>`, () => { $("#sh-ok").onclick = closeModal; });
}

// ---- ribbon (Word-style bar) ----------------------------------------------------------------
function ribbonCmd(cmd) {
  const i = lastCaret ?? ED.sel?.i, b = i != null ? ED.blocks[i] : null;
  if (cmd === "bold" || cmd === "italic") return wrapSelection(cmd === "bold" ? "**" : "*");
  if (cmd === "link") return linkSelection();
  if (cmd === "unlink") { if (!cdoc().defaultView.formatText("unlink")) toast("Pon el cursor dentro del enlace primero.", true); return; }
  if (cmd === "find") return findReplace();
  if (cmd === "help") return shortcutsHelp();
  if (cmd === "left" || cmd === "center") {
    if (!b || !["p", "h2", "h3", "button"].includes(b.type)) return toast("La alineación es para párrafos, títulos y botones.", true);
    return mutate(() => { if (cmd === "center") b.align = "center"; else delete b.align; ED.focus = { i }; });
  }
  if (!b || !TEXTY.includes(b.type)) return toast("Haz clic primero en un párrafo del artículo.", true);
  if (cmd === "ul" || cmd === "ol") return convertBlock(i, b.type === cmd ? "p" : cmd);
  convertBlock(i, cmd);
}
$("#ribbon").addEventListener("mousedown", (e) => { if (e.target.closest(".rb-fmt, #rb-insert, .rb-menu button")) e.preventDefault(); });   // keep the cursor in the page
$("#ribbon").addEventListener("click", (e) => {
  const f = e.target.closest("[data-rb]"); if (f) return ribbonCmd(f.dataset.rb);
  if (e.target.closest("#rb-insert")) {
    const m = $("#rb-menu"); m.hidden = !m.hidden; $("#rb-insert").setAttribute("aria-expanded", String(!m.hidden));
    if (!m.hidden) m.innerHTML = INSERT_MENU.map(([k, l]) => (k ? `<button data-ins="${k}">${l}</button>` : `<h6>${l}</h6>`)).join("");
    return;
  }
  const ins = e.target.closest("[data-ins]"); if (ins) { $("#rb-menu").hidden = true; insertAfterCurrent(ins.dataset.ins); }
});
document.addEventListener("click", (e) => { if (!e.target.closest(".dropdown-host")) $("#rb-menu").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#rb-menu").hidden = true; });
$("#rb-style").addEventListener("change", (e) => { const i = lastCaret ?? ED.sel?.i; if (i != null && e.target.value) convertBlock(i, e.target.value); });

// ---- uploads ---------------------------------------------------------------------------
function pickFiles(multiple) {
  return new Promise((res) => { const f = $("#file"); f.multiple = !!multiple; f.value = ""; f.onchange = () => res([...f.files]); f.click(); });
}
async function upload(file, kind = "photo", pos) {
  const q = new URLSearchParams({ article: ED.path, name: file.name, kind }); if (pos) q.set("pos", pos);
  return api("/api/photo?" + q, { method: "POST", body: file });
}
async function newPhoto(file) {
  const r = await upload(file);
  const photo = { file: r.file, w: r.w, h: r.h, alt: "", caption: "" };
  if (r.w / r.h > 2.2) photo.focus = 50;
  return { id: r.file, photo, pano: r.w / r.h > 2.2 };
}
async function addPhotos(files, at, as) {
  if (!files.length) return;
  toast(`Procesando ${files.length} foto${files.length > 1 ? "s" : ""}…`, false, 2500);
  const made = [];
  try { for (const f of files) made.push(await newPhoto(f)); } catch (e) { toast("No se pudo procesar la foto: " + e.message, true, 9000); if (!made.length) return; }
  mutate(() => {
    for (const m of made) ED.photos[m.id] = m.photo;
    let blocks;
    if (as === "fila" && made.length > 1) blocks = [{ type: "fila", ids: made.map((m) => m.id) }];
    else if (as === "pano") blocks = made.map((m) => ({ type: "pano", id: m.id, mode: "" }));
    else blocks = made.map((m) => (m.pano ? { type: "pano", id: m.id, mode: "" } : { type: "foto", id: m.id }));
    ED.blocks.splice(at, 0, ...blocks);
    ED.sel = { i: at, id: null }; ED.tab = "block";
  });
  toast("Foto agregada. Escribe su texto alternativo en el panel de la derecha.");
}

// ---- actions called by the canvas -----------------------------------------------------------
const textTypes = ["p", "h2", "h3", "quote"];
const TEXTY = ["p", "h2", "h3", "quote", "ul", "ol", "callout"];          // blocks the ribbon's "Estilo" can turn into each other
let lastCaret = null, heroTimer = null;                                                   // block where the cursor was last
const BLOCK_DEFAULTS = {
  ul: () => ({ type: "ul", items: [""] }), ol: () => ({ type: "ol", items: [""] }),
  callout: () => ({ type: "callout", fondo: "gris", marco: false, linea: "", text: "" }), details: () => ({ type: "details", title: "", text: "" }),
  hr: () => ({ type: "hr" }), space: () => ({ type: "space", size: 3 }),
  datos: () => ({ type: "datos", rows: [{ label: "Lugar", value: "" }, { label: "Distancia", value: "" }, { label: "Desnivel", value: "" }, { label: "Dificultad", value: "" }] }),
  button: () => ({ type: "button", text: "", url: "", style: "primario" }), video: () => ({ type: "video", id: "", caption: "" }),
  raw: () => ({ type: "raw", text: "<!-- Escribe aquí el código HTML -->" }),
  map: () => ({ type: "map", coords: "", label: "", zoom: "11" }),
};
const textOf = (b) => (b.type === "ul" || b.type === "ol" ? (b.items || []).join("\n\n") : b.text || "");
// Turn a block into another text style (Word's style box). Several paragraphs become several blocks or list items.
function convertBlock(i, type) {
  const b = ED.blocks[i]; if (!b || b.type === type || !TEXTY.includes(b.type)) return;
  const paras = textOf(b).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  let out;
  if (type === "ul" || type === "ol") out = [{ type, items: paras.length ? paras : [""] }];
  else if (type === "callout") out = [{ type, fondo: "gris", marco: false, linea: "", text: paras.join("\n\n") }];
  else out = (paras.length ? paras : [""]).map((t) => ({ type, text: t, ...(b.align && ["p", "h2", "h3"].includes(type) ? { align: b.align } : {}) }));
  if (b.box && type !== "quote") out.forEach((x) => { x.box = { ...b.box }; });
  mutate(() => { ED.blocks.splice(i, 1, ...out); ED.sel = { i }; ED.focus = { i }; lastCaret = i; });
}
function countWords() {
  let n = 0; const add = (t) => { const w = String(t || "").replace(/[*_#>\[\]()`]/g, " ").replace(/https?:\/\/\S+/g, " ").trim(); if (w) n += w.split(/\s+/).length; };
  add(ED.meta?.title); add(ED.meta?.subtitle);
  for (const b of ED.blocks) { if (b.items) b.items.forEach(add); else { add(b.text); add(b.title); } }
  return n;
}
function updateCount() { if (!ED.meta) return; const n = countWords(); $("#rb-count").textContent = `${n.toLocaleString("es")} palabras · ${Math.max(1, Math.round(n / 220))} min de lectura`; }
function updateRibbon() {
  const i = lastCaret ?? ED.sel?.i, b = i != null ? ED.blocks[i] : null;
  const sel = $("#rb-style"); sel.value = b && TEXTY.includes(b.type) ? b.type : "";
  sel.disabled = !(b && TEXTY.includes(b.type));
  $('[data-rb="center"]').classList.toggle("active", b?.align === "center"); $('[data-rb="left"]').classList.toggle("active", !!b && ["p", "h2", "h3", "button"].includes(b.type) && b.align !== "center");
}
function insertAfterCurrent(type) { const i = lastCaret ?? ED.sel?.i; act.add(type, i == null ? ED.blocks.length : i + 1); }
window.act = {
  caretIn(i) { if (i === lastCaret && ED.sel?.i === i) return; lastCaret = i; if (ED.sel?.i !== i) { ED.sel = { i }; ED.tab = "block"; highlight(); renderInspector(); } updateRibbon(); },
  setField(i, key, value, rerender) {
    mutate(() => {
      const ks = String(key).split("."); let o = ED.blocks[i]; while (ks.length > 1) o = o[ks.shift()];
      const k = ks[0]; if (Array.isArray(o) || typeof o[k] === "number" || (value !== "" && value != null)) o[k] = value; else delete o[k];
    }, { typing: !rerender });
  },
  setItems(i, items) { mutate(() => { ED.blocks[i].items = items; }, { typing: true }); },
  listExit(i, n) {   // Enter on an empty bullet: leave the list (Word does the same)
    mutate(() => {
      const b = ED.blocks[i], before = b.items.slice(0, n), after = b.items.slice(n + 1);
      const out = []; if (before.length) out.push({ type: b.type, items: before });
      out.push({ type: "p", text: "" }); if (after.length) out.push({ type: b.type, items: after });
      ED.blocks.splice(i, 1, ...out); const at = i + (before.length ? 1 : 0); ED.sel = { i: at }; ED.focus = { i: at, caret: 0 }; lastCaret = at;
    });
  },
  listUnwrapFirst(i) {   // Backspace at the start of the first bullet: that line becomes a normal paragraph
    mutate(() => {
      const b = ED.blocks[i], [first, ...rest] = b.items;
      ED.blocks.splice(i, 1, { type: "p", text: first || "" }, ...(rest.length ? [{ type: b.type, items: rest }] : []));
      ED.sel = { i }; ED.focus = { i, caret: 0 }; lastCaret = i;
    });
  },
  autoformat(i, type, rest) {
    mutate(() => {
      const nb = type === "ul" || type === "ol" ? { type, items: [rest] } : { type, text: rest };
      ED.blocks.splice(i, 1, nb); ED.sel = { i }; ED.focus = { i, caret: 0, li: 0 }; lastCaret = i;
    });
  },
  ribbon(cmd) { ribbonCmd(cmd); },
  saveNow() { save(); },
  continueAtEnd() {   // click under the last block, like in Word: write at the end
    const n = ED.blocks.length, last = ED.blocks[n - 1];
    if (last && last.type === "p" && !last.text.trim()) { ED.focus = { i: n - 1 }; frame().contentWindow.render(); return; }
    mutate(() => { ED.blocks.push({ type: "p", text: "" }); ED.sel = { i: n }; ED.focus = { i: n, caret: 0 }; lastCaret = n; });
  },
  toRule(i) { mutate(() => { ED.blocks.splice(i, 1, { type: "hr" }, { type: "p", text: "" }); ED.sel = { i: i + 1 }; ED.focus = { i: i + 1, caret: 0 }; lastCaret = i + 1; }); },
  selState(st) { for (const k of ["bold", "italic", "link"]) $(`[data-rb="${k}"]`)?.classList.toggle("active", !!st[k]); },
  select(i, id = null) {
    ED.sel = i === null ? null : { i, id };
    if (i === null) { if (ED.tab === "block") ED.tab = "article"; } else { ED.tab = "block"; lastCaret = i; }
    highlight(); renderInspector(); updateRibbon();
  },
  setText(i, text) { mutate(() => { ED.blocks[i].text = text; }, { typing: true }); },
  setMeta(path, value, typing) { mutate(() => setPath(ED.meta, path, value), { typing }); if (typing) $("#crumb").textContent = ED.meta.title || "Sin título"; },
  setPhoto(id, patch, typing, rerender) {
    mutate(() => {
      const p = ED.photos[id]; if (!p) return;
      for (const [k, v] of Object.entries(patch)) { if (v === 0 || v === "" || v === undefined) delete p[k]; else p[k] = v; }
      if ("alt" in patch || "caption" in patch) { }
    }, { typing: typing && !rerender });
    if (typing) renderInspectorSoft();
  },
  setRatios(map) { mutate(() => { for (const [id, r] of Object.entries(map)) if (ED.photos[id]) ED.photos[id].ratio = r; }); },
  add(type, at) {
    if (type === "ficha") {
      mutate(() => {
        let n = 1; while (ED.fichas["ficha-" + n]) n++;
        const id = "ficha-" + n;
        ED.fichas[id] = { title: "Datos", tone: "gris", format: "lista", rows: [{ label: "Dato", value: "Valor" }] };
        ED.blocks.splice(at, 0, { type: "ficha", id, wrap: { side: "right", size: 40, hang: true } });
        ED.sel = { i: at }; ED.tab = "block";
      });
    } else if (textTypes.includes(type)) {
      mutate(() => { ED.blocks.splice(at, 0, { type, text: "" }); ED.focus = { i: at, caret: 0 }; ED.sel = { i: at }; ED.tab = "block"; lastCaret = at; });
    } else if (BLOCK_DEFAULTS[type]) {
      mutate(() => {
        ED.blocks.splice(at, 0, BLOCK_DEFAULTS[type]()); ED.sel = { i: at }; ED.tab = "block"; lastCaret = at;
        if (["ul", "ol", "callout", "details", "button"].includes(type)) ED.focus = { i: at, caret: 0, field: type === "details" || type === "button" };
      });
    } else if (type === "foto") pickFiles(true).then((f) => addPhotos(f, at));
    else if (type === "fila") pickFiles(true).then((f) => f.length < 2 ? toast("Elige dos o más fotos para la fila.", true) : addPhotos(f, at, "fila"));
    else if (type === "pano") pickFiles(true).then((f) => addPhotos(f, at, "pano"));
  },
  dropFiles(files, at) { addPhotos(files, at); },
  tool(a, i) {
    mutate(() => {
      const b = ED.blocks;
      if (a === "up" && i > 0) { [b[i - 1], b[i]] = [b[i], b[i - 1]]; ED.sel = { i: i - 1, id: ED.sel?.id }; }
      else if (a === "down" && i < b.length - 1) { [b[i + 1], b[i]] = [b[i], b[i + 1]]; ED.sel = { i: i + 1, id: ED.sel?.id }; }
      else if (a === "dup") { b.splice(i + 1, 0, JSON.parse(JSON.stringify(b[i]))); ED.sel = { i: i + 1 }; }
      else if (a === "del") { b.splice(i, 1); ED.sel = null; if (!b.length) b.push({ type: "p", text: "" }); }
    });
  },
  focusArticle(k) {   // the byline in the page: author and date are edited in the Artículo tab
    ED.tab = "article"; renderInspector(); const el = $(`#insp [data-k="${k}"]`); if (el) { el.scrollIntoView({ block: "center" }); el.focus(); }
    toast("El autor y la fecha se cambian aquí, en la pestaña Artículo. El tiempo de lectura se calcula solo.");
  },
  setPhotoFrame(i, { ratio, size, box }) {   // a photo resized by its handles: crop shape, floating width, free width
    mutate(() => {
      const b = ED.blocks[i], p = ED.photos[b.id];
      if (ratio && p) p.ratio = ratio;
      if (size && b.wrap) b.wrap.size = size;
      if (box === null) delete b.box; else if (box) b.box = box;
      ED.sel = { i };
    });
  },
  setBox(i, box) { mutate(() => { if (box) ED.blocks[i].box = box; else delete ED.blocks[i].box; ED.sel = { i }; }); },
  cycleLine(i) {   // rosa -> amarillo -> verde -> rojo -> sin línea -> rosa…
    const order = ["rosa", "amarillo", "verde", "rojo", ""];
    mutate(() => { const b = ED.blocks[i]; b.linea = order[(order.indexOf(b.linea || "") + 1) % order.length]; ED.sel = { i }; ED.tab = "block"; });
  },
  setFicha(id, path, value) {
    mutate(() => { const ks = path.split("."); let o = ED.fichas[id]; while (ks.length > 1) o = o[ks.shift()]; if (!value && ks[0] === "title") delete o.title; else o[ks[0]] = value; }, { typing: true });
  },
  moveTo(from, at) {
    mutate(() => { const [x] = ED.blocks.splice(from, 1); const to = at > from ? at - 1 : at; ED.blocks.splice(to, 0, x); ED.sel = { i: to }; });
  },
  split(i, before, after) {
    mutate(() => {
      const b = ED.blocks[i];
      b.text = before.trimEnd();
      const keep = b.type === "p" ? "p" : "p";
      ED.blocks.splice(i + 1, 0, { type: keep, text: after.trimStart(), ...(b.box ? { box: { ...b.box } } : {}) });   // like Word: the new paragraph keeps the width
      ED.focus = { i: i + 1, caret: 0 }; ED.sel = { i: i + 1 };
    });
  },
  mergePrev(i) {
    const prev = ED.blocks[i - 1], cur = ED.blocks[i];
    if (prev && cur && (prev.type === "ul" || prev.type === "ol") && textTypes.includes(cur.type)) {
      mutate(() => { const k = prev.items.length - 1; const caret = cdoc().defaultView.plainLen(prev.items[k] || ""); prev.items[k] = (prev.items[k] || "") + (prev.items[k] && cur.text ? " " : "") + cur.text; ED.blocks.splice(i, 1); ED.focus = { i: i - 1, caret, li: k }; ED.sel = { i: i - 1 }; lastCaret = i - 1; });
      return true;
    }
    if (!prev || !cur || !textTypes.includes(prev.type) || !textTypes.includes(cur.type)) return false;
    mutate(() => { const caret = cdoc().defaultView.plainLen(prev.text); prev.text = prev.text + (prev.text && cur.text ? " " : "") + cur.text; ED.blocks.splice(i, 1); ED.focus = { i: i - 1, caret }; ED.sel = { i: i - 1 }; });
    return true;
  },
  pasteMany(i, head, tail, text) {
    mutate(() => {
      const b = ED.blocks[i]; const parts = text.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      b.text = (head + parts[0]).trim();
      const rest = parts.slice(1).map((t) => ({ type: "p", text: t }));
      if (rest.length) rest[rest.length - 1].text += tail; else b.text += tail;
      ED.blocks.splice(i + 1, 0, ...rest); ED.sel = { i: i + rest.length };
    });
  },
  pasteBlocks(i, head, tail, blocks) {   // paste from Word / Google Docs / the web: titles, lists, bold and links survive
    mutate(() => {
      const b = ED.blocks[i]; const rest = blocks.map((x) => ({ ...x }));
      if (rest[0] && rest[0].type === "p" && textTypes.includes(b.type)) { b.text = (head + rest.shift().text).trim(); }
      else b.text = head.trim();
      const last = rest[rest.length - 1];
      if (tail.trim()) { if (!last) b.text = (b.text + tail).trim(); else if (textTypes.includes(last.type)) last.text = (last.text + tail).trimEnd(); else rest.push({ type: "p", text: tail.trim() }); }
      let at = i + 1;
      ED.blocks.splice(at, 0, ...rest);
      if (!b.text && b.type === "p" && rest.length) { ED.blocks.splice(i, 1); at = i; }
      const end = at + rest.length - 1; ED.sel = { i: Math.max(i, end) }; ED.focus = { i: Math.max(i, end) }; lastCaret = Math.max(i, end);
    });
    toast(`Pegado: ${blocks.length} bloque${blocks.length === 1 ? "" : "s"} con su formato.`);
  },
  wrap(mark) { wrapSelection(mark); },
  setWrapMode(i, side, mode) {
    mutate(() => { const w = ED.blocks[i].wrap = { side, size: ED.blocks[i].wrap?.size || 40, hang: mode === "hang" }; if (mode === "edge") w.edge = true; });
  },
  pickHero() { pickFiles(false).then((f) => f[0] && setHeroFile(f[0])); },
  setHeroFile(f) { setHeroFile(f); },
  // Framing the cover: the page shows the change at once; the 16:9 files are cut again a moment after the last change
  setHeroPos(pos, zoom, live) {   // live: while dragging the slider, move the photo without redrawing the page
    mutate(() => { const h = ED.meta.hero; h.pos = pos; if (zoom != null) { if (zoom > 1) h.zoom = zoom; else delete h.zoom; } }, { typing: !!live });
    if (live) { const w = frame().contentWindow; w.layoutHero && w.layoutHero(); }
    clearTimeout(heroTimer);
    heroTimer = setTimeout(async () => { const h = ED.meta.hero; try { await post("/api/hero-pos?" + new URLSearchParams({ article: ED.path, pos: h.pos || "50% 50%", zoom: h.zoom || 1 }), {}); } catch (e) { toast(e.message, true); } }, 700);
  },
  undoKey(e) { e.key.toLowerCase() === "z" && !e.shiftKey ? undo() : redo(); },
};
async function setHeroFile(file) {
  toast("Procesando la foto principal…", false, 2500);
  try {
    const r = await upload(file, "hero", "50% 50%");
    mutate(() => { ED.meta.hero = { ...(ED.meta.hero || {}), file: r.file, w: r.w, h: r.h, srcW: r.srcW, srcH: r.srcH, pos: r.pos, alt: ED.meta.hero?.alt || "", caption: ED.meta.hero?.caption || "" }; delete ED.meta.hero.zoom; ED.heroV = Date.now(); ED.tab = "article"; });
    toast("Foto principal lista. Arrástrala para encuadrarla.");
  } catch (e) { toast("No se pudo procesar: " + e.message, true, 9000); }
}
function setPath(o, path, v) { const k = path.split("."); let c = o; while (k.length > 1) { const n = k.shift(); c[n] = c[n] || {}; c = c[n]; } if (v === "" || v === undefined) delete c[k[0]]; else c[k[0]] = v; if (path === "youtube" && v) c.youtube = ytId(v); }
// "…google.com/maps/place/…/@30.42,-101.17,13z…", "…!3d30.42!4d-101.17…" or "30.42, -101.17" -> "30.42000,-101.17000"
const coordsOf = (v) => {
  const s = String(v); const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? `${Number(m[1]).toFixed(5)},${Number(m[2]).toFixed(5)}` : s.trim();
};
const ytId = (v) => { const m = String(v).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : String(v).trim(); };

function wrapSelection(mark) {
  const w = cdoc().defaultView;
  if (w.plainField) return toast(w.plainField, true);
  if (!w.hasTextSelection()) return toast("Selecciona primero el texto en la página.", true);
  w.formatText(mark === "**" ? "bold" : "italic");
}
function linkSelection() {
  const w = cdoc().defaultView;
  if (w.plainField) return toast(w.plainField, true);
  const current = w.linkAt();
  if (current === null && !w.hasTextSelection()) return toast("Selecciona primero el texto del enlace en la página.", true);
  modal(`<div class="dlg"><h2>Enlace</h2><div><label class="form-label" for="l-url">Dirección</label><input class="form-control" type="text" id="l-url" placeholder="https://" value="${esc(current || "")}"></div><div class="acts"><button class="btn btn-outline-dark rounded-0" id="l-c">Cancelar</button><button class="btn btn-primary rounded-0" id="l-ok">Poner enlace</button></div></div>`, () => {
    $("#l-url").focus(); $("#l-c").onclick = closeModal;
    const ok = () => { let u = $("#l-url").value.trim(); if (!u) return; if (!/^(https?:|mailto:|\/)/.test(u)) u = "https://" + u; closeModal();
      w.formatText("createLink", u); };
    $("#l-ok").onclick = ok; $("#l-url").onkeydown = (e) => { if (e.key === "Enter") ok(); };
  });
}

// ---- inspector --------------------------------------------------------------------------
function usedIds() { return new Set(ED.blocks.flatMap((b) => (b.type === "foto" || b.type === "pano" ? [b.id] : b.type === "fila" ? b.ids : b.type === "ficha" && ED.fichas[b.id]?.photo ? [ED.fichas[b.id].photo] : []))); }
function renderInspectorSoft() { /* alt text changed: refresh the red "falta alt" tags without stealing focus */ const w = frame().contentWindow; const a = document.activeElement; w.render && w.render(); a && a.focus && a.focus(); }
function renderInspector() {
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
  if (k.startsWith("m.")) { const v = t.type === "checkbox" ? t.checked : t.value; act.setMeta(k.slice(2), v || undefined, t.type !== "checkbox"); if (k === "m.description") $("#desc-n").textContent = t.value.length; if (k === "m.date" || k === "m.author") { const w = frame().contentWindow; w.render && w.render(); } if (t.type === "checkbox") renderInspector(); }
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
function editList(k, v) {
  const [kind, idx, f] = k.split(".");
  mutate(() => {
    if (kind === "route") { ED.meta.route = ED.meta.route || []; ED.meta.route[idx] = ED.meta.route[idx] || { label: "", value: "" }; ED.meta.route[idx][f] = v; }
    else { ED.meta.sources = ED.meta.sources || []; ED.meta.sources[idx] = v; }
  }, { typing: true });
}
function doAction(a, d) {
  const sel = ED.sel; const bl = sel ? ED.blocks[sel.i] : null;
  switch (a) {
    case "bold": return wrapSelection("**");
    case "italic": return wrapSelection("*");
    case "link": return linkSelection();
    case "unlink": { const w = cdoc().defaultView; if (!w.formatText("unlink")) toast("Pon el cursor dentro del enlace primero.", true); return; }
    case "ratio": return act.setPhoto(d.id, { ratio: Number(d.v) }, false, true);
    case "pos0": return act.setPhoto(d.id, { pos: "" }, false, true);
    case "pick-item": ED.sel = { i: sel.i, id: d.id }; highlight(); return renderInspector();
    case "join": return mutate(() => { const nx = ED.blocks[sel.i + 1]; const tA = bl.type === "foto" ? [bl.id] : treeOf(bl), tB = nx.type === "foto" ? [nx.id] : treeOf(nx); const nb = { type: "fila", ids: [] }; setTree(nb, [...tA, ...tB]); ED.blocks.splice(sel.i, 2, nb); ED.sel = { i: sel.i }; });
    case "stack": return stackWith(bl, ED.sel.id && bl.ids.includes(ED.sel.id) ? ED.sel.id : bl.ids[0], Number(d.dir));
    case "ungroup": return ungroup(bl, ED.sel.id && bl.ids.includes(ED.sel.id) ? ED.sel.id : bl.ids[0]);
    case "grid": return makeGrid(bl, Number($("#grid-cols").value));
    case "ungrid": return mutate(() => { delete bl.tree; });
    case "split-row": return mutate(() => { ED.blocks.splice(sel.i, 1, ...bl.ids.map((id) => ({ type: "foto", id }))); ED.sel = { i: sel.i }; });
    case "out-row": return mutate(() => { const t = treeOf(bl), pa = pathOf(t, d.id); arrAt(t, pa).splice(pa[pa.length - 1], 1); setTree(bl, t); const nb = { type: "foto", id: d.id }; if (bl.ids.length === 1) ED.blocks.splice(sel.i, 1, { type: "foto", id: bl.ids[0] }, nb); else ED.blocks.splice(sel.i + 1, 0, nb); ED.sel = null; });
    case "row-add": return pickFiles(true).then(async (files) => { if (!files.length) return; const made = []; for (const f of files) made.push(await newPhoto(f)); mutate(() => { const t = treeOf(bl); for (const m of made) { ED.photos[m.id] = m.photo; t.push(m.id); } setTree(bl, t); }); });
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
// ---- photo rows and grids: b.ids = every photo; b.tree (only when nested) = the layout, arrays alternate stack / row ----
const treeOf = (b) => JSON.parse(JSON.stringify(b.tree || b.ids));
const flatT = (t) => t.flatMap((c) => (Array.isArray(c) ? flatT(c) : [c]));
function normTree(t) {
  return t.map((c) => (Array.isArray(c) ? normTree(c) : c)).filter((c) => !Array.isArray(c) || c.length > 0).map((c) => (Array.isArray(c) && c.length === 1 && !Array.isArray(c[0]) ? c[0] : c));
}
function setTree(b, t) { t = normTree(t); b.ids = flatT(t); if (t.some(Array.isArray)) b.tree = t; else delete b.tree; }
function pathOf(t, id, path = []) {
  for (let k = 0; k < t.length; k++) { if (t[k] === id) return [...path, k]; if (Array.isArray(t[k])) { const r = pathOf(t[k], id, [...path, k]); if (r) return r; } }
  return null;
}
const arrAt = (t, path) => path.slice(0, -1).reduce((a, k) => a[k], t);
function rOfTree(n, r, depth = 0) {
  if (!Array.isArray(n)) return r(n);
  const rs = n.map((c) => rOfTree(c, r, depth + 1));
  return depth % 2 === 0 ? rs.reduce((a, x) => a + x, 0) : 1 / rs.reduce((a, x) => a + 1 / x, 0);
}
const rowR = (b) => rOfTree(treeOf(b), (id) => ratioOfP(ED.photos[id]));
function stackWith(b, id, dir) {
  const t = treeOf(b), path = pathOf(t, id), arr = arrAt(t, path), idx = path[path.length - 1], j = idx + dir;
  if (j < 0 || j >= arr.length) return toast("No hay otra foto de ese lado.", true);
  const sib = arr[j];
  if (Array.isArray(sib)) { dir > 0 ? sib.unshift(id) : sib.push(id); arr.splice(idx, 1); }
  else arr.splice(Math.min(idx, j), 2, dir > 0 ? [id, sib] : [sib, id]);
  mutate(() => setTree(b, t));
}
function ungroup(b, id) {
  const t = treeOf(b), path = pathOf(t, id); if (path.length < 2) return toast("Esa foto no está en un grupo.", true);
  const arr = arrAt(t, path), parent = arrAt(t, path.slice(0, -1)), at = path[path.length - 2];
  const k = path[path.length - 1]; arr.splice(k, 1); parent.splice(k === 0 ? at : at + 1, 0, id);
  mutate(() => setTree(b, t));
}
function makeGrid(b, cols) {
  const ids = b.ids.slice(); cols = Math.max(1, Math.min(6, Math.round(cols) || 2));
  if (ids.length <= cols) return toast("Hay pocas fotos para ese número de columnas.", true);
  const rows = []; for (let k = 0; k < ids.length; k += cols) rows.push(ids.slice(k, k + cols));
  mutate(() => setTree(b, [rows]));
}
function setRowHeight(alto) {            // alto = height as a percentage of the row width
  const b = ED.blocks[ED.sel.i]; const sum = rowR(b);
  const target = 100 / alto, k = target / sum;
  mutate(() => { for (const id of b.ids) ED.photos[id].ratio = Math.round(Math.max(0.4, Math.min(5, ratioOfP(ED.photos[id]) * k)) * 1000) / 1000; }, { typing: true });
  frame().contentWindow.render && frame().contentWindow.render();
}
const ratioOfP = (p) => (Number(p.ratio) > 0 ? Number(p.ratio) : p.w / p.h);
const fld = (label, html, hint = "") => `<div><label class="form-label">${label}</label>${html}${hint}</div>`;
const inp = (k, v, ph = "", type = "text") => `<input class="form-control" type="${type}" data-k="${k}" value="${esc(v ?? "")}" placeholder="${esc(ph)}">`;

function paneArticle() {
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
<div class="form-check"><input class="form-check-input" type="checkbox" id="c-draft" data-k="m.draft" ${m.draft ? "checked" : ""}><label class="form-check-label" for="c-draft">Borrador (Google no lo indexará)</label></div>
<div class="form-check"><input class="form-check-input" type="checkbox" id="c-ai" data-k="m.ai" ${m.ai ? "checked" : ""}><label class="form-check-label" for="c-ai">Mostrar aviso de texto escrito con IA</label></div>
<hr>${fld("Cabecera", `<select class="form-select" data-k="m.cabecera">${[["", "Foto grande con el título encima"], ["debajo", "Foto grande con el título debajo"], ["titulo", "Título arriba y la foto debajo"], ["texto", "Solo el título, sin foto"]].map(([v, l]) => `<option value="${v}" ${(m.cabecera || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
${hero}<hr>
${fld("Crédito de las fotos", inp("m.credit", m.credit))}
${fld("Autor", inp("m.author", m.author))}
<div><label class="form-label">Fuentes</label>${(m.sources || []).map((s, i) => `<div class="rowpair"><input class="form-control" type="text" data-k="src.${i}" value="${esc(s)}"><button class="btn btn-outline-danger" data-do="src-del" data-i="${i}" aria-label="Quitar">×</button></div>`).join("")}<button class="btn btn-outline-dark" data-do="src-add">Agregar fuente</button></div>`;
}

function photoForm(id) {
  const p = ED.photos[id]; if (!p) return "";
  const cur = Number(p.ratio) > 0 ? Number(p.ratio) : 0;
  return `${fld("Texto alternativo", `<textarea data-k="p.${id}.alt" class="form-control ${p.alt ? "" : "invalid"}" placeholder="Describe lo que se ve en la foto">${esc(p.alt)}</textarea>`, `<p class="hint bad" ${p.alt ? "hidden" : ""}>Obligatorio: sirve para accesibilidad y Google.</p>`)}
<div><label class="form-label">Recorte</label><div class="btnrow">${RATIOS.map(([l, v]) => `<button class="btn btn-outline-dark ${Math.abs(cur - v) < 0.01 ? "active" : ""}" data-do="ratio" data-id="${esc(id)}" data-v="${v}">${l}</button>`).join("")}</div>
<p class="hint">Arrastra la foto para encuadrar. Arrastra la barra inferior para recortar a mano.</p><div class="btnrow"><button class="btn btn-outline-dark" data-do="pos0" data-id="${esc(id)}">Centrar</button></div></div>`;
}

function wrapPane(b) {
  const w = b.wrap && b.wrap.side ? b.wrap : null;
  return `<div><label class="form-label">Ajuste del texto</label><div class="btnrow">
<button class="btn btn-outline-dark ${!w ? "active" : ""}" data-do="wrap-none">En su propia fila</button>
<button class="btn btn-outline-dark ${w && w.side === "left" ? "active" : ""}" data-do="wrap-side" data-side="left">Flotar a la izquierda</button>
<button class="btn btn-outline-dark ${w && w.side === "right" ? "active" : ""}" data-do="wrap-side" data-side="right">Flotar a la derecha</button></div>
${w ? `<div class="btnrow">${[[33, "Pequeño"], [40, "Mediano"], [50, "Grande"]].map(([v, l]) => `<button class="btn btn-outline-dark ${w.size === v ? "active" : ""}" data-do="wrap-size" data-v="${v}">${l}</button>`).join("")}</div><p class="hint">Ancho: ${w.size || 40} % de la columna de texto${w.hang ? " (del ancho de las fotos, porque sobresale)" : ""}.${b.type === "foto" ? " También se cambia arrastrando el cuadrito rosa del lado interior de la foto." : " También se cambia arrastrando la barra rosa de su lado interior."}</p>
<div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="c-hang" data-k="whang" ${w.hang ? "checked" : ""}><label class="form-check-label" for="c-hang">Sobresale hasta el margen exterior</label></div>${b.type === "foto" ? `<div class="form-check"><input class="form-check-input" type="checkbox" id="c-edge" data-k="wedge" ${w.edge ? "checked" : ""}><label class="form-check-label" for="c-edge">Hasta el borde de la pantalla</label></div><p class="hint">También puedes arrastrar la barra rosa del lado de la foto hacia el borde de la pantalla.</p>` : ""}` : ""}
<p class="hint">Como el "Cuadrado" de Word: el texto rodea el elemento y después vuelve a todo el ancho. Los títulos y las fotos grandes siempre empiezan debajo. En celular cada elemento ocupa su propia fila.</p></div>`;
}
function fichaPane(b) {
  const f = ED.fichas[b.id]; if (!f) return "";
  const ph = f.photo && ED.photos[f.photo];
  return `<div><label class="form-label">Datos</label>${rowList(f.rows, "frow-del")}<button class="btn btn-outline-dark" data-do="frow-add">Agregar dato</button><p class="hint">El título y los datos se escriben directamente en la ficha. Para enlazar el título, selecciónalo y usa el botón de enlace de la barra de arriba.</p></div>
${fld("Formato", `<select class="form-select" data-k="f.${b.id}.format"><option value="lista" ${f.format !== "tabla" ? "selected" : ""}>Lista (Dato: valor)</option><option value="tabla" ${f.format === "tabla" ? "selected" : ""}>Tabla de dos columnas</option></select>`)}
${fld("Color", `<select class="form-select" data-k="f.${b.id}.tone">${[["gris", "Gris"], ["sin fondo", "Sin fondo"], ["amarillo", "Amarillo (advertencia)"], ["rojo", "Rojo (importante)"], ["verde", "Verde (llamar la atención)"]].map(([v, l]) => `<option value="${v}" ${(f.tone || "gris") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
<div><label class="form-label">Foto de la ficha (opcional)</label><div class="btnrow"><button class="btn btn-outline-dark" data-do="fphoto">${ph ? "Cambiar foto" : "Agregar foto"}</button>${ph ? '<button class="btn btn-outline-danger" data-do="fphoto-del">Quitar foto</button>' : ""}</div></div>
${ph ? photoForm(f.photo) : ""}`;
}
// Rows of a card or a facts row: the text is written on the page; here you only add or remove rows
const plainMd = (t) => String(t || "").replace(/\*+/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
const rowList = (rows, del) => `<ul class="list-unstyled mb-2">${(rows || []).map((r, i) => `<li class="rowpair single"><span class="flex-grow-1 text-truncate">${esc(plainMd(r.label) || "Dato")} · <span class="text-secondary">${esc(plainMd(r.value) || "sin valor")}</span></span><button class="btn btn-outline-danger" data-do="${del}" data-i="${i}" aria-label="Quitar este dato" title="Quitar este dato">×</button></li>`).join("")}</ul>`;
const STYLE_NAMES = [["p", "Párrafo"], ["h2", "Título"], ["h3", "Subtítulo"], ["ul", "Lista con viñetas"], ["ol", "Lista numerada"], ["quote", "Cita destacada"], ["callout", "Recuadro de texto"]];
// Text box: background, frame and line are independent; none of them moves the text
function calloutPane(b) {
  const L = { rosa: "Rosa", amarillo: "Amarilla", verde: "Verde", rojo: "Roja", "": "Sin línea" };
  return `<div><label class="form-label">Fondo</label>${choice(b, "fondo", [["gris", "Gris"], ["sin-fondo", "Sin fondo"], ["amarillo", "Amarillo"], ["rojo", "Rojo"], ["verde", "Verde"]])}</div>
<div class="btnrow mt-2"><button class="btn btn-outline-dark ${b.marco ? "active" : ""}" data-do="marco">Marco${b.marco ? ": sí" : ": no"}</button><button class="btn btn-outline-dark" data-do="linea" title="Cada clic cambia el color: rosa, amarillo, verde, rojo, sin línea">Línea: ${L[b.linea || ""]}</button></div>
<p class="hint">El marco toma el color del fondo (negro si es gris o sin fondo). La línea también cambia con un clic en el borde izquierdo del recuadro. El texto no se mueve con ninguno de los dos.</p>`;
}
function boxPane(b) {
  const wide = ["datos", "foto", "fila", "quote", "video", "map", "ficha"].includes(b.type);
  const normal = wide ? "el ancho de las fotos" : "la columna de texto", back = wide ? "al ancho de las fotos" : "a la columna de texto";
  if (!b.box) return `<div><label class="form-label">Ancho</label><p class="hint">Normal: ${normal}. ${b.type === "foto" ? "Arrastra los cuadritos rosas de los lados de la foto" : "Arrastra las barras rosas a los lados del bloque"} para cambiarlo; los bordes se pegan a los márgenes de las fotos, a los de la columna de texto, al centro y a los bordes de las otras fotos.</p></div>`;
  const edge = (v, side) => v === "texto" ? "el margen de la columna de texto" : v === 0 || v === 100 ? "el margen de las fotos" : v === 50 ? "el centro" : `${side === "l" ? v : 100 - v}% ${side === "l" ? "desde el margen izquierdo" : "antes del margen derecho"} de las fotos`;
  return `<div><label class="form-label">Ancho</label><p class="hint mb-2">Izquierda: ${edge(b.box.l, "l")}. Derecha: ${edge(b.box.r, "r")}. Doble clic en una barra rosa, o el botón, lo devuelve ${back}. En celular vuelve a la columna normal.</p><button class="btn btn-outline-dark" data-do="box-reset">Volver al ancho normal</button></div>`;
}
// What the selected block is, what it is for and how to add one: so the writer learns the blocks while editing
const KINDS = {
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
  fila: ["Fila de fotos", "Varias fotos juntas con el mismo alto, que suman el ancho de una foto sola.", "Insertar → Fila o cuadrícula de fotos…, o «Poner junto a la siguiente foto» en una foto."],
  video: ["Video de YouTube", "La miniatura del video; se carga solo cuando el lector hace clic.", "Insertar → Video de YouTube."],
  map: ["Mapa", "Un mapa de OpenStreetMap con una marca en el lugar.", "Insertar → Mapa."],
  datos: ["Datos en fila", "Datos grandes entre dos líneas: lugar, distancia, desnivel, dificultad…", "Insertar → Datos en fila."],
  button: ["Botón", "Un enlace grande y visible, para reservar, comprar o ver más.", "Insertar → Botón."],
  hr: ["Línea separadora", "Separa dos partes del artículo.", "Insertar → Línea separadora, o escribe «---» en un párrafo y pulsa Enter."],
  space: ["Espacio en blanco", "Aire entre dos bloques; la altura se arrastra con la barra rosa.", "Insertar → Espacio en blanco."],
  ficha: ["Ficha de datos", "Un cuadro con título, datos y foto opcional. Puede flotar junto al texto.", "Insertar → Ficha de datos."],
  raw: ["Código HTML", "HTML o Markdown que el editor no conoce; se publica tal cual.", "Insertar → Código HTML."],
};
function kindHead(b) {
  const k = KINDS[b.type]; if (!k) return "";
  let [name, what, how] = k;
  if (b.type === "pano") { name = b.mode === "completa" ? "Foto · ancho de pantalla" : "Foto · panorámica deslizable"; what = b.mode === "completa" ? "La foto entera, de borde a borde de la pantalla." : "De borde a borde con altura limitada; el lector la desliza a los lados."; how += " Luego elige su presentación aquí abajo."; }
  if (b.type === "fila" && b.tree) { name = "Cuadrícula de fotos"; what = "Fotos en filas y columnas (mosaico) que encajan a la misma medida."; }
  const tags = [b.wrap && b.wrap.side ? (b.wrap.side === "left" ? "flota a la izquierda" : "flota a la derecha") : "", b.align === "center" ? "centrado" : "", b.box ? "ancho libre" : ""].filter(Boolean);
  return `<div class="kind"><div class="d-flex flex-wrap align-items-center gap-2"><span class="tape">${name}</span>${tags.map((t) => `<span class="kind-tag">${t}</span>`).join("")}</div><p class="hint mb-1 mt-2">${what}</p><p class="hint mb-0"><strong>Para agregar uno:</strong> ${how}</p></div><hr>`;
}
const choice = (b, key, opts) => `<div class="btnrow" role="group">${opts.map(([v, l]) => `<button class="btn btn-outline-dark ${(b[key] || opts[0][0]) === v ? "active" : ""}" data-do="bset" data-key="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
const presentPane = (b) => { const cur = b.type === "foto" ? "normal" : b.mode === "completa" ? "pantalla" : "deslizable";
  return `<div><label class="form-label">Presentación de la foto</label><div class="btnrow">${[["normal", "Normal"], ["pantalla", "Ancho de pantalla"], ["deslizable", "Panorámica deslizable"]].map(([v, l]) => `<button class="btn btn-outline-dark ${cur === v ? "active" : ""}" data-do="present" data-v="${v}">${l}</button>`).join("")}</div>
<p class="hint">Normal: al ancho de las fotos, con recorte libre y ajuste de texto. Ancho de pantalla: de borde a borde, entera. Panorámica deslizable: de borde a borde con altura limitada; el lector la desliza. Las fotos muy anchas entran como panorámicas.</p></div>`; };
function paneBlock(sel) {
  const b = ED.blocks[sel.i]; if (!b) return "";
  return kindHead(b) + paneBlockBody(sel, b);
}
function paneBlockBody(sel, b) {
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
    return `${presentPane(b)}<hr>${wrapPane(b)}${b.wrap ? "" : `<hr>${boxPane(b)}`}<p class="hint">Los cuadritos rosas alrededor de la foto cambian su tamaño: los lados, el ancho; arriba y abajo, el alto (el recorte); las esquinas, las dos cosas. Sus bordes se pegan a los de las otras fotos, a los márgenes y a la columna de texto.</p><hr>${photoForm(b.id)}<hr><div class="btnrow">${canJoin && !b.wrap ? '<button class="btn btn-outline-dark" data-do="join">Poner junto a la siguiente foto</button>' : ""}<button class="btn btn-outline-dark" data-do="replace" data-id="${esc(b.id)}">Cambiar foto</button></div>${canJoin ? '<p class="hint">Las fotos de una fila tienen el mismo alto y suman el ancho de una foto sola.</p>' : ""}`;
  }
  if (b.type === "fila") {
    const id = sel.id && b.ids.includes(sel.id) ? sel.id : b.ids[0];
    const nx = ED.blocks[sel.i + 1]; const canJoin = nx && (nx.type === "foto" || nx.type === "fila");
    const alto = Math.round(100 / rowR(b));
    return `${b.full ? "" : `${boxPane(b)}<hr>`}<div class="form-check"><input class="form-check-input" type="checkbox" id="c-full" data-k="rowfull" ${b.full ? "checked" : ""}><label class="form-check-label" for="c-full">Ancho completo de la pantalla</label></div>${fld("Altura de la fila", `<input class="form-range" type="range" min="14" max="80" step="1" data-k="rowh" value="${alto}">`, '<p class="hint">También puedes arrastrar la barra rosa bajo la fila. En filas simples, arrastra las barras entre fotos para repartir el ancho.</p>')}<hr><div><label class="form-label">Fotos de la fila</label><div class="thumbs">${b.ids.map((x) => `<button class="thumb ${x === id ? "on" : ""} ${ED.photos[x]?.alt ? "" : "miss"}" data-do="pick-item" data-id="${esc(x)}"><img src="${imgSrc(ED.meta.imgBase, ED.photos[x]?.file, "-sm.jpg")}" alt=""><span>${ED.photos[x]?.alt ? "Foto " + (b.ids.indexOf(x) + 1) : "Falta texto alternativo"}</span></button>`).join("")}</div></div>
${structPane(b, id)}<hr>${photoForm(id)}<hr><div class="btnrow"><button class="btn btn-outline-dark" data-do="row-add">Agregar foto a la fila</button>${canJoin ? '<button class="btn btn-outline-dark" data-do="join">Unir con la siguiente</button>' : ""}<button class="btn btn-outline-dark" data-do="out-row" data-id="${esc(id)}">Sacar esta foto de la fila</button><button class="btn btn-outline-dark" data-do="replace" data-id="${esc(id)}">Cambiar esta foto</button><button class="btn btn-outline-dark" data-do="split-row">Separar todas</button></div>`;
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

function structPane(b, id) {
  const t = treeOf(b), path = pathOf(t, id); if (!path) return "";
  const arr = arrAt(t, path), idx = path[path.length - 1], inRow = (path.length - 1) % 2 === 0;
  const lbl = inRow ? ["la izquierda", "la derecha", "Apilar con la foto de"] : ["arriba", "abajo", "Poner junto a la foto de"];
  const btn = (dir, ok, text) => (ok ? `<button class="btn btn-outline-dark" data-do="stack" data-dir="${dir}">${text}</button>` : "");
  return `<div><label class="form-label">Estructura (cuadrículas)</label><div class="btnrow">
${btn(-1, idx > 0, `${lbl[2]} ${lbl[0]}`)}${btn(1, idx < arr.length - 1, `${lbl[2]} ${lbl[1]}`)}
${path.length > 1 ? '<button class="btn btn-outline-dark" data-do="ungroup">Sacar del grupo</button>' : ""}
${b.tree ? '<button class="btn btn-outline-dark" data-do="ungrid">Volver a fila simple</button>' : ""}</div>
<div class="d-flex gap-2 align-items-center mt-2"><input class="form-control" type="number" min="1" max="6" value="2" id="grid-cols" aria-label="Columnas"><button class="btn btn-outline-dark" data-do="grid">Ordenar todas en cuadrícula</button></div>
<p class="hint">Apilar pone una foto encima de otra; una foto alta junto a dos apiladas da un mosaico. "Ordenar en cuadrícula" reparte todas las fotos en filas de N columnas. Cada foto conserva su recorte: para cambiar el reparto de espacio usa los recortes (Original, 3:2, 16:9…).</p></div>`;
}

function panePhotos() {
  const used = usedIds(); const ids = Object.keys(ED.photos);
  if (!ids.length) return '<p class="empty">Todavía no hay fotos. Arrástralas sobre la página o usa el botón + entre los bloques.</p>';
  return `<p class="hint">Haz clic en una foto para insertarla debajo del bloque seleccionado (o al final).</p><div class="thumbs">${ids.map((id) => `<button class="thumb ${used.has(id) ? "" : "on"} ${ED.photos[id].alt ? "" : "miss"}" data-do="insert-photo" data-id="${esc(id)}"><img src="${imgSrc(ED.meta.imgBase, ED.photos[id].file, "-sm.jpg")}" alt=""><span>${used.has(id) ? "En el artículo" : "Sin usar"}${ED.photos[id].alt ? "" : " · falta alt"}</span></button>`).join("")}</div>`;
}

// ---- preview and publish -------------------------------------------------------------------
function canvasPreview() {   // the page exactly as the canvas draws it, without the editing aids
  modal(`<div class="dlg wide"><div class="d-flex flex-wrap gap-2 align-items-center"><h2 class="flex-grow-1 mb-0">Vista previa</h2><div class="btn-group"><button class="btn btn-outline-dark active" id="pv-d">Computadora</button><button class="btn btn-outline-dark" id="pv-p">Celular</button></div><button class="btn btn-outline-dark" id="pv-x">Cerrar</button></div><div class="pv" id="pv"><iframe src="canvas.html?preview=1" title="Vista previa"></iframe></div></div>`, () => {
    $("#pv-x").onclick = closeModal;
    $("#pv-d").onclick = () => { $("#pv").classList.remove("is-phone"); $("#pv-d").classList.add("active"); $("#pv-p").classList.remove("active"); };
    $("#pv-p").onclick = () => { $("#pv").classList.add("is-phone"); $("#pv-p").classList.add("active"); $("#pv-d").classList.remove("active"); };
  });
}
$("#preview").onclick = async () => {
  await save();
  // The web editor, the writing guides (they have no address on the site) and articles without a cover show the page as
  // the editor draws it; otherwise the local editor builds the real page with Eleventy.
  if (MODE === "web" || !ED.meta.permalink || !ED.meta.hero) return canvasPreview();
  toast("Preparando la vista previa…", false, 2000);
  try { await post("/api/preview", {}); } catch (e) { toast("No se pudo construir la página con Eleventy; te muestro la vista del editor. (" + e.message + ")", true, 9000); return canvasPreview(); }
  const url = "/preview" + ED.meta.permalink + "?t=" + Date.now();
  modal(`<div class="dlg wide"><div class="d-flex flex-wrap gap-2 align-items-center"><h2 class="flex-grow-1 mb-0">Vista previa</h2><div class="btn-group"><button class="btn btn-outline-dark active" id="pv-d">Computadora</button><button class="btn btn-outline-dark" id="pv-p">Celular</button></div><button class="btn btn-outline-dark rounded-0" id="pv-x">Cerrar</button></div><div class="pv" id="pv"><iframe src="${url}" title="Vista previa"></iframe></div></div>`, () => {
    $("#pv-x").onclick = closeModal;
    $("#pv-d").onclick = () => { $("#pv").classList.remove("is-phone"); $("#pv-d").classList.add("active"); $("#pv-p").classList.remove("active"); };
    $("#pv-p").onclick = () => { $("#pv").classList.add("is-phone"); $("#pv-p").classList.add("active"); $("#pv-d").classList.remove("active"); };
  });
};
$("#publish").onclick = async () => {
  await save();
  const probs = ED.problems || [];
  const blocking = probs.filter((p) => /foto principal|título/i.test(p) && /Falta (el|la) /.test(p) && !/alternativo/.test(p));
  modal(`<div class="dlg"><h2>Publicar</h2>
    ${probs.length ? `<div><strong>Antes de publicar, revisa:</strong><ul>${probs.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : "<p>Todo en orden.</p>"}
    ${ED.meta.draft ? '<p class="hint bad">Este artículo está marcado como borrador: se publicará, pero Google no lo indexará. Puedes quitar la marca en la pestaña Artículo.</p>' : ""}
    <p class="hint">Se guardará en GitHub y, en un par de minutos, el sitio se reconstruye solo con Eleventy. Las portadas de inicio y de sección todavía se editan a mano, así que un artículo nuevo se alcanza por su dirección hasta que esas páginas pasen al editor.</p>
    <div><label class="form-label" for="pub-msg">Nota del cambio</label><input class="form-control" type="text" id="pub-msg" value="${esc("Publica: " + (ED.meta.title || ""))}"></div>
    <div class="acts"><button class="btn btn-outline-dark rounded-0" id="pub-c">Cancelar</button><button class="btn btn-primary rounded-0" id="pub-ok" ${blocking.length ? "disabled" : ""}>Publicar ahora</button></div></div>`, () => {
    $("#pub-c").onclick = closeModal;
    $("#pub-ok").onclick = async () => {
      const b = $("#pub-ok"); b.disabled = true; b.textContent = "Publicando…";
      const go = async (force) => {
        try { await post("/api/publish", { message: $("#pub-msg") ? $("#pub-msg").value : "", path: ED.path, force }); closeModal(); toast("Enviado a GitHub. En unos 2 minutos el sitio se actualiza solo.", false, 9000); if (MODE === "web") { dirty = false; setState("Publicado"); } }
        catch (e) {
          if (e.conflict) return modal(`<div class="dlg"><h2>Alguien más cambió este artículo</h2><p>${esc(e.message)}</p><p>Si publicas igual, tu versión reemplaza la otra. Si no estás seguro, cancela y habla con esa persona.</p><div class="acts"><button class="btn btn-outline-dark" id="cf-c">Cancelar</button><button class="btn btn-danger" id="cf-ok">Publicar mi versión</button></div></div>`, () => { $("#cf-c").onclick = closeModal; $("#cf-ok").onclick = () => go(true); });
          b.disabled = false; b.textContent = "Publicar ahora"; toast("No se pudo publicar: " + e.message, true, 15000);
        }
      };
      go(false);
    };
  });
};

// ---- start -----------------------------------------------------------------------------------
(async () => {
  if (MODE === "web") {
    web = await import("./web.js");
    if (!document.getElementById("logo-lockup")) { try { const r = await fetch("logo-defs.svg"); if (r.ok) document.body.insertAdjacentHTML("afterbegin", await r.text()); } catch { } }
    if (!web.session.token) await loginScreen();
    await web.loadPending();
    $("#web-tools").hidden = false; $("#who").textContent = web.session.name;
    $("#sync").textContent = "Actualizar lista";
  }
  try { const st = await api("/api/status"); ED.cfg = st.cfg; if (!st.ready) toast("El sitio no está preparado. Mira la ventana negra del editor.", true, 15000); } catch {}
  await showList().catch((e) => toast(e.message, true));
})();

// ---- access on the web: user + password (web.js decrypts the GitHub token) -------------------------------------
const TOKEN_HELP = `<details class="small"><summary class="fw-semibold">Cómo crear la llave de GitHub</summary><ol class="mt-2 mb-0">
<li>En GitHub: tu foto → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
<li>Nombre: «Editor RELIEVE». Vencimiento: hasta 1 año.</li>
<li><b>Repository access</b>: <i>Only select repositories</i> → <b>relieve</b>.</li>
<li><b>Permissions</b> → Repository: <b>Contents: Read and write</b> y <b>Actions: Read-only</b>.</li>
<li>Copia la llave (empieza con <code>github_pat_</code>) y pégala aquí. No la mandes por chat ni la guardes en otro lado: aquí queda cifrada con tu contraseña.</li></ol></details>`;
function loginScreen() {
  return new Promise(async (resolve) => {
    const box = $("#login"); box.hidden = false;
    const users = await web.loadUsers();
    const shell = (inner) => `<div class="login-card bg-body border border-2 border-strong p-4 p-md-5 d-grid gap-3"><svg class="wordmark" viewBox="-11 -11 3399 622" role="img" aria-label="RELIEVE"><use href="#logo-lockup"/></svg><span class="tape tape-secondary justify-self-start">Editor</span>${inner}</div>`;
    if (!users.length) {
      box.innerHTML = shell(`<h1 class="h2 mb-0">Primer acceso</h1><p class="mb-0">Todavía no hay usuarios. Crea el tuyo: el nombre de usuario y la contraseña sirven para entrar desde cualquier computadora.</p>
        <div><label class="form-label" for="su-name">Tu nombre (firma de los artículos)</label><input class="form-control" id="su-name" value="Daniel"></div>
        <div><label class="form-label" for="su-user">Usuario</label><input class="form-control" id="su-user" autocomplete="username"></div>
        <div><label class="form-label" for="su-pass">Contraseña (al menos 12 caracteres)</label><input class="form-control" type="password" id="su-pass" autocomplete="new-password"></div>
        <div><label class="form-label" for="su-pass2">Repite la contraseña</label><input class="form-control" type="password" id="su-pass2" autocomplete="new-password"></div>
        <div><label class="form-label" for="su-token">Llave de GitHub</label><input class="form-control" type="password" id="su-token" autocomplete="off" placeholder="github_pat_…"></div>${TOKEN_HELP}
        <p class="hint" id="su-msg"></p><button class="btn btn-primary" id="su-ok">Crear usuario y entrar</button>`);
      $("#su-ok").onclick = async () => {
        const name = $("#su-name").value, user = $("#su-user").value.trim(), pass = $("#su-pass").value, token = $("#su-token").value.trim(), msg = $("#su-msg");
        if (!user || pass.length < 12) { msg.textContent = "Escribe un usuario y una contraseña de 12 caracteres o más."; msg.classList.add("bad"); return; }
        if (pass !== $("#su-pass2").value) { msg.textContent = "Las contraseñas no coinciden."; msg.classList.add("bad"); return; }
        try { msg.classList.remove("bad"); msg.textContent = "Comprobando la llave con GitHub…"; await web.checkToken(token);
          msg.textContent = "Cifrando y guardando…"; await web.saveUsers([await web.makeUser({ user, name, password: pass, token })], token);
          web.session.set(token, name.trim() || user); box.hidden = true; toast("Listo. El usuario se guardó cifrado en GitHub; en unos 2 minutos también funciona desde el sitio."); resolve();
        } catch (e) { msg.textContent = e.message; msg.classList.add("bad"); }
      };
      return;
    }
    box.innerHTML = shell(`<h1 class="h2 mb-0">Entrar</h1>
      <div><label class="form-label" for="li-user">Usuario</label><input class="form-control" id="li-user" autocomplete="username"></div>
      <div><label class="form-label" for="li-pass">Contraseña</label><input class="form-control" type="password" id="li-pass" autocomplete="current-password"></div>
      <p class="hint" id="li-msg"></p><button class="btn btn-primary" id="li-ok">Entrar</button>`);
    const go = async () => { const msg = $("#li-msg"); msg.classList.remove("bad"); msg.textContent = "Comprobando…"; $("#li-ok").disabled = true;
      try { await web.login($("#li-user").value, $("#li-pass").value); box.hidden = true; resolve(); } catch (e) { msg.textContent = e.message; msg.classList.add("bad"); $("#li-ok").disabled = false; } };
    $("#li-ok").onclick = go; $("#li-pass").onkeydown = (e) => { if (e.key === "Enter") go(); }; $("#li-user").focus();
  });
}
$("#logout-btn").onclick = async () => { await save(); web.session.clear(); location.reload(); };
$("#users-btn").onclick = async () => {
  let users = await web.loadUsers();
  const draw = () => modal(`<div class="dlg"><h2>Usuarios</h2>
    <p class="hint mt-0">Cada persona entra con su usuario y contraseña. La contraseña descifra una llave de GitHub que solo puede tocar el repositorio de la revista.</p>
    <ul class="list-unstyled mb-0 d-grid gap-2">${users.map((u, k) => `<li class="d-flex justify-content-between align-items-center border-bottom pb-2"><span><b>${esc(u.name || u.user)}</b> <span class="text-secondary">· ${esc(u.user)}${u.created ? ` · desde ${esc(u.created)}` : ""}</span></span><button class="btn btn-outline-danger btn-sm" data-rm="${k}" ${users.length === 1 ? "disabled title='Debe quedar al menos un usuario'" : ""}>Quitar</button></li>`).join("")}</ul>
    <h3 class="h4 mb-0 mt-2">Agregar usuario</h3>
    <div><label class="form-label" for="nu-name">Nombre</label><input class="form-control" id="nu-name"></div>
    <div><label class="form-label" for="nu-user">Usuario</label><input class="form-control" id="nu-user"></div>
    <div><label class="form-label" for="nu-pass">Contraseña (12 caracteres o más; dísela en persona)</label><input class="form-control" type="password" id="nu-pass" autocomplete="new-password"></div>
    <div class="form-check"><input class="form-check-input" type="checkbox" id="nu-same" checked><label class="form-check-label" for="nu-same">Usar la misma llave de GitHub que yo</label></div>
    <div id="nu-tok-wrap" hidden><label class="form-label" for="nu-token">Su llave de GitHub</label><input class="form-control" type="password" id="nu-token" placeholder="github_pat_…">${TOKEN_HELP}</div>
    <p class="hint" id="nu-msg"></p>
    <div class="acts"><button class="btn btn-outline-dark" id="nu-c">Cerrar</button><button class="btn btn-primary" id="nu-ok">Agregar</button></div></div>`, () => {
    $("#nu-c").onclick = closeModal;
    $("#nu-same").onchange = () => { $("#nu-tok-wrap").hidden = $("#nu-same").checked; };
    document.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => { const next = users.filter((_, k) => k !== Number(b.dataset.rm)); try { await web.saveUsers(next); users = next; draw(); toast("Usuario quitado. Para cortarle el acceso del todo, borra también su llave en GitHub."); } catch (e) { toast(e.message, true); } }));
    $("#nu-ok").onclick = async () => {
      const msg = $("#nu-msg"), user = $("#nu-user").value.trim(), pass = $("#nu-pass").value, token = $("#nu-same").checked ? web.session.token : $("#nu-token").value.trim();
      if (!user || pass.length < 12) { msg.textContent = "Escribe un usuario y una contraseña de 12 caracteres o más."; msg.classList.add("bad"); return; }
      if (users.some((u) => u.user === user.toLowerCase())) { msg.textContent = "Ese usuario ya existe."; msg.classList.add("bad"); return; }
      try { msg.classList.remove("bad"); msg.textContent = "Guardando…"; if (!$("#nu-same").checked) await web.checkToken(token);
        const next = [...users, await web.makeUser({ user, name: $("#nu-name").value, password: pass, token })]; await web.saveUsers(next); users = next; draw(); toast("Usuario agregado. Ya puede entrar con su usuario y contraseña."); }
      catch (e) { msg.textContent = e.message; msg.classList.add("bad"); }
    };
  });
  draw();
};

// ---- Panel (dashboard) ---------------------------------------------------------------------------------------
const MB = (n) => (n / 1048576).toFixed(n > 104857600 ? 0 : 1).replace(".", ",") + " MB";
const SITE_URL = "https://relievemag.com";
const gcCfg = () => { try { return JSON.parse(localStorage.getItem("relieve-gc") || "{}"); } catch { return {}; } };
async function gcGet(pathq) {
  const c = gcCfg(); if (!c.code || !c.token) throw new Error("sin configurar");
  const url = `https://${c.code}.goatcounter.com/api/v0/${pathq}`;
  if (MODE === "local") return post("/api/gc", { url, token: c.token });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`GoatCounter respondió ${r.status}`); return r.json();
}
const isoDay = (d) => d.toISOString().slice(0, 10);
async function showPanel() {
  await save(); ED.path = null; ED.meta = null; showView("panel");
  const el = $("#panel"); el.innerHTML = '<p class="text-secondary">Cargando datos…</p>';
  let d; try { d = await api("/api/dashboard"); } catch (e) { el.innerHTML = `<p class="text-danger">${esc(e.message)}</p>`; return; }
  const arts = d.articles.filter((a) => !a.guia), pub = arts.filter((a) => !a.draft), drafts = arts.filter((a) => a.draft);
  const words = pub.reduce((s, a) => s + a.words, 0), photos = arts.reduce((s, a) => s + a.photos, 0);
  const sorted = [...pub].sort((a, b) => b.date.localeCompare(a.date)), last = sorted[0];
  const daysSince = last ? Math.round((Date.now() - new Date(last.date + "T12:00:00")) / 86400000) : null;
  const months = []; const now = new Date();
  for (let k = 11; k >= 0; k--) { const m = new Date(now.getFullYear(), now.getMonth() - k, 1); const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`; months.push({ key, label: m.toLocaleDateString("es", { month: "short" }).replace(".", ""), n: pub.filter((a) => a.date.startsWith(key)).length }); }
  const maxM = Math.max(1, ...months.map((m) => m.n));
  const bySec = SECTIONS.map(([k, l]) => ({ l, n: pub.filter((a) => a.section === k).length })); const maxS = Math.max(1, ...bySec.map((x) => x.n));
  const limit = 1024 * 1048576, pct = Math.min(100, (d.sizes.total / limit) * 100);
  const issues = arts.filter((a) => a.issues.length);
  const heavy = [...arts].sort((a, b) => b.imgBytes - a.imgBytes).slice(0, 5);
  const kpi = (n, l, sub = "") => `<div class="col"><div class="border border-2 border-strong p-3 h-100"><div class="small-meta fw-semibold font-ui">${l}</div><div class="h3 mb-0 text-nowrap">${n}</div>${sub ? `<div class="small-meta mt-1">${sub}</div>` : ""}</div></div>`;
  const sec = (title, inner, extra = "") => `<section class="mt-5"><div class="d-flex justify-content-between align-items-end border-bottom border-2 border-strong pb-2 mb-3 gap-2 flex-wrap"><h2 class="tape mb-0">${title}</h2>${extra}</div>${inner}</section>`;
  el.innerHTML = `<div class="d-flex flex-wrap justify-content-between align-items-end gap-3 border-bottom border-2 border-strong pb-3"><h1 class="mb-0">Panel</h1><span class="font-ui small text-secondary">${MODE === "web" ? "Datos del repositorio en GitHub" : "Datos de la copia del sitio en esta computadora"} · ${new Date().toLocaleString("es")}</span></div>
  <div class="row row-cols-2 row-cols-md-3 row-cols-xl-6 g-3 mt-1">
    ${kpi(pub.length, "Artículos publicados", `${drafts.length} borrador${drafts.length === 1 ? "" : "es"}${d.drafts ? ` · ${d.drafts} con cambios sin publicar` : ""}`)}
    ${kpi(words.toLocaleString("es"), "Palabras publicadas", `${Math.round(words / 220)} min de lectura en total`)}
    ${kpi(pub.length ? Math.round(words / pub.length).toLocaleString("es") : "–", "Palabras por artículo", "promedio")}
    ${kpi(photos, "Fotos", "en todos los artículos")}
    ${kpi(MB(d.sizes.total), "Peso del contenido", `fotos ${MB(d.sizes.images)} · textos ${MB(d.sizes.texts)}`)}
    ${kpi(last ? (daysSince === 0 ? "Hoy" : `${daysSince} d`) : "–", "Desde el último artículo", last ? esc(last.title).slice(0, 48) : "")}
  </div>
  <div class="mt-3"><div class="d-flex justify-content-between small-meta mb-1"><span>Espacio usado del límite recomendado de GitHub Pages (1 GB)</span><span>${pct.toFixed(1).replace(".", ",")} %</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>
  ${sec("Tráfico", '<div id="traffic"><p class="text-secondary">Cargando…</p></div>', '<button class="btn btn-outline-dark btn-sm" id="gc-set">Configurar estadísticas</button>')}
  <div class="row g-5">
    <div class="col-lg-7">${sec("Ritmo de publicación", `<div class="chart">${months.map((m) => `<div class="chart-col" title="${m.n} artículo${m.n === 1 ? "" : "s"}"><span class="chart-n">${m.n || ""}</span><span class="chart-bar" style="height:${(m.n / maxM) * 100}%"></span><span class="chart-l">${m.label}</span></div>`).join("")}</div><p class="hint">Artículos publicados por mes, últimos 12 meses (según la fecha de cada artículo).</p>`)}</div>
    <div class="col-lg-5">${sec("Por sección", bySec.map((x) => `<div class="d-flex align-items-center gap-2 mb-2"><span class="font-ui small fw-semibold" style="width:6rem">${x.l}</span><div class="bar flex-grow-1"><span style="width:${(x.n / maxS) * 100}%"></span></div><span class="font-ui small" style="width:2rem;text-align:right">${x.n}</span></div>`).join(""))}</div>
  </div>
  ${sec("Revisión editorial", issues.length ? `<ul class="list-unstyled mb-0">${issues.map((a) => `<li class="border-bottom py-2"><a href="#" class="fw-semibold" data-open="${esc(a.path)}">${esc(a.title)}</a>${a.draft ? ' <span class="badge rounded-0 text-bg-dark">Borrador</span>' : ""}<ul class="mb-0 small">${a.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></li>`).join("")}</ul>` : "<p>Todo en orden: ningún artículo tiene pendientes.</p>", '<span class="font-ui small text-secondary">Texto alternativo, descripción para Google, foto principal, avisos</span>')}
  <div class="row g-5">
    <div class="col-lg-6">${sec("Artículos más pesados", `<ol class="mb-0">${heavy.map((a) => `<li class="mb-1"><a href="#" data-open="${esc(a.path)}">${esc(a.title)}</a> <span class="text-secondary">· ${MB(a.imgBytes)} de fotos</span></li>`).join("")}</ol><p class="hint">Fotos pesadas hacen más lenta la página en celulares con mala señal.</p>`)}</div>
    <div class="col-lg-6">${sec("Actividad reciente", d.commits.length ? `<ul class="list-unstyled mb-0 small">${d.commits.map((c) => `<li class="border-bottom py-1"><span class="text-secondary">${esc(new Date(c.date).toLocaleDateString("es"))} · ${esc(c.author)}</span><br>${esc(c.message)}</li>`).join("")}</ul>` : '<p class="text-secondary">Sin datos.</p>')}</div>
  </div>
  ${sec("Estado de la publicación", '<div id="deploy"><p class="text-secondary">Consultando GitHub…</p></div>')}
  ${sec("Enlaces", `<div class="d-flex flex-wrap gap-2"><a class="btn btn-outline-dark" href="${SITE_URL}" target="_blank" rel="noopener">Ver el sitio</a><a class="btn btn-outline-dark" href="https://github.com/Danielcarens/relieve" target="_blank" rel="noopener">Repositorio</a><a class="btn btn-outline-dark" href="https://github.com/Danielcarens/relieve/actions" target="_blank" rel="noopener">Publicaciones (Actions)</a><a class="btn btn-outline-dark" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(SITE_URL)}" target="_blank" rel="noopener">Velocidad (PageSpeed)</a><a class="btn btn-outline-dark" href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a>${gcCfg().code ? `<a class="btn btn-outline-dark" href="https://${esc(gcCfg().code)}.goatcounter.com" target="_blank" rel="noopener">Estadísticas completas</a>` : ""}</div>`)}`;
  el.querySelectorAll("[data-open]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); open(a.dataset.open).catch((er) => toast(er.message, true)); }));
  $("#gc-set").onclick = gcSetup;
  loadTraffic(); loadDeploy();
}
async function loadTraffic() {
  const box = $("#traffic"); if (!box) return;
  if (!gcCfg().code || !gcCfg().token) { box.innerHTML = `<p class="mb-2">Las visitas se cuentan con <b>GoatCounter</b>: de código abierto, gratuito para sitios como este, sin cookies ni avisos de privacidad. Pulsa <b>Configurar estadísticas</b> para activarlo.</p>`; return; }
  const t = new Date(), ago = (n) => isoDay(new Date(t.getTime() - n * 86400000)), end = isoDay(new Date(t.getTime() + 86400000));
  try {
    const ranges = [["Hoy", isoDay(t)], ["Últimos 7 días", ago(7)], ["Últimos 30 días", ago(30)], ["Último año", ago(365)]];
    const totals = await Promise.all(ranges.map(([, s]) => gcGet(`stats/total?start=${s}&end=${end}`)));
    const hits = await gcGet(`stats/hits?start=${ago(30)}&end=${end}&limit=8`);
    const num = (j) => j.total ?? j.total_pageviews ?? j.count ?? 0;
    box.innerHTML = `<div class="row row-cols-2 row-cols-md-4 g-3">${ranges.map(([l], k) => `<div class="col"><div class="border border-2 border-strong p-3"><div class="small-meta fw-semibold font-ui">${l}</div><div class="h2 mb-0">${Number(num(totals[k])).toLocaleString("es")}</div><div class="small-meta">visitas</div></div></div>`).join("")}</div>
      <h3 class="h5 mt-4">Lo más leído en los últimos 30 días</h3><ol class="mb-0">${(hits.hits || []).map((h) => `<li>${esc(h.title || h.path)} <span class="text-secondary">· ${esc(h.path)} · ${Number(h.count ?? h.count_unique ?? 0).toLocaleString("es")}</span></li>`).join("") || "<li>Todavía sin visitas.</li>"}</ol>`;
  } catch (e) { box.innerHTML = `<p class="text-danger mb-1">No se pudieron leer las estadísticas: ${esc(e.message)}.</p><p class="hint mt-0">Revisa el código y la llave en «Configurar estadísticas»${MODE === "web" ? ", o ábrelas directamente con el botón «Estadísticas completas» (algunos navegadores bloquean esta consulta desde el sitio)" : ""}.</p>`; }
}
async function loadDeploy() {
  const box = $("#deploy"); if (!box) return;
  try {
    const headers = MODE === "web" && web.session.token ? { Authorization: `Bearer ${web.session.token}` } : {};
    const r = await fetch("https://api.github.com/repos/Danielcarens/relieve/actions/runs?per_page=3&branch=eleventy-prueba", { headers }); if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const runs = (await r.json()).workflow_runs || [];
    const label = (x) => x.status !== "completed" ? ["Publicando ahora…", "text-bg-warning"] : x.conclusion === "success" ? ["Publicado", "text-bg-success"] : ["Falló", "text-bg-danger"];
    box.innerHTML = runs.length ? `<ul class="list-unstyled mb-0">${runs.map((x) => { const [t, c] = label(x); return `<li class="border-bottom py-2 d-flex flex-wrap gap-2 align-items-center"><span class="badge rounded-0 ${c}">${t}</span><span>${esc((x.head_commit?.message || x.display_title || "").split("\n")[0])}</span><span class="text-secondary small">· ${esc(new Date(x.created_at).toLocaleString("es"))}</span><a class="small ms-auto" href="${esc(x.html_url)}" target="_blank" rel="noopener">Detalles</a></li>`; }).join("")}</ul><p class="hint">Cada vez que alguien publica, GitHub construye el sitio con Eleventy y lo sube; tarda unos 2 minutos.</p>` : "<p>Sin publicaciones recientes.</p>";
  } catch (e) { box.innerHTML = `<p class="text-secondary">No se pudo consultar GitHub (${esc(e.message)}). Mira <a href="https://github.com/Danielcarens/relieve/actions" target="_blank" rel="noopener">las publicaciones en GitHub</a>.</p>`; }
}
function gcSetup() {
  const c = gcCfg();
  modal(`<div class="dlg"><h2>Estadísticas de visitas</h2>
    <ol class="mb-0"><li>Crea una cuenta gratis en <a href="https://www.goatcounter.com/signup" target="_blank" rel="noopener">goatcounter.com</a>. El «código» es el nombre que elijas (por ejemplo <b>relieve</b> para relieve.goatcounter.com).</li>
    <li>Escribe el código aquí y pulsa <b>Activar en el sitio</b>: el sitio empieza a contar visitas (los borradores no cuentan).</li>
    <li>Para ver los números en este panel: en GoatCounter, tu usuario → <b>API</b> → crea una llave con permiso de lectura de estadísticas y pégala aquí.</li></ol>
    <div><label class="form-label" for="gc-code">Código</label><input class="form-control" id="gc-code" value="${esc(c.code || "")}" placeholder="relieve"></div>
    <div><label class="form-label" for="gc-token">Llave de la API (solo lectura)</label><input class="form-control" type="password" id="gc-token" value="${esc(c.token || "")}"></div>
    <p class="hint">La llave queda guardada solo en este navegador.</p>
    <div class="acts"><button class="btn btn-outline-dark" id="gc-c">Cerrar</button><button class="btn btn-outline-dark" id="gc-on">Activar en el sitio</button><button class="btn btn-primary" id="gc-ok">Guardar</button></div></div>`, () => {
    $("#gc-c").onclick = closeModal;
    const store = () => { try { localStorage.setItem("relieve-gc", JSON.stringify({ code: $("#gc-code").value.trim().toLowerCase(), token: $("#gc-token").value.trim() })); } catch { } };
    $("#gc-ok").onclick = () => { store(); closeModal(); loadTraffic(); };
    $("#gc-on").onclick = async () => { const code = $("#gc-code").value.trim().toLowerCase(); if (!/^[a-z0-9-]+$/.test(code)) return toast("Escribe el código de GoatCounter (solo letras, números y guiones).", true);
      try { const r = await post("/api/goatcounter", { code }); store(); toast(r.note || "Listo: el sitio contará visitas en cuanto termine de publicarse (unos 2 minutos).", false, 8000); } catch (e) { toast(e.message, true); } };
  });
}
$("#nav-panel").onclick = (e) => { e.preventDefault(); showPanel().catch((er) => toast(er.message, true)); };
