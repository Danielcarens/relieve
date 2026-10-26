// Mosaics on the page: the bars between photos and the handle under them.
import { A, E, nearest, ratioOf, root } from "./base.js";
import { caption, patchGrid } from "./blocks.js";
import { blkOf } from "./markdown.js";
import { photoEdges, showGuide, showGuideH } from "./sizes.js";
// Mosaics: the pink handle under a mosaic changes its height (every crop by the same factor). A pink bar between two
// photos, or two groups of photos, moves the border between them: one side grows and the other shrinks by the same
// amount, so the rest of the mosaic does not move. The border sticks to the edges of the other photos.
export const leavesOf = (n) => (Array.isArray(n) ? n.flatMap(leavesOf) : [n]);
export const nodeAt = (t, cp) => (cp === "" ? t : cp.split(".").reduce((a, k) => a[Number(k)], t));
export const cellBox = (el) => (el.matches(".fila-item") ? el.querySelector(".ratio") : el).getBoundingClientRect();   // a photo's frame, without its caption
export function layoutRows() {
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
export const clampR = (r) => Math.round(Math.max(0.2, Math.min(8, r)) * 1000) / 1000;
export function patchRatios(row, ratios) {
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
