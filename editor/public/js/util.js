// Small helpers shared by the whole editor: DOM shortcuts, escaping, messages (toast), dialogs (modal), form bits.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const frame = () => $("#canvas");
export const cdoc = () => frame().contentDocument;
export function toast(msg, err = false, ms = 4500) {
  const t = document.createElement("div"); t.className = "alert rounded-0 border-2 mb-0 " + (err ? "alert-danger border-danger" : "bg-body border-strong"); t.textContent = msg;
  $("#toast").appendChild(t); setTimeout(() => t.remove(), ms);
}
export function modal(html, onMount) {
  const m = $("#modal"); m.innerHTML = html; m.hidden = false;
  try { const ad = frame().contentDocument.activeElement; ad && ad.blur && ad.blur(); } catch {}  /* keyboard focus must leave the page iframe, or typing in the dialog goes nowhere */
  window.focus();
  m.onmousedown = (e) => { if (e.target === m) closeModal(); };
  onMount && onMount(m);
}
export const closeModal = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; };
export const setBusy = (sel, b) => { const el = $(sel); el.disabled = b; };
export const fld = (label, html, hint = "") => `<div><label class="form-label">${label}</label>${html}${hint}</div>`;
export const inp = (k, v, ph = "", type = "text") => `<input class="form-control" type="${type}" data-k="${k}" value="${esc(v ?? "")}" placeholder="${esc(ph)}">`;
export const choice = (b, key, opts) => `<div class="btnrow" role="group">${opts.map(([v, l]) => `<button class="btn btn-outline-dark ${(b[key] || opts[0][0]) === v ? "active" : ""}" data-do="bset" data-key="${key}" data-v="${v}">${l}</button>`).join("")}</div>`;
