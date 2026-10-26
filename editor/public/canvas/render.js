// Drawing the whole page (window.render, called by the editor after every change).
import { $, E, fitAll, root } from "./base.js";
import { blockHTML, ins } from "./blocks.js";
import { heroHTML } from "./hero.js";
import { placeCaret } from "./markdown.js";
import { layoutRows } from "./mosaic.js";
export function render() {
  const S = E(); if (!S || !S.meta) { root.innerHTML = ""; return; }
  const y = scrollY;
  let html = heroHTML(S) + `<main><div class="article-body">${ins(0)}`;
  S.blocks.forEach((b, i) => { html += blockHTML(b, i, S) + ins(i + 1); });
  html += `</div><div class="drop-overlay">Sobre una foto: forman un mosaico · Entre dos bloques: una foto sola</div></main>`;
  root.innerHTML = html;
  fitAll(); layoutPanos(); layoutRows(); scrollTo(0, y);
  if (S.focus) {
    const f = S.focus; S.focus = null;
    let t = (f.field && $(`.blk[data-i="${f.i}"] [data-f]`)) || $(`[data-t="${f.i}"]`) || $(`[data-l="${f.i}"]`) || $(`.blk[data-i="${f.i}"] [data-f]`);
    if (t) { t.focus(); const target = t.matches(".ed-list") ? t.children[f.li ?? (f.caret === undefined ? t.children.length - 1 : 0)] || t : t; placeCaret(target, f.caret); }
  }
}
window.render = render;

export function layoutPanos() {
  document.querySelectorAll("[data-pano] .pano-scroll").forEach((sc) => {
    const img = sc.querySelector("img"); const fig = sc.closest("[data-pano]");
    const set = () => { fig.style.setProperty("--pano-min", Math.ceil(fig.clientWidth / (img.width / img.height)) + "px");
      const f = Number(fig.dataset.focus) / 100; sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * f; };
    img.complete ? set() : img.addEventListener("load", set, { once: true });
  });
}
addEventListener("resize", () => { fitAll(); layoutPanos(); layoutRows(); });
// The title box measures its height with the page's fonts: measure again once they have loaded
if (document.fonts) { document.fonts.ready.then(fitAll); document.fonts.addEventListener("loadingdone", fitAll); }
