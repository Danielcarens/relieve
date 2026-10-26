// The Panel (dashboard): numbers, traffic (GoatCounter), publishing status.
import { SECTIONS } from "./config.js";
import { MODE, api, env, post } from "./env.js";
import { save } from "./state.js";
import { ED } from "./store.js";
import { $, closeModal, esc, modal, toast } from "./util.js";
import { open, showView } from "./views.js";

// ---- Panel (dashboard) ---------------------------------------------------------------------------------------
export const MB = (n) => (n / 1048576).toFixed(n > 104857600 ? 0 : 1).replace(".", ",") + " MB";
export const SITE_URL = "https://relievemag.com";
export const gcCfg = () => {
  try {
    return JSON.parse(localStorage.getItem("relieve-gc") || "{}");
  } catch {
    return {};
  }
};
export async function gcGet(pathq) {
  const c = gcCfg();
  if (!c.code || !c.token) throw new Error("sin configurar");
  const url = `https://${c.code}.goatcounter.com/api/v0/${pathq}`;
  if (MODE === "local") return post("/api/gc", { url, token: c.token });
  const r = await fetch(url, { headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" } });
  if (!r.ok) throw new Error(`GoatCounter respondió ${r.status}`);
  return r.json();
}
export const isoDay = (d) => d.toISOString().slice(0, 10);
export async function showPanel() {
  await save();
  ED.path = null;
  ED.meta = null;
  showView("panel");
  const el = $("#panel");
  el.innerHTML = '<p class="text-secondary">Cargando datos…</p>';
  let d;
  try {
    d = await api("/api/dashboard");
  } catch (e) {
    el.innerHTML = `<p class="text-danger">${esc(e.message)}</p>`;
    return;
  }
  const arts = d.articles.filter((a) => !a.guia),
    pub = arts.filter((a) => !a.draft),
    drafts = arts.filter((a) => a.draft);
  const words = pub.reduce((s, a) => s + a.words, 0),
    photos = arts.reduce((s, a) => s + a.photos, 0);
  const sorted = [...pub].sort((a, b) => b.date.localeCompare(a.date)),
    last = sorted[0];
  const daysSince = last ? Math.round((Date.now() - new Date(last.date + "T12:00:00")) / 86400000) : null;
  const months = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    const m = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: m.toLocaleDateString("es", { month: "short" }).replace(".", ""),
      n: pub.filter((a) => a.date.startsWith(key)).length,
    });
  }
  const maxM = Math.max(1, ...months.map((m) => m.n));
  const bySec = SECTIONS.map(([k, l]) => ({ l, n: pub.filter((a) => a.section === k).length }));
  const maxS = Math.max(1, ...bySec.map((x) => x.n));
  const limit = 1024 * 1048576,
    pct = Math.min(100, (d.sizes.total / limit) * 100);
  const issues = arts.filter((a) => a.issues.length);
  const heavy = [...arts].sort((a, b) => b.imgBytes - a.imgBytes).slice(0, 5);
  const kpi = (n, l, sub = "") =>
    `<div class="col"><div class="border border-2 border-strong p-3 h-100"><div class="small-meta fw-semibold font-ui">${l}</div><div class="h3 mb-0 text-nowrap">${n}</div>${sub ? `<div class="small-meta mt-1">${sub}</div>` : ""}</div></div>`;
  const sec = (title, inner, extra = "") =>
    `<section class="mt-5"><div class="d-flex justify-content-between align-items-end border-bottom border-2 border-strong pb-2 mb-3 gap-2 flex-wrap"><h2 class="tape mb-0">${title}</h2>${extra}</div>${inner}</section>`;
  el.innerHTML = `<div class="d-flex flex-wrap justify-content-between align-items-end gap-3 border-bottom border-2 border-strong pb-3"><h1 class="mb-0">Panel</h1><span class="font-ui small text-secondary">${MODE === "web" ? "Datos del repositorio en GitHub" : "Datos de la copia del sitio en esta computadora"} · ${new Date().toLocaleString("es")}</span></div>
  <div class="row row-cols-2 row-cols-md-3 row-cols-xl-6 g-3 mt-1">
    ${kpi(pub.length, "Artículos publicados", `${drafts.length} borrador${drafts.length === 1 ? "" : "es"}${d.drafts ? ` · ${d.drafts} con cambios sin publicar` : ""}`)}
    ${kpi(words.toLocaleString("es"), "Palabras publicadas", `${Math.round(words / 220)} min de lectura en total`)}
    ${kpi(pub.length ? Math.round(words / pub.length).toLocaleString("es") : "–", "Palabras por artículo", "promedio")}
    ${kpi(photos, "Fotos", "en todos los artículos")}
    ${kpi(MB(d.sizes.total), "Peso del contenido", `fotos ${MB(d.sizes.images)} · textos ${MB(d.sizes.texts)}`)}
    ${kpi(last ? (daysSince === 0 ? "Hoy" : `${daysSince} d`) : "–", "Desde el último artículo", last ? esc(last.title).slice(0, 48) : "")}
  </div>
  <div class="mt-3"><div class="d-flex justify-content-between small-meta mb-1"><span>Espacio usado del límite recomendado de GitHub Pages (1 GB)</span><span>${pct.toFixed(1).replace(".", ",")} %</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>
  ${sec("Tráfico", '<div id="traffic"><p class="text-secondary">Cargando…</p></div>', '<button class="btn btn-outline-dark btn-sm" id="gc-set">Configurar estadísticas</button>')}
  <div class="row g-5">
    <div class="col-lg-7">${sec("Ritmo de publicación", `<div class="chart">${months.map((m) => `<div class="chart-col" title="${m.n} artículo${m.n === 1 ? "" : "s"}"><span class="chart-n">${m.n || ""}</span><span class="chart-bar" style="height:${(m.n / maxM) * 100}%"></span><span class="chart-l">${m.label}</span></div>`).join("")}</div><p class="hint">Artículos publicados por mes, últimos 12 meses (según la fecha de cada artículo).</p>`)}</div>
    <div class="col-lg-5">${sec("Por sección", bySec.map((x) => `<div class="d-flex align-items-center gap-2 mb-2"><span class="font-ui small fw-semibold" style="width:6rem">${x.l}</span><div class="bar flex-grow-1"><span style="width:${(x.n / maxS) * 100}%"></span></div><span class="font-ui small" style="width:2rem;text-align:right">${x.n}</span></div>`).join(""))}</div>
  </div>
  ${sec("Revisión editorial", issues.length ? `<ul class="list-unstyled mb-0">${issues.map((a) => `<li class="border-bottom py-2"><a href="#" class="fw-semibold" data-open="${esc(a.path)}">${esc(a.title)}</a>${a.draft ? ' <span class="ed-tag ed-tag-sm is-dark">Borrador</span>' : ""}<ul class="mb-0 small">${a.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></li>`).join("")}</ul>` : "<p>Todo en orden: ningún artículo tiene pendientes.</p>", '<span class="font-ui small text-secondary">Texto alternativo, descripción para Google, foto principal, avisos</span>')}
  <div class="row g-5">
    <div class="col-lg-6">${sec("Artículos más pesados", `<ol class="mb-0">${heavy.map((a) => `<li class="mb-1"><a href="#" data-open="${esc(a.path)}">${esc(a.title)}</a> <span class="text-secondary">· ${MB(a.imgBytes)} de fotos</span></li>`).join("")}</ol><p class="hint">Fotos pesadas hacen más lenta la página en celulares con mala señal.</p>`)}</div>
    <div class="col-lg-6">${sec("Actividad reciente", d.commits.length ? `<ul class="list-unstyled mb-0 small">${d.commits.map((c) => `<li class="border-bottom py-1"><span class="text-secondary">${esc(new Date(c.date).toLocaleDateString("es"))} · ${esc(c.author)}</span><br>${esc(c.message)}</li>`).join("")}</ul>` : '<p class="text-secondary">Sin datos.</p>')}</div>
  </div>
  ${sec("Estado de la publicación", '<div id="deploy"><p class="text-secondary">Consultando GitHub…</p></div>')}
  ${sec("Enlaces", `<div class="d-flex flex-wrap gap-2"><a class="btn btn-outline-dark" href="${SITE_URL}" target="_blank" rel="noopener">Ver el sitio</a><a class="btn btn-outline-dark" href="https://github.com/Danielcarens/relieve" target="_blank" rel="noopener">Repositorio</a><a class="btn btn-outline-dark" href="https://github.com/Danielcarens/relieve/actions" target="_blank" rel="noopener">Publicaciones (Actions)</a><a class="btn btn-outline-dark" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(SITE_URL)}" target="_blank" rel="noopener">Velocidad (PageSpeed)</a><a class="btn btn-outline-dark" href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a>${gcCfg().code ? `<a class="btn btn-outline-dark" href="https://${esc(gcCfg().code)}.goatcounter.com" target="_blank" rel="noopener">Estadísticas completas</a>` : ""}</div>`)}`;
  el.querySelectorAll("[data-open]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        open(a.dataset.open).catch((er) => toast(er.message, true));
      }),
  );
  $("#gc-set").onclick = gcSetup;
  loadTraffic();
  loadDeploy();
}
export async function loadTraffic() {
  const box = $("#traffic");
  if (!box) return;
  if (!gcCfg().code || !gcCfg().token) {
    box.innerHTML = `<p class="mb-2">Las visitas se cuentan con <b>GoatCounter</b>: de código abierto, gratuito para sitios como este, sin cookies ni avisos de privacidad. Pulsa <b>Configurar estadísticas</b> para activarlo.</p>`;
    return;
  }
  const t = new Date(),
    ago = (n) => isoDay(new Date(t.getTime() - n * 86400000)),
    end = isoDay(new Date(t.getTime() + 86400000));
  try {
    const ranges = [
      ["Hoy", isoDay(t)],
      ["Últimos 7 días", ago(7)],
      ["Últimos 30 días", ago(30)],
      ["Último año", ago(365)],
    ];
    const totals = await Promise.all(ranges.map(([, s]) => gcGet(`stats/total?start=${s}&end=${end}`)));
    const hits = await gcGet(`stats/hits?start=${ago(30)}&end=${end}&limit=8`);
    const num = (j) => j.total ?? j.total_pageviews ?? j.count ?? 0;
    box.innerHTML = `<div class="row row-cols-2 row-cols-md-4 g-3">${ranges.map(([l], k) => `<div class="col"><div class="border border-2 border-strong p-3"><div class="small-meta fw-semibold font-ui">${l}</div><div class="h2 mb-0">${Number(num(totals[k])).toLocaleString("es")}</div><div class="small-meta">visitas</div></div></div>`).join("")}</div>
      <h3 class="h5 mt-4">Lo más leído en los últimos 30 días</h3><ol class="mb-0">${(hits.hits || []).map((h) => `<li>${esc(h.title || h.path)} <span class="text-secondary">· ${esc(h.path)} · ${Number(h.count ?? h.count_unique ?? 0).toLocaleString("es")}</span></li>`).join("") || "<li>Todavía sin visitas.</li>"}</ol>`;
  } catch (e) {
    box.innerHTML = `<p class="text-danger mb-1">No se pudieron leer las estadísticas: ${esc(e.message)}.</p><p class="hint mt-0">Revisa el código y la llave en «Configurar estadísticas»${MODE === "web" ? ", o ábrelas directamente con el botón «Estadísticas completas» (algunos navegadores bloquean esta consulta desde el sitio)" : ""}.</p>`;
  }
}
export async function loadDeploy() {
  const box = $("#deploy");
  if (!box) return;
  try {
    const headers = MODE === "web" && env.web.session.token ? { Authorization: `Bearer ${env.web.session.token}` } : {};
    const r = await fetch(
      "https://api.github.com/repos/Danielcarens/relieve/actions/runs?per_page=3&branch=eleventy-prueba",
      { headers },
    );
    if (!r.ok) throw new Error(`GitHub respondió ${r.status}`);
    const runs = (await r.json()).workflow_runs || [];
    const label = (x) =>
      x.status !== "completed"
        ? ["Publicando ahora…", "tone-amarillo"]
        : x.conclusion === "success"
          ? ["Publicado", "tone-verde"]
          : ["Falló", "tone-rojo"];
    box.innerHTML = runs.length
      ? `<ul class="list-unstyled mb-0">${runs
          .map((x) => {
            const [t, c] = label(x);
            return `<li class="border-bottom py-2 d-flex flex-wrap gap-2 align-items-center"><span class="ed-tag ed-tag-sm ${c}">${t}</span><span>${esc((x.head_commit?.message || x.display_title || "").split("\n")[0])}</span><span class="text-secondary small">· ${esc(new Date(x.created_at).toLocaleString("es"))}</span><a class="small ms-auto" href="${esc(x.html_url)}" target="_blank" rel="noopener">Detalles</a></li>`;
          })
          .join(
            "",
          )}</ul><p class="hint">Cada vez que alguien publica, GitHub construye el sitio con Eleventy y lo sube; tarda unos 2 minutos.</p>`
      : "<p>Sin publicaciones recientes.</p>";
  } catch (e) {
    box.innerHTML = `<p class="text-secondary">No se pudo consultar GitHub (${esc(e.message)}). Mira <a href="https://github.com/Danielcarens/relieve/actions" target="_blank" rel="noopener">las publicaciones en GitHub</a>.</p>`;
  }
}
export function gcSetup() {
  const c = gcCfg();
  modal(
    `<div class="dlg"><h2>Estadísticas de visitas</h2>
    <ol class="mb-0"><li>Crea una cuenta gratis en <a href="https://www.goatcounter.com/signup" target="_blank" rel="noopener">goatcounter.com</a>. El «código» es el nombre que elijas (por ejemplo <b>relieve</b> para relieve.goatcounter.com).</li>
    <li>Escribe el código aquí y pulsa <b>Activar en el sitio</b>: el sitio empieza a contar visitas (los borradores no cuentan).</li>
    <li>Para ver los números en este panel: en GoatCounter, tu usuario → <b>API</b> → crea una llave con permiso de lectura de estadísticas y pégala aquí.</li></ol>
    <div><label class="form-label" for="gc-code">Código</label><input class="form-control" id="gc-code" value="${esc(c.code || "")}" placeholder="relieve"></div>
    <div><label class="form-label" for="gc-token">Llave de la API (solo lectura)</label><input class="form-control" type="password" id="gc-token" value="${esc(c.token || "")}"></div>
    <p class="hint">La llave queda guardada solo en este navegador.</p>
    <div class="acts"><button class="btn btn-outline-dark" id="gc-c">Cerrar</button><button class="btn btn-outline-dark" id="gc-on">Activar en el sitio</button><button class="btn btn-primary" id="gc-ok">Guardar</button></div></div>`,
    () => {
      $("#gc-c").onclick = closeModal;
      const store = () => {
        try {
          localStorage.setItem(
            "relieve-gc",
            JSON.stringify({ code: $("#gc-code").value.trim().toLowerCase(), token: $("#gc-token").value.trim() }),
          );
        } catch {}
      };
      $("#gc-ok").onclick = () => {
        store();
        closeModal();
        loadTraffic();
      };
      $("#gc-on").onclick = async () => {
        const code = $("#gc-code").value.trim().toLowerCase();
        if (!/^[a-z0-9-]+$/.test(code))
          return toast("Escribe el código de GoatCounter (solo letras, números y guiones).", true);
        try {
          const r = await post("/api/goatcounter", { code });
          store();
          toast(
            r.note || "Listo: el sitio contará visitas en cuanto termine de publicarse (unos 2 minutos).",
            false,
            8000,
          );
        } catch (e) {
          toast(e.message, true);
        }
      };
    },
  );
}
$("#nav-panel").onclick = (e) => {
  e.preventDefault();
  showPanel().catch((er) => toast(er.message, true));
};
