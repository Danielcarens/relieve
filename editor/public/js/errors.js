// Errors nobody caught, here or in the page (the canvas iframe): instead of failing in silence, a red box says so and
// offers the details to copy, to send to whoever fixes the editor. The article is not touched: what was saved stays.
const shown = new Set();
const IGNORE = /ResizeObserver loop|Script error\.?$/;

function details(err, where) {
  const e = err instanceof Error ? err : new Error(String(err?.message || err));
  return [
    `Editor de RELIEVE · error en ${where}`,
    `Mensaje: ${e.message}`,
    `Artículo: ${window.ED?.path || "(ninguno abierto)"}`,
    `Hora: ${new Date().toLocaleString("es")}`,
    `Dirección: ${location.origin}${location.pathname}`,
    `Navegador: ${navigator.userAgent}`,
    "",
    e.stack || "(sin detalle de dónde)",
  ].join("\n");
}

export function reportError(err, where = "el editor") {
  const msg = String((err && err.message) || err || "").trim();
  if (!msg || IGNORE.test(msg) || shown.has(msg)) return;
  shown.add(msg);
  const text = details(err, where);
  const box = document.createElement("div");
  box.className = "alert alert-danger rounded-0 border-2 mb-0 d-grid gap-2 err-box";
  box.setAttribute("role", "alert");
  box.innerHTML = `<div><strong>Algo falló en ${where}.</strong> Lo guardado no se pierde. Si vuelve a pasar, copia los detalles y envíalos.</div>
<div class="small text-break"></div>
<div class="d-flex flex-wrap gap-2"><button class="btn btn-primary btn-sm" data-copy>Copiar detalles</button><button class="btn btn-outline-dark btn-sm" data-close>Cerrar</button></div>`;
  box.querySelector(".small").textContent = msg;
  box.querySelector("[data-close]").onclick = () => box.remove();
  box.querySelector("[data-copy]").onclick = async (ev) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand("copy");
      } catch {}
      t.remove();
    }
    ev.target.textContent = "Copiado";
  };
  (document.getElementById("toast") || document.body).appendChild(box);
}
window.reportError = reportError; // the canvas (iframe) reports its own errors here
addEventListener("error", (e) => reportError(e.error || e.message));
addEventListener("unhandledrejection", (e) => reportError(e.reason));
