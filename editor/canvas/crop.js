// Dragging inside a photo: moving its crop.
import { A, E, posOf, ratioOf, root } from "./base.js";

// ---- dragging inside photos: move the crop, or resize it ------------------------------
root.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (e.target.closest(".rz")) return; // the resize handles have their own drag
  const handle = e.target.closest(".crop-handle");
  const frame = e.target.closest(".blk-media .ratio");
  if (!frame || !frame.dataset.id) return; // map and video frames have no photo to crop
  const S = E(),
    id = frame.dataset.id,
    p = S.photos[id],
    img = frame.querySelector("img");
  if (!p) return;
  const rect = frame.getBoundingClientRect();
  const item = frame.closest(".fila-item");
  e.preventDefault();
  frame.setPointerCapture(e.pointerId);
  A().select(Number(frame.closest(".blk").dataset.i), item ? id : null);
  const sx = e.clientX,
    sy = e.clientY;
  if (handle) {
    const w0 = rect.width,
      h0 = rect.height;
    let ratio = ratioOf(p);
    const move = (ev) => {
      const nh = Math.max(w0 / 4, Math.min(w0 / 0.5, h0 + (ev.clientY - sy)));
      ratio = Math.round((w0 / nh) * 1000) / 1000;
      frame.style.setProperty("--bs-aspect-ratio", (100 / ratio).toFixed(3) + "%");
      if (item) item.style.setProperty("--g", ratio.toFixed(3));
    };
    const up = () => {
      frame.removeEventListener("pointermove", move);
      frame.removeEventListener("pointerup", up);
      if (Math.abs(ratio - ratioOf(p)) > 0.001) A().setPhoto(id, { ratio }, false, true);
    };
    frame.addEventListener("pointermove", move);
    frame.addEventListener("pointerup", up);
    return;
  }
  frame.classList.add("is-dragging");
  const [px0, py0] = posOf(p)
    .split(" ")
    .map((v) => parseFloat(v));
  const fr = rect.width / rect.height,
    ir = p.w / p.h;
  let pos = posOf(p);
  const move = (ev) => {
    let px = px0,
      py = py0;
    if (ir > fr) {
      const over = rect.height * ir - rect.width;
      if (over > 1) px = px0 - ((ev.clientX - sx) / over) * 100;
    } else {
      const over = rect.width / ir - rect.height;
      if (over > 1) py = py0 - ((ev.clientY - sy) / over) * 100;
    }
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));
    pos = `${Math.round(px)}% ${Math.round(py)}%`;
    img.style.objectPosition = pos;
  };
  const up = () => {
    frame.classList.remove("is-dragging");
    frame.removeEventListener("pointermove", move);
    frame.removeEventListener("pointerup", up);
    if (pos !== posOf(p)) A().setPhoto(id, { pos }, false, true);
  };
  frame.addEventListener("pointermove", move);
  frame.addEventListener("pointerup", up);
});
