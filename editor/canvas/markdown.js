// Text: Markdown <-> what the page shows, pasting from Word or Google Docs, the cursor.
import { esc } from "./base.js";

// ---- inline formatting: the page shows real bold / italic / links; the file keeps **bold**, *italic*, [text](url) ----
export function mdToHtml(md) {
  let h = esc(md).replace(/\\\*/g, "\u0001");
  h = h
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return h.replace(/\u0001/g, "*").replace(/&lt;br&gt;/g, "<br>");
}
// DOM -> Markdown. Also understands what Word and Google Docs put on the clipboard (bold/italic as inline styles).
export function domToMd(node, ctx = { b: false, i: false }) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += n.nodeValue.replace(/ /g, " ").replace(/\*/g, "\\*");
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName,
      st = n.getAttribute("style") || "";
    if (/^(STYLE|SCRIPT|META|TITLE|IMG|SVG)$/.test(tag) || /mso-list:\s*ignore/i.test(st)) return;
    const w = (st.match(/font-weight:\s*(\w+)/i) || [])[1];
    const bold =
      !ctx.b &&
      (((tag === "STRONG" || tag === "B") && !/^(normal|[1-5]00)$/i.test(w || "")) ||
        /^(bold|bolder|[6-9]00)$/i.test(w || ""));
    const ital = !ctx.i && (tag === "EM" || tag === "I" || /font-style:\s*italic/i.test(st));
    const inner = domToMd(n, { b: ctx.b || bold, i: ctx.i || ital });
    const mark = (txt, m) => {
      const t = txt.trim();
      if (!t) return txt;
      const lead = txt.slice(0, txt.length - txt.trimStart().length),
        tail = txt.slice(txt.trimEnd().length);
      return lead + m + t + m + tail;
    };
    let md = inner;
    if (ital) md = mark(md, "*");
    if (bold) md = mark(md, "**");
    if (tag === "A") {
      const href = n.getAttribute("href") || "";
      if (md.trim() && /^(https?:|mailto:|\/|#)/.test(href)) md = `[${md.trim()}](${href})`;
    } else if (tag === "BR") md = n.nextSibling || n.parentNode !== node ? "<br>" : ""; // Shift+Enter line break (a trailing <br> is the browser's, not the writer's)
    out += md;
  });
  return out;
}
// Clipboard HTML (Word, Google Docs, web pages) -> editor blocks
export const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|TABLE|TR|SECTION|ARTICLE|HEADER|FOOTER|MAIN|FIGURE)$/;
export function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = [],
    inl = (el) => domToMd(el).replace(/\s+/g, " ").trim();
  const add = (b) => {
    if ((b.text ?? "").trim() || (b.items && b.items.length)) blocks.push(b);
  };
  const listItem = (type, text) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === type && last._open) last.items.push(text);
    else blocks.push({ type, items: [text], _open: true });
  };
  const close = () => {
    const last = blocks[blocks.length - 1];
    if (last) delete last._open;
  };
  let inline = document.createElement("div");
  const flushInline = () => {
    const t = inl(inline);
    if (t) {
      close();
      add({ type: "p", text: t });
    }
    inline = document.createElement("div");
  };
  const walk = (el) => {
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) {
        if (n.nodeValue.trim()) inline.appendChild(n.cloneNode());
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (/^(STYLE|SCRIPT|META|TITLE|LINK)$/.test(tag)) continue;
      const hasBlocks = [...n.querySelectorAll("*")].some((d) => BLOCK_TAGS.test(d.tagName));
      if (!BLOCK_TAGS.test(tag) && !hasBlocks) {
        inline.appendChild(n.cloneNode(true));
        continue;
      }
      flushInline();
      const cls = n.getAttribute("class") || "",
        st = n.getAttribute("style") || "";
      if (tag === "H1" || tag === "H2") {
        close();
        add({ type: "h2", text: inl(n) });
      } else if (/^H[3-6]$/.test(tag)) {
        close();
        add({ type: "h3", text: inl(n) });
      } else if (tag === "UL" || tag === "OL") {
        close();
        const items = [...n.children]
          .filter((c) => c.tagName === "LI")
          .map(inl)
          .filter(Boolean);
        if (items.length) blocks.push({ type: tag.toLowerCase(), items });
      } else if (tag === "LI") listItem("ul", inl(n));
      else if (tag === "BLOCKQUOTE") {
        close();
        add({ type: "quote", text: inl(n) });
      } else if (tag === "TABLE") {
        close();
        n.querySelectorAll("tr").forEach((tr) =>
          add({ type: "p", text: [...tr.children].map(inl).filter(Boolean).join(" · ") }),
        );
      } else if (tag === "P" || (tag === "DIV" && !hasBlocks)) {
        // Word writes lists as paragraphs with a hidden bullet ("·", "o", "1.") marked mso-list:Ignore
        const marker = [...n.querySelectorAll("[style]")].find((x) =>
          /mso-list:\s*ignore/i.test(x.getAttribute("style")),
        );
        const isWordList = /MsoListParagraph/i.test(cls) || /mso-list:/i.test(st);
        if (isWordList) {
          const num = marker && /^\s*\(?\w{1,3}[.)]/.test(marker.textContent);
          listItem(num ? "ol" : "ul", inl(n));
        } else {
          close();
          const t = inl(n);
          const m = t.match(/^[•·▪◦‣–-]\s+(.*)$/);
          if (m) listItem("ul", m[1]);
          else add({ type: "p", text: t });
        }
      } else walk(n);
    }
  };
  walk(doc.body);
  flushInline();
  blocks.forEach((b) => delete b._open);
  return blocks;
}
// Typed line breaks (Shift+Enter) arrive as "\n" in the editable text; they are kept as <br>
export const richMd = (el) =>
  domToMd(el)
    .replace(/[ \t]*\n[ \t]*/g, "<br>")
    .replace(/\s+/g, " ")
    .replace(/(<br>\s*)+$/, "")
    .replace(/^(\s*<br>)+/, "")
    .trim();
// Several paragraphs in one field (text boxes, expandables): one <p> per paragraph, blank line between them in the file
export const mdMulti = (md) =>
  String(md || "")
    .split(/\n\s*\n/)
    .filter((x) => x.trim())
    .map((x) => `<p>${mdToHtml(x.replace(/\s*\n\s*/g, " "))}</p>`)
    .join("");
export function richMdMulti(el) {
  const parts = [];
  let inline = document.createElement("div");
  const push = (n) => {
    const t = domToMd(n).replace(/\s+/g, " ").trim();
    if (t) parts.push(t);
  };
  const flushInline = () => {
    push(inline);
    inline = document.createElement("div");
  };
  [...el.childNodes].forEach((n) => {
    if (n.nodeType === 1 && /^(P|DIV|LI|H\d|BLOCKQUOTE)$/.test(n.tagName)) {
      flushInline();
      push(n);
    } else inline.appendChild(n.cloneNode(true));
  });
  flushInline();
  return parts.join("\n\n");
}
export const listItems = (el) =>
  [...el.children].filter((n) => n.tagName === "LI").map((li) => domToMd(li).replace(/\s+/g, " ").trim());
window.plainLen = (md) => {
  const d = document.createElement("div");
  d.innerHTML = mdToHtml(md);
  return d.textContent.length;
};
export function rangeMd(a, b) {
  const r = document.createRange();
  r.setStart(a.node, a.off);
  r.setEnd(b.node, b.off);
  const d = document.createElement("div");
  d.appendChild(r.cloneContents());
  return domToMd(d).replace(/\s+/g, " ");
}
export function caretParts(el) {
  // markdown before the selection and after it
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  return {
    left: rangeMd({ node: el, off: 0 }, { node: r.startContainer, off: r.startOffset }),
    right: rangeMd({ node: r.endContainer, off: r.endOffset }, { node: el, off: el.childNodes.length }),
    collapsed: r.collapsed,
  };
}
export function placeCaret(el, n) {
  // n = visible characters from the start; undefined = end
  const sel = getSelection(),
    r = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = n ?? Infinity,
    node;
  while ((node = walker.nextNode())) {
    if (left <= node.nodeValue.length) {
      r.setStart(node, left);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    left -= node.nodeValue.length;
  }
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}
export const EDITABLE = ".ed-rich, .ed-list, .ed-inline"; // where the ribbon's bold / italic / link work
export const richOf = (t) =>
  t && t.nodeType === 1 ? t.closest(EDITABLE) : t && t.parentElement ? t.parentElement.closest(EDITABLE) : null;
export const fieldOf = (t) => (t && t.nodeType === 1 ? t.closest(".ed-inline, .ed-plain[data-f]") : null); // one-line fields (captions, authors, data…)
export const blkOf = (el) => (el && el.closest ? el.closest(".blk") : null);
// A one-line field with formatting: what it holds as Markdown (**bold**, *italic*, [link](url))
export const inlineMd = (el) => domToMd(el).replace(/<br>/g, " ").replace(/\s+/g, " ").trim();
export const inl = (attr, value, ph, cls = "", tag = "div") =>
  `<${tag} class="ed-plain ed-inline ${cls}" contenteditable="true" spellcheck="true" ${attr} data-ph="${esc(ph)}">${mdToHtml(value || "")}</${tag}>`;
export const blockIndex = (el) => Number(el.closest(".blk").dataset.i);
