// The cover: how it is drawn, dragging it inside its 16:9 frame, zooming it.
import { $, A, E, POS, esc, root } from "./base.js";
import { caption } from "./blocks.js";
import { inl } from "./markdown.js";

// The cover. "" = full-bleed photo with the title over it (as on the site from 992 px up; under it on narrower
// screens), "debajo" = full-bleed photo with the title under it, "titulo" = title, then the photo, "texto" = no photo.
// The photo is the uncropped original placed in a 16:9 frame: drag it to move it, + / − to zoom; what the frame shows
// is exactly the crop that gets saved.
export const heroZoom = (h) => Math.min(3, Math.max(1, Number(h.zoom) || 1));
export function heroBox(h) {
  // size and place of the original inside the frame, in % of the frame
  const ir = h.srcW / h.srcH,
    fr = 16 / 9,
    z = heroZoom(h);
  const w = ir > fr ? (100 * z * ir) / fr : 100 * z,
    hh = ir > fr ? 100 * z : (100 * z * fr) / ir;
  const [px, py] = (POS.test(h.pos || "") ? h.pos : "50% 50%").split(" ").map(parseFloat);
  return { w, h: hh, left: ((100 - w) * px) / 100, top: ((100 - hh) * py) / 100 };
}
export const heroStyle = (h) => {
  const b = heroBox(h);
  return `width:${b.w}%;height:${b.h}%;left:${b.left}%;top:${b.top}%`;
};
window.layoutHero = () => {
  const h = E().meta.hero,
    img = $(".ed-hero-img.has-src img");
  if (h && img) img.style.cssText = heroStyle(h);
};
export function heroHTML(S) {
  const m = S.meta,
    h = m.hero,
    cab = m.cabecera || "";
  let inner,
    src = false;
  if (h) {
    src = !!h.srcW;
    const url = parent.heroSrc ? parent.heroSrc(m) : `${m.imgBase}${h.file}-1280.jpg?v=${S.heroV || 0}`;
    const crop = src ? (h.srcW / h.srcH > 16 / 9 ? (h.srcH * 16) / 9 : h.srcW) / heroZoom(h) : 0;
    const hint = !src
      ? "Para encuadrar o acercar esta portada, elige la foto otra vez con «Cambiar foto»."
      : `Arrastra la foto para moverla; con + y − la acercas.${crop && crop < 1600 ? (heroZoom(h) > 1 ? " Ojo: tan cerca, la foto queda con poca resolución para pantallas grandes." : " Ojo: esta foto tiene poca resolución para una portada; en pantallas grandes se verá algo borrosa.") : ""}`;
    const zoom = src
      ? `<button class="btn btn-light btn-sm rounded-0" data-hero="zoom-out" title="Alejar" aria-label="Alejar">−</button><span class="ed-hero-zoom">${Math.round(heroZoom(h) * 100)} %</span><button class="btn btn-light btn-sm rounded-0" data-hero="zoom-in" title="Acercar" aria-label="Acercar">+</button>`
      : "";
    inner = `<img src="${url}" style="${src ? heroStyle(h) : `object-position: ${esc(h.pos || "50% 50%")}`}" alt="" draggable="false"><div class="ed-hero-actions">${zoom}<button class="btn btn-light btn-sm rounded-0" data-hero="replace">Cambiar foto</button></div><div class="ed-hero-hint">${hint}</div>`;
    // The cover's video (Artículo → Video de YouTube): the same button as on the site, bottom right of the photo
    if (m.youtube)
      inner += `<div class="hero-controls ed-hero-video"><div class="container d-flex justify-content-end"><span class="btn btn-primary btn-sm font-ui hero-play" title="Video de la portada: se cambia en la pestaña Artículo, «Video de YouTube»">▶ Ver el video</span></div></div>`;
  } else
    inner = `<div class="ed-hero-empty"><div><strong>Foto principal</strong><br>Arrastra una foto aquí o haz clic para elegirla</div></div>`;
  const photo = `<div class="ed-hero-img ${h ? "" : "ed-hero-empty"}${src ? " has-src can-drag" : ""}" data-hero="${h ? "img" : "pick"}">${inner}</div>`;
  const caption = h
    ? `<div class="container pt-2">${inl('data-m="hero.caption"', h.caption, "Descripción de la portada (opcional)", "figure-caption cap-field")}</div>`
    : "";
  const tape = `<span class="tape">${esc((parent.SECTION_NAMES || {})[m.section] || m.section || "Sección")}</span>`;
  const title = `<textarea class="ed-field ed-title" rows="1" data-m="title" placeholder="Título del artículo">${esc(m.title || "")}</textarea>`;
  const label = { debajo: "título debajo de la foto", titulo: "título arriba", texto: "solo título" }[cab];
  // Under the header, as on the site: the subtitle (big, light) and the byline (author, date, reading time; automatic)
  const fecha = m.date
    ? new Intl.DateTimeFormat("es-419", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(m.date),
      )
    : "Sin fecha";
  const words = S.blocks.reduce(
    (n, b) =>
      n +
      String((b.items || []).join(" ") + " " + (b.text || "") + " " + (b.title || ""))
        .replace(/[*#>\[\]()]/g, " ")
        .split(/\s+/)
        .filter(Boolean).length,
    0,
  );
  const byline = `<ul class="list-inline small-meta mb-0 ed-byline" data-byline title="El autor y la fecha se cambian en la pestaña Artículo; el tiempo de lectura se calcula solo"><li class="list-inline-item me-4"><strong class="text-body">Por ${esc(m.author || "—")}</strong></li><li class="list-inline-item me-4">${esc(fecha)}</li><li class="list-inline-item">${Math.max(1, Math.round(words / 200))} min de lectura</li></ul>`;
  const aid =
    m.draft || label
      ? `<div class="ed-date font-ui">${[m.draft ? "Borrador" : "", label ? `Cabecera: ${label}` : ""].filter(Boolean).join(" · ")}</div>`
      : "";
  const sub = inl(
    'data-m="subtitle"',
    m.subtitle,
    "Subtítulo (opcional): una o dos frases que resumen el artículo",
    "lead measure mb-0 ed-sub",
  );
  const intro = `<div class="container pt-4 pt-lg-5"><div class="row"><div class="col-xl-10 d-grid gap-4">${sub}${byline}${aid}</div></div></div>`;
  const ai = m.ai
    ? `<div class="notice-band tone-amarillo mt-4" role="note"><div class="container py-3"><strong>Versión de prueba.</strong> Este artículo fue escrito enteramente con inteligencia artificial, solo para probar el diseño de la revista. El texto definitivo lo escribirá el autor.</div></div>`
    : "";
  const titles = (pad) => `<div class="container d-grid gap-3 ed-titles ${pad}">${tape}${title}</div>`;
  if (cab === "texto") return `<header class="ed-hero-wrap ed-cab-texto">${titles("pt-5")}</header>${ai}${intro}`;
  if (cab === "titulo")
    return `<header class="ed-hero-wrap ed-cab-titulo">${titles("pt-5")}<div class="container mt-4">${photo}</div>${caption}</header>${ai}${intro}`;
  if (cab === "debajo" || !h)
    return `<header class="ed-hero-wrap ed-cab-debajo">${photo}${caption}${titles("pt-4")}</header>${ai}${intro}`;
  return `<header class="ed-hero-wrap ed-cab-foto"><div class="ed-hero-stack">${photo}<div class="ed-hero-text"><div class="container d-grid gap-3">${tape}${title}</div></div></div>${caption}</header>${ai}${intro}`;
}
// Cover: drag the photo inside its 16:9 frame (both directions when it is zoomed in); + / − zoom
root.addEventListener("pointerdown", (e) => {
  const box = e.target.closest('[data-hero="img"]');
  if (!box || e.target.closest("button") || e.button !== 0) return;
  const S = E(),
    h = S.meta.hero,
    img = box.querySelector("img");
  if (!h || !box.classList.contains("can-drag")) return;
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  const rect = box.getBoundingClientRect(),
    sx = e.clientX,
    sy = e.clientY,
    b = heroBox(h);
  const [px0, py0] = (POS.test(h.pos || "") ? h.pos : "50% 50%").split(" ").map(parseFloat);
  const overW = rect.width * (b.w / 100 - 1),
    overH = rect.height * (b.h / 100 - 1);
  let pos = h.pos || "50% 50%";
  const move = (ev) => {
    const px = overW > 1 ? px0 - ((ev.clientX - sx) / overW) * 100 : px0,
      py = overH > 1 ? py0 - ((ev.clientY - sy) / overH) * 100 : py0;
    pos = `${Math.round(Math.max(0, Math.min(100, px)))}% ${Math.round(Math.max(0, Math.min(100, py)))}%`;
    img.style.cssText = heroStyle({ ...h, pos });
  };
  box.classList.add("is-dragging");
  const up = () => {
    box.classList.remove("is-dragging");
    box.removeEventListener("pointermove", move);
    box.removeEventListener("pointerup", up);
    if (pos !== (h.pos || "50% 50%")) A().setHeroPos(pos);
  };
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", up);
});
export const ZOOMS = [1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
root.addEventListener(
  "click",
  (e) => {
    const z = e.target.closest('[data-hero="zoom-in"], [data-hero="zoom-out"]');
    if (!z) return;
    e.stopPropagation();
    const h = E().meta.hero,
      cur = heroZoom(h);
    const next =
      z.dataset.hero === "zoom-in"
        ? (ZOOMS.find((x) => x > cur + 0.001) ?? 3)
        : ([...ZOOMS].reverse().find((x) => x < cur - 0.001) ?? 1);
    A().setHeroPos(h.pos || "50% 50%", next);
  },
  true,
);
