// Drag and drop: blocks, photos of the page and photos from the computer, with the pink mark of where they land.
import { A, E, ratioOf, root } from "./base.js";
import { cellBox } from "./mosaic.js";
import { contentBox } from "./sizes.js";

// ---- drag and drop ------------------------------------------------------------------------------
// Three things can be dragged onto the page: a block by its grip (to move it between blocks), a photo of the page by its
// grip ✥, and photos from the computer. Before they are dropped, a pink line or box shows where they will land:
//   onto a photo: it joins that photo as a mosaic, on the side of the photo where it falls; near the edge of a mosaic,
//     on that side of all its photos;
//   beside the text (only photos of the page): the photo floats on that side of the text; further out it hangs out to
//     the margin, or runs to the edge of the screen;
//   anywhere else: between two blocks, on its own row.
let dragFrom = null,
  dragPhoto = null,
  dragEl = null;
root.addEventListener("dragstart", (e) => {
  const g = e.target.closest(".item-grip, .blk-handle");
  if (!g) return;
  const blk = g.closest(".blk"),
    i = Number(blk.dataset.i),
    b = E().blocks[i];
  if (g.matches(".item-grip")) {
    const it = g.closest("[data-item]");
    dragPhoto = { i, id: it.dataset.item };
    dragEl = it;
  } else if (b && b.type === "foto") {
    dragPhoto = { i, id: b.id };
    dragEl = blk;
  } else {
    dragFrom = i;
    dragEl = blk;
  }
  e.dataTransfer.setData("text/x-relieve", "1");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setDragImage(dragPhoto ? dragEl.querySelector(".ratio") || dragEl : dragEl, 20, 20);
  const el = dragEl;
  setTimeout(() => el.classList.add("blk-dragging"), 0);
  e.stopPropagation();
});
export const endDrag = () => {
  dragFrom = null;
  dragPhoto = null;
  dragEl = null;
  showDrop(null);
  document.body.classList.remove("is-file-drag");
  document.querySelectorAll(".blk-dragging,.is-drop").forEach((n) => n.classList.remove("blk-dragging", "is-drop"));
};
root.addEventListener("dragend", endDrag);

export const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
export function nearestBar(y) {
  let best = null,
    d = 1e9;
  document.querySelectorAll(".article-body .ins:not(.ins-under)").forEach((b) => {
    const r = b.getBoundingClientRect();
    const dd = Math.abs(r.top - y);
    if (dd < d) {
      d = dd;
      best = b;
    }
  });
  return best;
}
// Onto a photo or a mosaic: which photo, and which of its sides (left, right, top, bottom). Floating photos and panoramas
// do not take other photos.
export function photoTarget(x, y, src) {
  const el = document.elementFromPoint(x, y),
    blk = el && el.closest(".article-body > .blk");
  if (!blk) return null;
  const i = Number(blk.dataset.i),
    b = E().blocks[i];
  if (!b || !(b.type === "fila" || (b.type === "foto" && !(b.wrap && b.wrap.side)))) return null;
  const items =
    b.type === "foto"
      ? [{ id: b.id, r: blk.querySelector(".ratio")?.getBoundingClientRect() }]
      : [...blk.querySelectorAll(".fila-item[data-item]")].map((it) => ({ id: it.dataset.item, r: cellBox(it) }));
  if (!items.length || !items[0].r) return null;
  const R = {
    left: Math.min(...items.map((o) => o.r.left)),
    right: Math.max(...items.map((o) => o.r.right)),
    top: Math.min(...items.map((o) => o.r.top)),
    bottom: Math.max(...items.map((o) => o.r.bottom)),
  };
  R.width = R.right - R.left;
  R.height = R.bottom - R.top;
  if (x < R.left - 4 || x > R.right + 4 || y < R.top - 4 || y > R.bottom + 4) return null; // e.g. over a caption: between blocks instead
  if (src && src.i === i && b.type === "foto") return { kind: "none" }; // a photo onto itself
  const many = items.length > 1;
  let side = null,
    ref = "root",
    box = R;
  if (many) {
    // a band along the top or the bottom of the whole mosaic: a new row above or below all the photos
    const bh = Math.min(36, Math.max(16, R.height * 0.09));
    if (y < R.top + bh) side = "top";
    else if (y > R.bottom - bh) side = "bottom";
  }
  if (!side) {
    // the photo under the pointer (or the nearest one, in a gap), and its nearest side
    let best = null,
      bd = Infinity;
    for (const it of items) {
      const r = it.r,
        d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    const r = best.r,
      fx = (x - r.left) / r.width,
      fy = (y - r.top) / r.height,
      ds = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
    side = Object.keys(ds).reduce((a, k) => (ds[k] < ds[a] ? k : a));
    if (src && src.i === i && best.id === src.id) return { kind: "none" };
    if (many) {
      ref = best.id;
      box = r;
    }
  }
  return { kind: "mosaic", i, ref, side, box, all: many && ref === "root", items };
}
// Between two blocks; a photo of the page dragged beside the text floats on that side
export function barTarget(x, y, canFloat) {
  const bar = nearestBar(y);
  if (!bar) return null;
  const at = Number(bar.dataset.at);
  if (canFloat) {
    const C = contentBox(),
      colL = C.x0 + (C.defL / 100) * C.cw,
      colR = C.x0 + (C.defR / 100) * C.cw,
      colW = colR - colL;
    const side = x < colL + colW * 0.28 ? "left" : x > colR - colW * 0.28 ? "right" : null;
    if (side && innerWidth >= 768) {
      const W = document.documentElement.clientWidth,
        margin = (W - C.cw) / 2,
        dist = side === "right" ? W - x : x;
      const mode = dist < 70 ? "edge" : margin > 110 && dist < margin + 40 ? "hang" : "in";
      return { kind: "bar", at, side, mode, bar, C, colL, colR };
    }
  }
  return { kind: "bar", at, side: "center", bar };
}
export function dropTarget(x, y, src) {
  const el = document.elementFromPoint(x, y);
  if (el && el.closest("[data-hero], .ed-hero-wrap")) return src ? { kind: "none" } : null;
  return photoTarget(x, y, src) || barTarget(x, y, !!src);
}
// The pink line or box, with a short label of what will happen
let ind = null;
export function showDrop(t, ratio = 1.5) {
  document.querySelectorAll(".is-drop").forEach((n) => n.classList.remove("is-drop"));
  if (!ind) {
    ind = document.createElement("div");
    ind.className = "drop-ind";
    ind.innerHTML = '<span class="drop-tag"></span>';
    document.body.appendChild(ind);
  }
  if (!t || t.kind === "none") {
    ind.hidden = true;
    return;
  }
  let r,
    label,
    boxy = false;
  if (t.kind === "mosaic") {
    const b = t.box,
      L = 6;
    r =
      t.side === "left"
        ? [b.left - L / 2, b.top, L, b.height]
        : t.side === "right"
          ? [b.right - L / 2, b.top, L, b.height]
          : t.side === "top"
            ? [b.left, b.top - L / 2, b.width, L]
            : [b.left, b.bottom - L / 2, b.width, L];
    // dropped in the gap between two photos: say so
    // dropped in the gap between two photos: the line goes in the middle of the gap, and says so
    // (only a neighbour in the same row, or the same column: same top and bottom, or same left and right edges)
    const sameRow = (o) => Math.abs(o.r.top - b.top) < 4 && Math.abs(o.r.bottom - b.bottom) < 4,
      sameCol = (o) => Math.abs(o.r.left - b.left) < 4 && Math.abs(o.r.right - b.right) < 4;
    const nb = t.all
      ? null
      : t.items.find((o) => {
          if (t.side === "left") return Math.abs(o.r.right - b.left) < 30 && sameRow(o);
          if (t.side === "right") return Math.abs(o.r.left - b.right) < 30 && sameRow(o);
          if (t.side === "top") return Math.abs(o.r.bottom - b.top) < 30 && sameCol(o);
          return Math.abs(o.r.top - b.bottom) < 30 && sameCol(o);
        });
    const between = !!nb;
    if (nb) {
      if (t.side === "left") r[0] = (nb.r.right + b.left) / 2 - L / 2;
      else if (t.side === "right") r[0] = (b.right + nb.r.left) / 2 - L / 2;
      else if (t.side === "top") r[1] = (nb.r.bottom + b.top) / 2 - L / 2;
      else r[1] = (b.bottom + nb.r.top) / 2 - L / 2;
    }
    const single = t.items.length === 1;
    label = t.all
      ? {
          top: "Arriba de todas las fotos",
          bottom: "Debajo de todas las fotos",
          left: "A la izquierda de todas",
          right: "A la derecha de todas",
        }[t.side]
      : between
        ? "Entre estas fotos"
        : {
            left: "A la izquierda de esta foto",
            right: "A la derecha de esta foto",
            top: "Encima de esta foto",
            bottom: "Debajo de esta foto",
          }[t.side];
    if (single) label = "Mosaico: " + label.charAt(0).toLowerCase() + label.slice(1);
  } else if (t.side === "center") {
    t.bar.classList.add("is-drop");
    const br = t.bar.getBoundingClientRect();
    r = [br.left, br.top - 2, br.width, 4];
    label = "Aquí, en su propia fila";
  } else {
    boxy = true;
    const C = t.C,
      colW = t.colR - t.colL,
      W = document.documentElement.clientWidth,
      y0 = t.bar.getBoundingClientRect().top;
    const w = t.mode === "hang" ? C.cw * 0.4 : colW * 0.4,
      outer = t.mode === "edge" ? 0 : t.mode === "hang" ? C.x0 : t.colL;
    const width = t.mode === "edge" ? t.colL + colW * 0.4 : w,
      h = Math.max(80, Math.min(360, width / ratio));
    r = t.side === "left" ? [outer, y0, width, h] : [W - outer - width, y0, width, h];
    if (t.side === "right" && t.mode === "in") r[0] = t.colR - width;
    label =
      (t.side === "left" ? "Flota a la izquierda del texto" : "Flota a la derecha del texto") +
      (t.mode === "hang" ? ", hasta el margen" : t.mode === "edge" ? ", hasta el borde" : "");
  }
  ind.hidden = false;
  ind.classList.toggle("is-box", boxy);
  Object.assign(ind.style, { left: r[0] + "px", top: r[1] + "px", width: r[2] + "px", height: r[3] + "px" });
  ind.firstChild.textContent = label;
}
document.addEventListener("dragenter", (e) => {
  if (isFiles(e)) document.body.classList.add("is-file-drag");
});
document.addEventListener("dragover", (e) => {
  const files = isFiles(e);
  if (dragFrom === null && !dragPhoto && !files) return;
  e.preventDefault();
  if (dragFrom !== null) {
    showDrop(null);
    nearestBar(e.clientY)?.classList.add("is-drop");
    return;
  }
  const t = dropTarget(e.clientX, e.clientY, files ? null : dragPhoto);
  const p = dragPhoto && E().photos[dragPhoto.id];
  showDrop(t, p ? ratioOf(p) : 1.5);
});
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) {
    document.body.classList.remove("is-file-drag");
    showDrop(null);
  }
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  document.body.classList.remove("is-file-drag");
  const files = isFiles(e),
    src = dragPhoto,
    from = dragFrom;
  const t = from === null ? dropTarget(e.clientX, e.clientY, files ? null : src) : null;
  endDrag();
  if (from !== null) {
    const bar = nearestBar(e.clientY);
    if (bar) A().moveTo(from, Number(bar.dataset.at));
    return;
  }
  if (src) {
    if (!t || t.kind === "none") return;
    A().movePhoto(
      src,
      t.kind === "mosaic"
        ? { kind: "mosaic", i: t.i, ref: t.ref, side: t.side }
        : { kind: "bar", at: t.at, side: t.side, mode: t.mode },
    );
    return;
  }
  if (files) {
    const list = [...e.dataTransfer.files].filter(
      (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|tif?f)$/i.test(f.name),
    );
    if (!list.length) return;
    if (e.target.closest && e.target.closest("[data-hero]")) A().setHeroFile(list[0]);
    else if (t && t.kind === "mosaic") A().dropFilesOn(list, { i: t.i, ref: t.ref, side: t.side });
    else {
      const bar = t && t.bar ? t.bar : nearestBar(e.clientY);
      A().dropFiles(list, bar ? Number(bar.dataset.at) : E().blocks.length);
    }
  }
});
