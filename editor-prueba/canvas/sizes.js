// Sizes by dragging: floating photos to the edge, free text width, a photo's handles, panorama and space heights.
import { $, A, E, nearest, ratioOf, root } from "./base.js";
import { WIDE, boxVars } from "./blocks.js";

// ---- drag a floating photo by its side handle: dentro de la columna / hasta el margen / hasta el borde de la pantalla ----
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".edge-handle");
  if (!h || e.button !== 0) return;
  e.preventDefault();
  h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"),
    i = Number(blk.dataset.i),
    body = $(".article-body");
  const W = document.documentElement.clientWidth;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cw-inner)";
  body.appendChild(probe);
  const margin = (W - probe.offsetWidth) / 2;
  probe.remove();
  A().select(i, null);
  let res = null;
  const move = (ev) => {
    const x = ev.clientX,
      side = x < W / 2 ? "left" : "right",
      dist = side === "right" ? W - x : x;
    const mode = dist < 70 ? "edge" : margin > 110 && dist < margin + 40 ? "hang" : "in";
    res = { side, mode };
    blk.classList.remove("wrap-left", "wrap-right", "wrap-hang", "wrap-edge");
    blk.classList.add("wrap-" + side);
    if (mode === "edge") blk.classList.add("wrap-edge");
    else if (mode === "hang") blk.classList.add("wrap-hang");
  };
  const up = () => {
    h.removeEventListener("pointermove", move);
    h.removeEventListener("pointerup", up);
    if (res) A().setWrapMode(i, res.side, res.mode);
  };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", up);
});

// ---- text width: drag the side edges of a paragraph, title, list or text box ----
// Edges are a share (0-100) of the content width, the width of single photos. They snap to its two margins (the photos'),
// to the edges of the reading column and to the centre; double-click an edge to go back to the normal width.
export function contentBox() {
  const body = $(".article-body"),
    br = body.getBoundingClientRect();
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cw-inner)";
  body.appendChild(probe);
  const cw = probe.offsetWidth;
  probe.remove();
  const col = Math.min(46 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16), br.width - 24);
  const x0 = br.left + (br.width - cw) / 2;
  return {
    x0,
    cw,
    defL: (((br.width - col) / 2 - (br.width - cw) / 2) / cw) * 100,
    defR: (((br.width + col) / 2 - (br.width - cw) / 2) / cw) * 100,
  };
}
let guide = null;
export const showGuide = (x) => {
  if (!guide) {
    guide = document.createElement("div");
    guide.className = "snap-guide";
    document.body.appendChild(guide);
  }
  guide.style.left = x + "px";
  guide.hidden = x == null;
};
let guideH = null;
export const showGuideH = (y) => {
  if (!guideH) {
    guideH = document.createElement("div");
    guideH.className = "snap-guide snap-guide-h";
    document.body.appendChild(guideH);
  }
  guideH.style.top = y + "px";
  guideH.hidden = y == null;
};
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".box-handle");
  if (!h || e.button !== 0) return;
  e.preventDefault();
  h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"),
    i = Number(blk.dataset.i),
    side = h.dataset.side,
    b = E().blocks[i];
  const C = contentBox(),
    rect = blk.getBoundingClientRect();
  // what an edge can stick to (page x): the photos' margins, the text column, the centre and the edges of everything else
  const xs = [
    C.x0,
    C.x0 + C.cw,
    C.x0 + (C.defL / 100) * C.cw,
    C.x0 + (C.defR / 100) * C.cw,
    C.x0 + C.cw / 2,
    ...photoEdges(blk),
  ];
  A().select(i, null);
  if (h.dataset.float) {
    // floating card or quote: the inner edge sets its width (a share of the text column, or of the photos' width when it hangs out)
    const col = ((C.defR - C.defL) / 100) * C.cw,
      base = b.wrap.hang ? C.cw : col,
      edgePx = b.wrap.edge ? rect.width - (col * (b.wrap.size || 40)) / 100 : 0;
    let size = b.wrap.size || 40;
    const move = (ev) => {
      let x = ev.clientX;
      const t = nearest(x, xs, 12);
      if (t != null) x = t;
      const w = side === "l" ? rect.right - x : x - rect.left;
      size = Math.round(Math.max(15, Math.min(70, ((w - edgePx) / base) * 100)));
      blk.style.setProperty("--ws", size / 100);
      showGuide(t);
    };
    const up = () => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      showGuide(null);
      if (size !== (b.wrap.size || 40)) A().setPhotoFrame(i, { size });
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    return;
  }
  // edges as numbers while dragging; an edge left on the reading column is stored as "texto"
  let l = ((rect.left - C.x0) / C.cw) * 100,
    r = ((rect.right - C.x0) / C.cw) * 100,
    moved = false;
  let lv = b.box ? b.box.l : null,
    rv = b.box ? b.box.r : null;
  const isCol = (x) =>
    Math.abs(x - (C.x0 + (C.defL / 100) * C.cw)) < 0.5 || Math.abs(x - (C.x0 + (C.defR / 100) * C.cw)) < 0.5;
  const move = (ev) => {
    moved = true;
    let x = ev.clientX;
    const t = nearest(x, xs, 12);
    if (t != null) x = t;
    const v = ((x - C.x0) / C.cw) * 100;
    if (side === "l") {
      l = Math.max(0, Math.min(r - 15, v));
      lv = t != null && isCol(t) ? "texto" : Math.round(l * 10) / 10;
    } else {
      r = Math.min(100, Math.max(l + 15, v));
      rv = t != null && isCol(t) ? "texto" : Math.round(r * 10) / 10;
    }
    const cur = {
      l: lv ?? (Math.abs(l - C.defL) < 0.3 ? "texto" : Math.round(l * 10) / 10),
      r: rv ?? (Math.abs(r - C.defR) < 0.3 ? "texto" : Math.round(r * 10) / 10),
    };
    blk.classList.add("has-box");
    blk.style.cssText = boxVars(cur);
    blk.dataset.box = JSON.stringify(cur);
    showGuide(t);
  };
  const up = () => {
    h.removeEventListener("pointermove", move);
    h.removeEventListener("pointerup", up);
    showGuide(null);
    if (!moved) return;
    const box = JSON.parse(blk.dataset.box);
    const normal = WIDE.includes(b.type) ? box.l === 0 && box.r === 100 : box.l === "texto" && box.r === "texto";
    A().setBox(i, normal ? null : box);
  };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", up);
});
root.addEventListener("dblclick", (e) => {
  const h = e.target.closest(".box-handle");
  if (!h) return;
  const i = Number(h.closest(".blk").dataset.i);
  if (h.dataset.float) A().setPhotoFrame(i, { size: 40 });
  else A().setBox(i, null);
});

// ---- resize a photo by its handles ----------------------------------------------------------
// Left and right edges of everything else on the page: each photo (also inside rows), paragraphs and titles (their
// column or free width), text boxes, cards, quotes, facts rows, videos, maps, floating blocks… in page coordinates
export function photoEdges(except) {
  const xs = [],
    add = (el) => {
      if (!el || (except && except.contains(el))) return;
      const b = el.getBoundingClientRect();
      if (b.width > 8) xs.push(b.left, b.right);
    };
  document.querySelectorAll(".article-body .ratio").forEach(add);
  document.querySelectorAll(".article-body > .blk").forEach((blk) => {
    if (blk === except || blk.classList.contains("blk-pano") || blk.classList.contains("blk-space")) return;
    add(
      blk.querySelector(
        ":scope > .container > figure, :scope > .container > .datos-wrap, :scope > .container > .fila, :scope > .container > dl",
      ) || blk,
    );
    blk.querySelectorAll(".recuadro, .ficha, .ed-desplegable, .ed-btn").forEach(add);
  });
  return xs;
}
export const photoHeights = (except) =>
  [...document.querySelectorAll(".article-body .ratio")]
    .filter((r) => !(except && except.contains(r)))
    .map((r) => r.getBoundingClientRect().height)
    .filter(Boolean);
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".rz");
  if (!h || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"),
    i = Number(blk.dataset.i),
    S = E(),
    b = S.blocks[i],
    frame = h.closest(".ratio"),
    p = S.photos[b.id];
  const k = h.dataset.rz,
    hx = k.includes("l") ? "l" : k.includes("r") ? "r" : null,
    vy = k.includes("t") ? "t" : k.includes("b") ? "b" : null;
  const C = contentBox(),
    rect = frame.getBoundingClientRect(),
    r0 = ratioOf(p),
    sx = e.clientX,
    sy = e.clientY;
  const float = b.wrap && b.wrap.side ? b.wrap : null;
  const xs = [
    C.x0,
    C.x0 + C.cw,
    C.x0 + C.cw / 2,
    C.x0 + (C.defL / 100) * C.cw,
    C.x0 + (C.defR / 100) * C.cw,
    ...photoEdges(blk),
  ];
  const hs = photoHeights(blk);
  // a floating photo's width is a share of the text column (or of the photos' width when it hangs out); "borde" adds the margin
  const col = (C.defR / 100) * C.cw - (C.defL / 100) * C.cw,
    edgePx = float && float.edge ? rect.width - (col * (float.size || 40)) / 100 : 0;
  A().select(i, null);
  let L = rect.left,
    R = rect.right,
    H = rect.height,
    out = null;
  const move = (ev) => {
    let snapX = null;
    if (hx) {
      let x = (hx === "l" ? rect.left : rect.right) + (ev.clientX - sx);
      const t = nearest(x, xs, 10);
      if (t != null) {
        x = t;
        snapX = t;
      }
      if (hx === "l") L = Math.min(x, R - 120);
      else R = Math.max(x, L + 120);
    }
    const W = R - L;
    if (vy) {
      H = Math.max(60, rect.height + (vy === "b" ? 1 : -1) * (ev.clientY - sy));
      const th = nearest(H, hs, 8);
      if (th != null) H = th;
    } else H = W / r0; // only the width: the photo keeps its shape
    const ratio = Math.round(Math.max(0.4, Math.min(5, W / H)) * 1000) / 1000;
    frame.style.setProperty("--bs-aspect-ratio", (100 / ratio).toFixed(3) + "%");
    if (float) {
      const base = float.hang ? C.cw : col,
        size = Math.round(Math.max(15, Math.min(70, ((W - edgePx) / base) * 100)));
      blk.style.setProperty("--ws", size / 100);
      out = { ratio, size };
    } else {
      const l = Math.max(0, ((L - C.x0) / C.cw) * 100),
        r = Math.min(100, ((R - C.x0) / C.cw) * 100);
      const tok = (v, side) =>
        Math.abs(v - (side === "l" ? C.defL : C.defR)) < 0.3 ? "texto" : Math.round(v * 10) / 10;
      const box = { l: tok(l, "l"), r: tok(r, "r") };
      if (hx) {
        blk.classList.add("has-box");
        blk.style.cssText = boxVars(box);
      }
      out = { ratio, box: hx ? box : undefined };
    }
    showGuide(snapX);
  };
  const up = () => {
    h.removeEventListener("pointermove", move);
    h.removeEventListener("pointerup", up);
    showGuide(null);
    if (out) {
      if (out.box && out.box.l === 0 && out.box.r === 100) out.box = null;
      A().setPhotoFrame(i, out);
    }
  };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", up);
});

// ---- drag the pink bar under a panorama or a spacer to change its height ----
root.addEventListener("pointerdown", (e) => {
  const h = e.target.closest(".size-handle");
  if (!h || e.button !== 0) return;
  e.preventDefault();
  h.setPointerCapture(e.pointerId);
  const blk = h.closest(".blk"),
    i = Number(blk.dataset.i),
    kind = h.dataset.size,
    sy = e.clientY;
  A().select(i, null);
  const el = kind === "pano" ? blk.querySelector(".pano") : blk.querySelector(".ed-space");
  const box = kind === "pano" ? blk.querySelector(".pano-scroll") : el;
  const h0 = box.getBoundingClientRect().height,
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let val = null;
  const move = (ev) => {
    const nh = Math.max(8, h0 + ev.clientY - sy);
    if (kind === "pano") {
      val = Math.round(Math.min(90, Math.max(25, (nh / innerHeight) * 100)));
      el.style.setProperty("--pano-limit", `clamp(12rem, ${val}vh, ${(val * 0.68).toFixed(1)}rem)`);
    } else {
      val = Math.round(Math.min(16, Math.max(0.5, nh / rem)) * 2) / 2;
      el.style.height = val + "rem";
      el.querySelector("span").textContent = `Espacio · ${val} rem`;
    }
  };
  const up = () => {
    h.removeEventListener("pointermove", move);
    h.removeEventListener("pointerup", up);
    if (val != null) A().setField(i, kind === "pano" ? "h" : "size", val, true);
  };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", up);
});
