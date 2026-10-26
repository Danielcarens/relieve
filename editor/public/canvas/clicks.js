// Clicks on the page: the + menus (also the one under a floating photo), block tools, selecting.
import { A, E, root } from "./base.js";
import { ins } from "./blocks.js";
// Where "below this floating block" is: before the first block that already starts below it (the text beside it,
// and a paragraph that runs past its bottom, stay before).
export function afterFloat(i) {
  const f = document.querySelector(`.blk[data-i="${i}"]`); if (!f) return i + 1;
  const bottom = f.getBoundingClientRect().bottom - 1;
  for (const el of document.querySelectorAll(".article-body > .blk")) {
    const k = Number(el.dataset.i); if (k <= i) continue;
    if (el.getBoundingClientRect().top >= bottom) return k;
  }
  return E().blocks.length;
}

// ---- events ------------------------------------------------------------------
let openMenu = null;
export const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu.closest(".ins")?.classList.remove("is-open"); openMenu = null; } };

root.addEventListener("click", (e) => {
  const t = e.target;
  const insBtn = t.closest(".ins > button");
  if (insBtn) {
    const bar = insBtn.parentElement; const was = openMenu && openMenu.parentElement === bar; closeMenu(); if (was) return;
    if (bar.dataset.under) bar.dataset.at = afterFloat(Number(bar.closest(".blk").dataset.i));
    const m = document.createElement("div"); m.className = "ins-menu";
    m.innerHTML = (parent.INSERT_MENU || []).map(([k, l]) => (k ? `<button data-add="${k}">${l}</button>` : `<h6>${l}</h6>`)).join("");
    bar.appendChild(m); bar.classList.add("is-open"); openMenu = m; return;
  }
  const add = t.closest("[data-add]");
  if (add) { const bar = add.closest(".ins"), at = Number(bar.dataset.at); closeMenu(); A().add(add.dataset.add, at, { under: !!bar.dataset.under }); return; }
  closeMenu();
  const hero = t.closest("[data-hero]");
  if (hero && (t.closest('[data-hero="replace"]') || hero.dataset.hero === "pick")) { A().pickHero(); return; }
  if (t.closest("[data-byline]")) { A().focusArticle("m.author"); return; }
  if (t.closest('[data-a="float-up"]')) { A().tool("up", Number(t.closest(".blk").dataset.i)); return; }
  if (t.closest(".rq-line-hit")) { A().cycleLine(Number(t.closest(".blk").dataset.i)); return; }
  const tool = t.closest(".blk-tools button");
  if (tool) { const i = Number(tool.closest(".blk").dataset.i); A().tool(tool.dataset.a, i); return; }
  if (!t.closest(".blk") && t.closest(".article-body") && e.clientY > ([...document.querySelectorAll(".article-body > .blk")].pop()?.getBoundingClientRect().bottom ?? Infinity)) { A().continueAtEnd(); return; }
  const blk = t.closest(".blk");
  if (blk) {
    const item = t.closest("[data-item]");
    A().select(Number(blk.dataset.i), item ? item.dataset.item : null);
  } else A().select(null);
});

