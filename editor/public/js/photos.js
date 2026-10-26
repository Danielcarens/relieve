// Choosing and uploading photos and the cover.
import { api } from "./env.js";
import { mutate } from "./state.js";
import { ED } from "./store.js";
import { $, toast } from "./util.js";
// ---- uploads ---------------------------------------------------------------------------
export function pickFiles(multiple) {
  return new Promise((res) => { const f = $("#file"); f.multiple = !!multiple; f.value = ""; f.onchange = () => res([...f.files]); f.click(); });
}
export async function upload(file, kind = "photo", pos) {
  const q = new URLSearchParams({ article: ED.path, name: file.name, kind }); if (pos) q.set("pos", pos);
  return api("/api/photo?" + q, { method: "POST", body: file });
}
export async function newPhoto(file) {
  const r = await upload(file);
  const photo = { file: r.file, w: r.w, h: r.h, alt: "", caption: "" };
  if (r.w / r.h > 2.2) photo.focus = 50;
  return { id: r.file, photo, pano: r.w / r.h > 2.2 };
}
export async function addPhotos(files, at, as) {
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
export async function setHeroFile(file) {
  toast("Procesando la foto principal…", false, 2500);
  try {
    const r = await upload(file, "hero", "50% 50%");
    mutate(() => { ED.meta.hero = { ...(ED.meta.hero || {}), file: r.file, w: r.w, h: r.h, srcW: r.srcW, srcH: r.srcH, pos: r.pos, alt: ED.meta.hero?.alt || "", caption: ED.meta.hero?.caption || "" }; delete ED.meta.hero.zoom; ED.heroV = Date.now(); ED.tab = "article"; });
    toast("Foto principal lista. Arrástrala para encuadrarla.");
  } catch (e) { toast("No se pudo procesar: " + e.message, true, 9000); }
}
