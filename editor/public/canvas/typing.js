// Typing: text and fields, Word keys (Enter, Backspace, arrows), shortcuts, pasting, the selection the ribbon formats.
import { A, E, esc, fit, root } from "./base.js";
import { blkOf, blockIndex, caretParts, fieldOf, htmlToBlocks, inlineMd, listItems, mdToHtml, placeCaret, richMd, richMdMulti, richOf } from "./markdown.js";
root.addEventListener("input", (e) => {
  const f = fieldOf(e.target);
  if (f) {
    if (!f.textContent) f.innerHTML = "";
    const v = f.matches(".ed-inline") ? inlineMd(f) : f.textContent.replace(/\s+/g, " ").trim(), d = f.dataset;
    if (d.f) { const [i, key] = d.f.split(":"); A().setField(Number(i), key, v); }
    else if (d.cap) A().setPhoto(d.cap, { caption: v }, true);
    else if (d.m) A().setMeta(d.m, v || undefined, true);
    else if (d.ff) { const [id, path] = d.ff.split(":"); A().setFicha(id, path, v); }
    return;
  }
  const rt = richOf(e.target);
  if (rt && rt.matches(".ed-list")) {
    if (![...rt.children].some((n) => n.tagName === "LI")) { const txt = rt.textContent; rt.innerHTML = `<li>${esc(txt)}</li>`; placeCaret(rt.firstChild); }
    A().setItems(Number(rt.dataset.l), listItems(rt)); return;
  }
  if (rt) {
    if (!rt.textContent) rt.innerHTML = "";
    const i = Number(rt.dataset.t);
    if (rt.dataset.multi) { A().setText(i, richMdMulti(rt)); return; }
    const md = richMd(rt);
    // Word-style autoformat at the start of a paragraph: "- " list, "1. " numbered list, "## " title, "### " subtitle, "> " quote
    if (E().blocks[i]?.type === "p" && e.inputType === "insertText" && e.data === " ") {
      const c = caretParts(rt), left = c ? c.left : "";
      const kinds = { "- ": "ul", "\\* ": "ul", "1. ": "ol", "1) ": "ol", "## ": "h2", "### ": "h3", "> ": "quote" };
      if (kinds[left]) { A().autoformat(i, kinds[left], md.slice(left.trim().length).trim()); return; }
    }
    A().setText(i, md); return;
  }
  const t = e.target; if (!(t instanceof HTMLTextAreaElement)) return; fit(t);
  if (t.dataset.m) A().setMeta(t.dataset.m, t.value, true);
});

// Caret helpers for moving between blocks like in Word
export function caretLine(el) {
  const sel = getSelection(); if (!sel.rangeCount) return { first: true, last: true, start: true, end: true };
  const r = sel.getRangeAt(0);
  const before = document.createRange(); before.selectNodeContents(el); before.setEnd(r.startContainer, r.startOffset);
  const after = document.createRange(); after.selectNodeContents(el); after.setStart(r.endContainer, r.endOffset);
  const start = before.toString().length === 0, end = after.toString().length === 0;
  const rects = r.getClientRects(), cr = rects[rects.length - 1], er = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 28;
  return { collapsed: r.collapsed, start, end, first: start || !cr || cr.top - er.top < lh * 0.8, last: end || !cr || er.bottom - cr.bottom < lh * 0.8 };
}
export const editables = () => [...document.querySelectorAll(".ed-rich[data-t], .ed-list")];
export function goTo(el, atEnd) {
  if (!el) return false;
  el.focus(); const t = el.matches(".ed-list") ? (atEnd ? el.lastElementChild : el.firstElementChild) || el : el;
  placeCaret(t, atEnd ? undefined : 0); A().select(blockIndex(el), null, true); return true;
}

root.addEventListener("keydown", (e) => {
  const f = fieldOf(e.target);
  if (f) { if (e.key === "Enter") { e.preventDefault(); f.blur(); } return; }
  const t = richOf(e.target); if (!t) return;
  const isList = t.matches(".ed-list"), multi = !!t.dataset.multi, i = blockIndex(t);
  const nav = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (nav) {
    const c = caretLine(t); if (!c.collapsed) return;
    const all = editables(), k = all.indexOf(t);
    if ((e.key === "ArrowUp" && c.first) || (e.key === "ArrowLeft" && c.start)) { if (goTo(all[k - 1], true)) e.preventDefault(); }
    else if ((e.key === "ArrowDown" && c.last) || (e.key === "ArrowRight" && c.end)) { if (goTo(all[k + 1], false)) e.preventDefault(); }
    return;
  }
  if (isList) {
    const sel = getSelection(); const li = sel.rangeCount ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest("li") : null;
    const n = li ? [...t.children].indexOf(li) : -1;
    if (e.key === "Enter" && !e.shiftKey && li && !li.textContent.trim()) { e.preventDefault(); A().listExit(i, n); }
    else if (e.key === "Backspace" && li && n === 0 && caretLine(li).start && caretLine(li).collapsed) { e.preventDefault(); A().listUnwrapFirst(i); }
    return;
  }
  if (multi) return;   // text boxes and expandables: Enter makes a new paragraph inside
  if (e.key === "Enter") {
    e.preventDefault(); if (e.shiftKey) { document.execCommand("insertLineBreak"); return; }
    if (E().blocks[i]?.type === "p" && /^(-{3,}|(\\\*){3,}|_{3,})$/.test(richMd(t))) { A().toRule(i); return; }   // Word: "---" + Enter draws a line
    const c = caretParts(t); if (c) A().split(i, c.left, c.right);
  }
  else if (e.key === "Backspace" && i > 0) { const c = caretParts(t); if (c && c.collapsed && c.left === "" && A().mergePrev(i)) e.preventDefault(); }
  else if (e.key === "Delete") { const c = caretLine(t); if (c.collapsed && c.end && A().mergePrev(i + 1)) e.preventDefault(); }
});
root.addEventListener("paste", (e) => {
  const f = fieldOf(e.target);
  if (f) { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") || "").replace(/\s+/g, " ")); return; }
  const t = richOf(e.target); if (!t) return;
  e.preventDefault();
  const files = [...(e.clipboardData?.files || [])].filter((x) => /^image\//.test(x.type));
  if (files.length) { A().dropFiles(files, blockIndex(t) + 1); return; }
  const html = e.clipboardData?.getData("text/html") || "";
  if (html && t.dataset.t !== undefined && !t.dataset.multi) {
    const blocks = htmlToBlocks(html);
    if (blocks.length > 1 || (blocks[0] && blocks[0].type !== "p")) { const c = caretParts(t); if (c) A().pasteBlocks(Number(t.dataset.t), c.left, c.right, blocks); return; }
    if (blocks[0]) { document.execCommand("insertHTML", false, mdToHtml(blocks[0].text)); return; }
  }
  if (html && (t.dataset.multi || t.matches(".ed-list"))) {
    const blocks = htmlToBlocks(html), texts = blocks.flatMap((b) => b.items || [b.text]);
    if (texts.length) { document.execCommand("insertHTML", false, t.dataset.multi ? texts.map((x) => `<p>${mdToHtml(x)}</p>`).join("") : texts.map((x) => mdToHtml(x)).join("<br>")); return; }
  }
  const txt = (e.clipboardData?.getData("text/plain") || "").replace(/\r/g, "");
  if (t.dataset.t !== undefined && !t.dataset.multi && /\n\s*\n/.test(txt)) { const c = caretParts(t); if (c) A().pasteMany(Number(t.dataset.t), c.left, c.right, txt); }
  else if (t.dataset.multi) document.execCommand("insertText", false, txt.replace(/\n\s*\n/g, "\n").replace(/[ \t]*\n[ \t]*/g, "\n")) ;
  else document.execCommand("insertText", false, txt.replace(/\s*\n\s*/g, " "));
});
document.addEventListener("focusin", (e) => {
  const t = richOf(e.target) || fieldOf(e.target); if (t && t.closest(".blk")) A().caretIn(blockIndex(t));
  // the title and the button's text take no formatting: the ribbon says so instead of formatting the last paragraph
  if (e.target.matches && e.target.matches('textarea[data-m="title"], .ed-plain:not(.ed-inline)')) { window.lastRange = null; window.plainField = e.target.matches("textarea") ? "El título no lleva negritas, cursivas ni enlaces." : "El texto del botón no lleva formato; su enlace se escribe en el panel."; }
});
try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch {}

// Word shortcuts (the ribbon shows them in its tooltips)
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey; if (!mod) return;
  const k = e.key.toLowerCase(), t = richOf(e.target);
  if (k === "s") { e.preventDefault(); A().saveNow(); }
  else if (k === "k" && t) { e.preventDefault(); A().ribbon("link"); }
  else if (e.altKey && (k === "1" || e.code === "Digit1")) { e.preventDefault(); A().ribbon("h2"); }
  else if (e.altKey && (k === "2" || e.code === "Digit2")) { e.preventDefault(); A().ribbon("h3"); }
  else if (e.shiftKey && k === "n") { e.preventDefault(); A().ribbon("p"); }
  else if (e.shiftKey && k === "l") { e.preventDefault(); A().ribbon("ul"); }
  else if (!e.shiftKey && !e.altKey && k === "e" && t && !t.matches(".ed-inline")) { e.preventDefault(); A().ribbon("center"); }
  else if (!e.shiftKey && !e.altKey && k === "l" && t && !t.matches(".ed-inline")) { e.preventDefault(); A().ribbon("left"); }
  else if (!e.shiftKey && k === "h") { e.preventDefault(); A().ribbon("find"); }
});
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.altKey && ["z", "y"].includes(e.key.toLowerCase())) { e.preventDefault(); A().undoKey(e); } });

// Remember the last text selection so the inspector's Bold / Italic / Link buttons still work after focus leaves the page.
window.lastRange = null;
document.addEventListener("selectionchange", () => {
  const sel = getSelection(); if (!sel.rangeCount) return; const r = sel.getRangeAt(0), el = richOf(r.commonAncestorContainer);
  if (el) {
    window.lastRange = { range: r.cloneRange(), el }; window.plainField = null; if (blkOf(el)) A().caretIn(blockIndex(el));
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    A().selState({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), link: !!n.closest("a") });
  }
});
window.formatText = (cmd, url) => {   // cmd: bold | italic | createLink
  const L = window.lastRange; if (!L || !L.el.isConnected) return false;
  L.el.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(L.range);
  if (cmd === "unlink") {   // caret anywhere inside a link removes that whole link
    const n = L.range.startContainer, a = (n.nodeType === 1 ? n : n.parentElement).closest("a");
    if (!a) return false; const r = document.createRange(); r.selectNodeContents(a); sel.removeAllRanges(); sel.addRange(r);
  }
  if ((cmd === "bold" || cmd === "italic" || cmd === "createLink") && sel.isCollapsed) return false;
  document.execCommand("styleWithCSS", false, false);
  document.execCommand(cmd, false, url);
  L.el.dispatchEvent(new Event("input", { bubbles: true })); return true;
};
window.linkAt = () => {   // cursor inside a link: select all of it and return its address
  const L = window.lastRange; if (!L || !L.el.isConnected) return null;
  const n = L.range.startContainer, a = (n.nodeType === 1 ? n : n.parentElement).closest("a"); if (!a || !L.el.contains(a)) return null;
  const r = document.createRange(); r.selectNodeContents(a); window.lastRange = { range: r, el: L.el }; return a.getAttribute("href") || "";
};
window.hasTextSelection = () => { const L = window.lastRange; return !!(L && L.el.isConnected && !L.range.collapsed); };
