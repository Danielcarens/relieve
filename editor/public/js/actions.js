// window.act: everything the canvas (canvas.js, inside the iframe) asks the editor to do.
import { BLOCK_DEFAULTS, NEEDS_CLEAR, textTypes } from "./config.js";
import { api, post } from "./env.js";
import { renderInspector, renderInspectorSoft } from "./inspector.js";
import { insertNode, nodeOfBlock, removeNode } from "./mosaic.js";
import { putNode } from "./mosaic-blocks.js";
import { addPhotos, newPhoto, pickFiles, setHeroFile } from "./photos.js";
import { ribbonCmd, updateRibbon, wrapSelection } from "./ribbon.js";
import { mutate, redo, save, undo } from "./state.js";
import { ED, S } from "./store.js";
import { $, cdoc, frame, toast } from "./util.js";
import { highlight } from "./views.js";
// ---- actions called by the canvas -----------------------------------------------------------
export const act = window.act = {
  caretIn(i) { if (i === S.lastCaret && ED.sel?.i === i) { updateRibbon(); return; } S.lastCaret = i; if (ED.sel?.i !== i) { ED.sel = { i }; ED.tab = "block"; highlight(); renderInspector(); } updateRibbon(); },
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
      ED.blocks.splice(i, 1, ...out); const at = i + (before.length ? 1 : 0); ED.sel = { i: at }; ED.focus = { i: at, caret: 0 }; S.lastCaret = at;
    });
  },
  listUnwrapFirst(i) {   // Backspace at the start of the first bullet: that line becomes a normal paragraph
    mutate(() => {
      const b = ED.blocks[i], [first, ...rest] = b.items;
      ED.blocks.splice(i, 1, { type: "p", text: first || "" }, ...(rest.length ? [{ type: b.type, items: rest }] : []));
      ED.sel = { i }; ED.focus = { i, caret: 0 }; S.lastCaret = i;
    });
  },
  autoformat(i, type, rest) {
    mutate(() => {
      const nb = type === "ul" || type === "ol" ? { type, items: [rest] } : { type, text: rest };
      ED.blocks.splice(i, 1, nb); ED.sel = { i }; ED.focus = { i, caret: 0, li: 0 }; S.lastCaret = i;
    });
  },
  ribbon(cmd) { ribbonCmd(cmd); },
  saveNow() { save(); },
  continueAtEnd() {   // click under the last block, like in Word: write at the end
    const n = ED.blocks.length, last = ED.blocks[n - 1];
    if (last && last.type === "p" && !last.text.trim()) { ED.focus = { i: n - 1 }; frame().contentWindow.render(); return; }
    mutate(() => { ED.blocks.push({ type: "p", text: "" }); ED.sel = { i: n }; ED.focus = { i: n, caret: 0 }; S.lastCaret = n; });
  },
  toRule(i) { mutate(() => { ED.blocks.splice(i, 1, { type: "hr" }, { type: "p", text: "" }); ED.sel = { i: i + 1 }; ED.focus = { i: i + 1, caret: 0 }; S.lastCaret = i + 1; }); },
  selState(st) { for (const k of ["bold", "italic", "link"]) $(`[data-rb="${k}"]`)?.classList.toggle("active", !!st[k]); },
  select(i, id = null) {
    ED.sel = i === null ? null : { i, id };
    if (i === null) { if (ED.tab === "block") ED.tab = "article"; } else { ED.tab = "block"; S.lastCaret = i; }
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
  add(type, at, opts = {}) {
    // From the "+" under a floating photo: what goes there must start below the photo. Titles, photos, mosaics, quotes,
    // lines and spaces do it by themselves; anything else gets a small space (that clears the photo) in front of it.
    const pre = opts.under && NEEDS_CLEAR.includes(type) ? [{ type: "space", size: 1.5 }] : [];
    const at0 = at; at += pre.length;
    if (type === "ficha") {
      mutate(() => {
        let n = 1; while (ED.fichas["ficha-" + n]) n++;
        const id = "ficha-" + n;
        ED.fichas[id] = { title: "Datos", tone: "gris", format: "lista", rows: [{ label: "Dato", value: "Valor" }] };
        ED.blocks.splice(at, 0, { type: "ficha", id, wrap: { side: "right", size: 40, hang: true } });
        ED.sel = { i: at }; ED.tab = "block";
      });
    } else if (textTypes.includes(type)) {
      mutate(() => { ED.blocks.splice(at0, 0, ...pre, { type, text: "" }); ED.focus = { i: at, caret: 0 }; ED.sel = { i: at }; ED.tab = "block"; S.lastCaret = at; });
    } else if (BLOCK_DEFAULTS[type]) {
      mutate(() => {
        ED.blocks.splice(at0, 0, ...pre, BLOCK_DEFAULTS[type]()); ED.sel = { i: at }; ED.tab = "block"; S.lastCaret = at;
        if (["ul", "ol", "callout", "details", "button"].includes(type)) ED.focus = { i: at, caret: 0, field: type === "details" || type === "button" };
      });
    } else if (type === "foto") pickFiles(true).then((f) => addPhotos(f, at));
    else if (type === "fila") pickFiles(true).then((f) => f.length < 2 ? toast("Elige dos o más fotos para el mosaico.", true) : addPhotos(f, at, "fila"));
    else if (type === "pano") pickFiles(true).then((f) => addPhotos(f, at, "pano"));
  },
  dropFiles(files, at) { addPhotos(files, at); },
  // Photos dropped from the computer on a photo of the page: they join it as a mosaic, on the side where they fell
  async dropFilesOn(files, t) {
    if (!files.length) return;
    const key = ED.blocks[t.i];   // the block may move while the photos are processed: find it again by itself
    toast(`Procesando ${files.length} foto${files.length > 1 ? "s" : ""}…`, false, 2500);
    const made = [];
    try { for (const f of files) made.push(await newPhoto(f)); } catch (e) { toast("No se pudo procesar la foto: " + e.message, true, 9000); if (!made.length) return; }
    let i = ED.blocks.indexOf(key); if (i < 0 && ["foto", "fila"].includes(ED.blocks[t.i]?.type)) i = t.i;
    mutate(() => {
      for (const m of made) ED.photos[m.id] = m.photo;
      if (i < 0) { ED.blocks.push(...made.map((m) => ({ type: "foto", id: m.id }))); return; }
      putNode(i, insertNode(nodeOfBlock(ED.blocks[i]), t.ref, t.side, made.map((m) => m.id)));
      ED.sel = { i, id: made[0].id }; ED.tab = "block";
    });
    toast("Listo: la foto entró al mosaico. Escribe su texto alternativo en el panel de la derecha.");
  },
  // A photo of the page dragged by its handle: onto another photo (mosaic), beside the text (floating) or between blocks
  movePhoto(src, t) {
    const sb = ED.blocks[src.i]; if (!sb) return;
    const id = src.id || sb.id;
    if (t.kind === "mosaic" && t.i === src.i && (t.ref === id || (sb.type === "foto"))) return;   // onto itself
    mutate(() => {
      const wasWrap = sb.type === "foto" ? sb.wrap : null;
      // 1. take the photo out of where it was (a single photo block goes away; a mosaic keeps the others)
      let removed;
      if (sb.type === "foto") { ED.blocks.splice(src.i, 1); removed = true; }
      else removed = !putNode(src.i, removeNode(nodeOfBlock(sb), id));
      const fix = (k) => (removed && k > src.i ? k - 1 : k);
      // 2. put it in its new place
      if (t.kind === "mosaic") {
        const i = fix(t.i), tb = ED.blocks[i];
        if (!tb || !(tb.type === "foto" || tb.type === "fila")) return;
        putNode(i, insertNode(nodeOfBlock(tb), t.ref, t.side, [id]));
        ED.sel = { i, id: ED.blocks[i].type === "fila" ? id : null };
      } else {
        const at = Math.min(fix(t.at), ED.blocks.length), nb = { type: "foto", id };
        if (t.side === "left" || t.side === "right") { nb.wrap = { side: t.side, size: wasWrap?.size || 40, hang: t.mode === "hang" }; if (t.mode === "edge") nb.wrap.edge = true; }
        ED.blocks.splice(at, 0, nb); ED.sel = { i: at };
      }
      ED.tab = "block";
    });
  },
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
      mutate(() => { const k = prev.items.length - 1; const caret = cdoc().defaultView.plainLen(prev.items[k] || ""); prev.items[k] = (prev.items[k] || "") + (prev.items[k] && cur.text ? " " : "") + cur.text; ED.blocks.splice(i, 1); ED.focus = { i: i - 1, caret, li: k }; ED.sel = { i: i - 1 }; S.lastCaret = i - 1; });
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
      const end = at + rest.length - 1; ED.sel = { i: Math.max(i, end) }; ED.focus = { i: Math.max(i, end) }; S.lastCaret = Math.max(i, end);
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
    clearTimeout(S.heroTimer);
    S.heroTimer = setTimeout(async () => { const h = ED.meta.hero; try {
      const r = await post("/api/hero-pos?" + new URLSearchParams({ article: ED.path, pos: h.pos || "50% 50%", zoom: h.zoom || 1 }), {});
      if (r && r.file && r.file !== ED.meta.hero.file) mutate(() => { ED.meta.hero.file = r.file; ED.heroV = Date.now(); });   // its own name if the folder is shared
    } catch (e) { toast(e.message, true); } }, 700);
  },
  undoKey(e) { e.key.toLowerCase() === "z" && !e.shiftKey ? undo() : redo(); },
};
export function setPath(o, path, v) { const k = path.split("."); let c = o; while (k.length > 1) { const n = k.shift(); c[n] = c[n] || {}; c = c[n]; } if (v === "" || v === undefined) delete c[k[0]]; else c[k[0]] = v; if (path === "youtube" && v) c.youtube = ytId(v); }
// "…google.com/maps/place/…/@30.42,-101.17,13z…", "…!3d30.42!4d-101.17…" or "30.42, -101.17" -> "30.42000,-101.17000"
export const coordsOf = (v) => {
  const s = String(v); const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? `${Number(m[1]).toFixed(5)},${Number(m[2]).toFixed(5)}` : s.trim();
};
export const ytId = (v) => { const m = String(v).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : String(v).trim(); };
