// The three views (articles, panel, an article being edited), opening articles, the device toggle and the top bar that scrolls away.
import { SECTIONS } from "./config.js";
import { MODE, api, env, post } from "./env.js";
import { renderInspector } from "./inspector.js";
import { updateCount, updateRibbon } from "./ribbon.js";
import { markDirty, redo, save, setState, undo, updateUndo } from "./state.js";
import { ED, S } from "./store.js";
import { $, cdoc, closeModal, esc, frame, modal, setBusy, toast } from "./util.js";
// ---- rendering ---------------------------------------------------------------------
export function refresh() {
  const w = frame().contentWindow; if (w && w.render) w.render();
  renderInspector();
  $("#crumb").textContent = ED.meta ? ED.meta.title || "Sin título" : "";
}
export function highlight() {
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
export function showView(v) {
  navFollow(0);   // every view starts with the bar in sight
  for (const id of ["view-list", "view-edit", "view-panel"]) $("#" + id).hidden = id !== "view-" + v;
  $("#tools").hidden = v !== "edit"; $("#ribbon").hidden = v !== "edit"; $("#nav-crumb").hidden = v !== "edit";
  if (MODE === "web" && env.web && env.web.session.token) $("#web-tools").hidden = v === "edit";   // Usuarios / Salir only outside an article: the bar keeps the site's width
  for (const [id, on] of [["nav-list", v === "list"], ["nav-panel", v === "panel"]]) { $("#" + id).classList.toggle("active", on); if (on) $("#" + id).setAttribute("aria-current", "page"); else $("#" + id).removeAttribute("aria-current"); }
}
export const artItem = (a) => `<li class="art border-bottom border-strong" data-path="${esc(a.path)}" ${a.error ? `data-error="${esc(a.error)}"` : ""}>
    ${a.hero ? `<img class="art-thumb" src="${esc(a.hero)}" alt="">` : `<div class="art-thumb"></div>`}
    <div class="min-w-0"><span class="tape tape-secondary mb-2">${esc(a.guia ? "Guía" : (SECTIONS.find((s) => s[0] === a.section) || [, a.section])[1] || "")}</span><h2 class="h3 mb-1">${esc(a.title)}</h2><div class="small-meta">${esc(a.date || "")}</div></div>
    <div class="d-flex flex-wrap gap-2 justify-content-end align-items-center">${a.error ? `<span class="ed-tag tone-rojo" title="${esc(a.error)}">Con error</span>` : ""}${a.local ? `<span class="ed-tag tone-amarillo" title="Los cambios están guardados en este navegador. Se suben con «Publicar».">${a.isNew ? "Nuevo, sin publicar" : "Cambios sin publicar"}</span>` : ""}${a.draft && !a.guia ? '<span class="ed-tag is-dark">Borrador</span>' : ""}${a.ai ? '<span class="ed-tag tone-amarillo">Texto con IA</span>' : ""}${a.local && MODE === "web" ? `<button class="btn btn-primary" data-discard="${esc(a.path)}">Descartar cambios</button>` : ""}</div></li>`;
export async function showList() {
  await save();
  ED.path = null; ED.meta = null; S.hist = []; S.fut = [];
  showView("list"); $("#crumb").textContent = "";
  const [list, st] = await Promise.all([api("/api/articles"), api("/api/status")]);
  $("#git-state").textContent = MODE === "web" ? (st.changes ? `${st.changes} artículo${st.changes === 1 ? "" : "s"} con cambios sin publicar en este navegador` : "Todo publicado") : st.ready ? `Rama ${st.branch}${st.changes ? ` · ${st.changes} cambios sin publicar` : ""}` : "El sitio no está listo";
  const arts = list.filter((a) => !a.guia), guides = list.filter((a) => a.guia).sort((a, b) => String(a.path).localeCompare(String(b.path)));
  $("#articles").innerHTML = arts.length ? arts.map(artItem).join("") : '<li class="empty">Todavía no hay artículos. Crea el primero con "Nuevo artículo".</li>';
  $("#guides").innerHTML = guides.map(artItem).join("");
  $("#guides-wrap").hidden = !guides.length;
}
// Older drafts: text boxes had one "tone"; a card's title link was a separate field (now a link inside the title)
export function migrate(m) {
  const T = { borde: { fondo: "sin-fondo", marco: true }, acento: { fondo: "gris", linea: "rosa" }, amarillo: { fondo: "amarillo" }, rojo: { fondo: "rojo" }, verde: { fondo: "verde" } };
  for (const b of m.blocks) if (b.type === "callout" && !b.fondo) { Object.assign(b, { fondo: "gris", marco: false, linea: "" }, T[b.tone] || {}); delete b.tone; }
  for (const f of Object.values(m.fichas || {})) if (f.url) { if (f.title && !/\]\(/.test(f.title)) f.title = `[${f.title}](${f.url})`; delete f.url; }
}
export async function open(path) {
  const m = await api("/api/article?path=" + encodeURIComponent(path));
  if (Array.isArray(m.meta.route) && m.meta.route.length) {
    m.blocks.unshift({ type: "datos", rows: m.meta.route.map((r) => ({ label: r.label || "", value: [r.value, r.unit].filter(Boolean).join(" ") })) });
    delete m.meta.route; setTimeout(() => { markDirty(); toast("La ficha del recorrido ahora es un bloque «Datos en fila» al inicio del texto: puedes moverlo o repetirlo donde quieras."); }, 300);
  }
  migrate(m);
  Object.assign(ED, { path, meta: m.meta, photos: m.photos, fichas: m.fichas || {}, blocks: m.blocks, problems: m.problems, sel: null, tab: "article", heroV: Date.now() });
  S.hist = []; S.fut = []; S.dirty = false; setState("Guardado"); updateUndo();
  showView("edit"); $("#crumb").textContent = ED.meta.title || "Sin título"; updateCount();
  const w = frame().contentWindow;
  if (w && w.render) refresh(); else frame().addEventListener("load", refresh, { once: true });
  renderInspector();
}
$("#view-list").addEventListener("click", async (e) => {
  const d = e.target.closest("[data-discard]");
  if (d) { e.stopPropagation(); return modal(`<div class="dlg"><h2>Descartar cambios</h2><p>Se borran de este navegador los cambios de «${esc(d.closest(".art").querySelector("h2").textContent)}» que no se han publicado, y sus fotos nuevas. Lo publicado no cambia.</p><div class="acts"><button class="btn btn-outline-dark" id="dc-c">Cancelar</button><button class="btn btn-primary" id="dc-ok">Descartar</button></div></div>`, () => { $("#dc-c").onclick = closeModal; $("#dc-ok").onclick = async () => { await post("/api/discard", { path: d.dataset.discard }); closeModal(); showList(); }; }); }
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
// ---- device toggle ---------------------------------------------------------------------
export function setDevice(d) { S.device = d; $("#stage").classList.toggle("is-phone", d === "phone"); $("#dev-phone").classList.toggle("active", d === "phone"); $("#dev-desktop").classList.toggle("active", d === "desktop"); setTimeout(() => frame().contentWindow.render && frame().contentWindow.render(), 60); }
$("#dev-desktop").onclick = () => setDevice("desktop"); $("#dev-phone").onclick = () => setDevice("phone"); setDevice("desktop");
$("#undo").onclick = undo; $("#redo").onclick = redo;

// ---- the top bar scrolls away with the page, like the site's: the page gets the whole screen -------------------
// The page (or the list) scrolls inside its own box; the bar follows its first pixels and the box grows into the room it
// leaves. The ribbon stays on top. ZOOM: the editor is drawn at 90 % (ui.css), the page's pixels are that much smaller.
export const ZOOM = 0.9, navEl = $(".navbar-ridge");
export function navFollow(y = 0, room = 0) {
  const h = navEl.offsetHeight, m = room < h * 1.5 ? 0 : Math.round(Math.min(Math.max(0, y), h));
  const v = m ? -m + "px" : ""; if (navEl.style.marginTop !== v) navEl.style.marginTop = v;
}
export function canvasScroll() { const w = frame().contentWindow, d = w.document.documentElement; navFollow(w.scrollY * ZOOM, (d.scrollHeight - w.innerHeight) * ZOOM); }
export function hookCanvasScroll() { try { frame().contentWindow.addEventListener("scroll", canvasScroll, { passive: true }); } catch {} }
frame().addEventListener("load", hookCanvasScroll); hookCanvasScroll();
document.querySelectorAll("main.list-view").forEach((m) => m.addEventListener("scroll", () => { if (!m.hidden) navFollow(m.scrollTop * ZOOM, (m.scrollHeight - m.clientHeight) * ZOOM); }, { passive: true }));
