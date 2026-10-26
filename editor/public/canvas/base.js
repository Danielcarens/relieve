// Shared by the whole canvas: the article and the editor's actions (in the parent window), small helpers.
export const $ = (s, r = document) => r.querySelector(s);
export const root = $("#root");
export const E = () => parent.ED,
  A = () => parent.act;
// Photo addresses: in the web editor, photos not published yet are served from this browser (parent.imgSrc)
export const IMG = (base, file, suf) => (parent.imgSrc ? parent.imgSrc(base, file, suf) : `${base}${file}${suf}`);
export const PREVIEW = new URLSearchParams(location.search).has("preview");
export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export const ic = {
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  dup: '<rect x="9" y="9" width="11" height="11"/><path d="M5 15V5h10"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
};
export const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ic[n]}</svg>`;
export const POS = /^(\d{1,3})% (\d{1,3})%$/;
export const posOf = (p) => (POS.test(p?.pos || "") ? p.pos : "50% 50%");
export const ratioOf = (p) => (Number(p.ratio) > 0 ? Number(p.ratio) : p.w / p.h);

export const fit = (t) => {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + "px";
};
export const fitAll = () => document.querySelectorAll("textarea.ed-field").forEach(fit);
export const nearest = (v, list, tol) => {
  let best = null,
    d = tol;
  for (const t of list) {
    const dd = Math.abs(v - t);
    if (dd < d) {
      d = dd;
      best = t;
    }
  }
  return best;
};
