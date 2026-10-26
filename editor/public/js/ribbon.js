// The Word-style ribbon: styles, bold / italic / links, alignment, word count, find and replace, shortcuts.
import { act } from "./actions.js";
import { INSERT_MENU, TEXTY, textOf } from "./config.js";
import { mutate } from "./state.js";
import { ED, S } from "./store.js";
import { $, cdoc, closeModal, modal, toast, esc } from "./util.js";
// ---- Buscar y reemplazar (Ctrl+H) -------------------------------------------------------------
export function textSlots() {   // every piece of article text the writer typed: [object, key]
  const out = [[ED.meta, "title"], [ED.meta, "subtitle"]];
  for (const b of ED.blocks) {
    if (b.items) b.items.forEach((_, k) => out.push([b.items, k]));
    for (const k of ["text", "title", "by", "caption"]) if (typeof b[k] === "string" && b.type !== "raw") out.push([b, k]);
  }
  for (const p of Object.values(ED.photos)) { if (p.caption) out.push([p, "caption"]); if (p.alt) out.push([p, "alt"]); }
  return out.filter(([o, k]) => typeof o[k] === "string");
}
export function findReplace() {
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
export function shortcutsHelp() {
  const rows = [["Ctrl + B", "Negrita"], ["Ctrl + I", "Cursiva"], ["Ctrl + K", "Enlace"], ["Ctrl + Alt + 1", "Título"], ["Ctrl + Alt + 2", "Subtítulo"], ["Ctrl + Shift + N", "Párrafo normal"],
    ["Ctrl + Shift + L", "Lista con viñetas"], ["Ctrl + E / Ctrl + L", "Centrar / alinear a la izquierda"], ["Ctrl + Z / Ctrl + Y", "Deshacer / rehacer"], ["Ctrl + H", "Buscar y reemplazar"], ["Ctrl + S", "Guardar ahora"],
    ["Enter", "Párrafo nuevo (en una lista: otro punto)"], ["Shift + Enter", "Salto de línea dentro del párrafo"], ["Backspace al inicio", "Une con el bloque de arriba"], ["Supr al final", "Une con el bloque de abajo"],
    ["Flechas", "Pasan de un bloque a otro como en Word"], ["«- » o «1. » al empezar", "Crea una lista"], ["«## » / «### »", "Título / subtítulo"], ["«> »", "Cita destacada"], ["«---» + Enter", "Línea separadora"]];
  modal(`<div class="dlg"><h2>Atajos de teclado</h2><table class="table table-sm mb-0 font-ui"><tbody>${rows.map(([k, v]) => `<tr><th class="text-nowrap pe-3">${k}</th><td>${v}</td></tr>`).join("")}</tbody></table><p class="hint">Pegar desde Word o Google Docs conserva títulos, listas, negritas, cursivas y enlaces. Pegar una imagen la agrega como foto.</p><div class="acts"><button class="btn btn-primary" id="sh-ok">Entendido</button></div></div>`, () => { $("#sh-ok").onclick = closeModal; });
}

// ---- ribbon (Word-style bar) ----------------------------------------------------------------
export function ribbonCmd(cmd) {
  const i = S.lastCaret ?? ED.sel?.i, b = i != null ? ED.blocks[i] : null;
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
$("#rb-style").addEventListener("change", (e) => { const i = S.lastCaret ?? ED.sel?.i; if (i != null && e.target.value) convertBlock(i, e.target.value); });
// Turn a block into another text style (Word's style box). Several paragraphs become several blocks or list items.
export function convertBlock(i, type) {
  const b = ED.blocks[i]; if (!b || b.type === type || !TEXTY.includes(b.type)) return;
  const paras = textOf(b).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  let out;
  if (type === "ul" || type === "ol") out = [{ type, items: paras.length ? paras : [""] }];
  else if (type === "callout") out = [{ type, fondo: "gris", marco: false, linea: "", text: paras.join("\n\n") }];
  else out = (paras.length ? paras : [""]).map((t) => ({ type, text: t, ...(b.align && ["p", "h2", "h3"].includes(type) ? { align: b.align } : {}) }));
  if (b.box && type !== "quote") out.forEach((x) => { x.box = { ...b.box }; });
  mutate(() => { ED.blocks.splice(i, 1, ...out); ED.sel = { i }; ED.focus = { i }; S.lastCaret = i; });
}
export function countWords() {
  let n = 0; const add = (t) => { const w = String(t || "").replace(/[*_#>\[\]()`]/g, " ").replace(/https?:\/\/\S+/g, " ").trim(); if (w) n += w.split(/\s+/).length; };
  add(ED.meta?.title); add(ED.meta?.subtitle);
  for (const b of ED.blocks) { if (b.items) b.items.forEach(add); else { add(b.text); add(b.title); } }
  return n;
}
export function updateCount() { if (!ED.meta) return; const n = countWords(); $("#rb-count").textContent = `${n.toLocaleString("es")} palabras · ${Math.max(1, Math.round(n / 220))} min de lectura`; }
export function updateRibbon() {
  const i = S.lastCaret ?? ED.sel?.i, b = i != null ? ED.blocks[i] : null;
  const sel = $("#rb-style"); sel.value = b && TEXTY.includes(b.type) ? b.type : "";
  sel.disabled = !(b && TEXTY.includes(b.type));
  $('[data-rb="center"]').classList.toggle("active", b?.align === "center"); $('[data-rb="left"]').classList.toggle("active", !!b && ["p", "h2", "h3", "button"].includes(b.type) && b.align !== "center");
}
export function insertAfterCurrent(type) { const i = S.lastCaret ?? ED.sel?.i; act.add(type, i == null ? ED.blocks.length : i + 1); }
export function wrapSelection(mark) {
  const w = cdoc().defaultView;
  if (w.plainField) return toast(w.plainField, true);
  if (!w.hasTextSelection()) return toast("Selecciona primero el texto en la página.", true);
  w.formatText(mark === "**" ? "bold" : "italic");
}
export function linkSelection() {
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
