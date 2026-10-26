// The article canvas. Lives in an iframe so the site's CSS sees the real width (desktop or phone).
// One module per part, in canvas/ (see the first line of each). The order of the imports is the order the page's
// event listeners are added in, as when it was one file.
import "./markdown.js";
import "./blocks.js";
import "./hero.js";
import "./mosaic.js";
import "./clicks.js";
import "./typing.js";
import "./crop.js";
import "./drag.js";
import "./sizes.js";
import { PREVIEW, root } from "./base.js";
import { render } from "./render.js";
// ---- preview mode (web editor's "Vista previa"): the same page without editing aids ----
if (PREVIEW) {
  document.documentElement.classList.add("is-preview");
  for (const ev of ["pointerdown", "click", "keydown", "input", "paste", "dragstart", "drop", "focusin"]) document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest(".pano-scroll")) { e.stopPropagation(); if (ev !== "pointerdown" && ev !== "focusin") e.preventDefault(); } }, true);
  const lock = () => document.querySelectorAll("[contenteditable]").forEach((n) => n.setAttribute("contenteditable", "false"));
  new MutationObserver(lock).observe(document.getElementById("root"), { childList: true, subtree: true }); lock();
  render();   // nobody else draws this frame: the main canvas is redrawn by the editor, this copy only once
  document.querySelectorAll("textarea").forEach((t) => (t.readOnly = true));
}
