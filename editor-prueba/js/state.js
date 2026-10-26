// Changing the article: one undoable step at a time (mutate), undo / redo, and saving.
import { TEXTY } from "./config.js";
import { api, post } from "./env.js";
import { findReplace, updateCount } from "./ribbon.js";
import { ED, S } from "./store.js";
import { $, toast } from "./util.js";
import { refresh } from "./views.js";

// ---- history / saving --------------------------------------------------------------
export const snap = () => JSON.stringify({ meta: ED.meta, photos: ED.photos, fichas: ED.fichas, blocks: ED.blocks });
export function restore(s) {
  const o = JSON.parse(s);
  ED.meta = o.meta;
  ED.photos = o.photos;
  ED.fichas = o.fichas || {};
  ED.blocks = o.blocks;
  const i = Math.min(S.lastCaret ?? -1, ED.blocks.length - 1);
  ED.sel = i >= 0 ? { i } : null;
  if (i >= 0 && TEXTY.includes(ED.blocks[i].type)) ED.focus = { i };
  refresh();
  markDirty();
}
export function mutate(fn, { typing = false } = {}) {
  const before = snap();
  fn();
  const now = Date.now();
  if (!typing || now - S.lastType > 1200) {
    S.hist.push(before);
    if (S.hist.length > 200) S.hist.shift();
    S.fut = [];
  }
  S.lastType = typing ? now : 0;
  markDirty();
  if (!typing) refresh();
  updateUndo();
}
export function updateUndo() {
  $("#undo").disabled = !S.hist.length;
  $("#redo").disabled = !S.fut.length;
}
export function undo() {
  if (!S.hist.length) return;
  S.fut.push(snap());
  restore(S.hist.pop());
  updateUndo();
}
export function redo() {
  if (!S.fut.length) return;
  S.hist.push(snap());
  restore(S.fut.pop());
  updateUndo();
}
export function markDirty() {
  S.dirty = true;
  setState("Sin guardar");
  updateCount();
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(save, 1200);
}
export function setState(t) {
  $("#save-state").textContent = t;
}
export async function save() {
  clearTimeout(S.saveTimer);
  if (!ED.path || !S.dirty) return;
  if (S.saving) {
    S.saveTimer = setTimeout(save, 400);
    return;
  }
  S.saving = true;
  setState("Guardando…");
  S.dirty = false;
  try {
    const r = await post("/api/article", {
      path: ED.path,
      meta: ED.meta,
      photos: ED.photos,
      fichas: ED.fichas,
      blocks: ED.blocks,
    });
    ED.problems = r.problems;
    setState(S.dirty ? "Sin guardar" : "Guardado");
  } catch (e) {
    S.dirty = true;
    setState("Sin guardar");
    toast("No se pudo guardar: " + e.message, true);
  }
  S.saving = false;
}
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h" && ED.meta) {
    e.preventDefault();
    findReplace();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  } else if (
    (e.ctrlKey || e.metaKey) &&
    !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) &&
    ["z", "y"].includes(e.key.toLowerCase())
  ) {
    e.preventDefault();
    e.key.toLowerCase() === "z" && !e.shiftKey ? undo() : redo();
  }
});
addEventListener("beforeunload", (e) => {
  if (S.dirty || S.saving) {
    e.preventDefault();
    e.returnValue = "";
  }
});
