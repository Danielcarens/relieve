// Read and write an article: front matter (YAML) + body with shortcodes <-> editor model.
import yaml from "js-yaml";

const KEY_ORDER = ["layout", "permalink", "section", "title", "subtitle", "description", "date", "author", "credit",
  "draft", "ai", "cabecera", "youtube", "imgBase", "hero", "route", "photos", "fichas", "sources"];

export function parseArticle(text) {
  text = text.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("El archivo no tiene front matter");
  const meta = yaml.load(m[1], { schema: yaml.CORE_SCHEMA }) || {};
  const photos = meta.photos || {};
  const fichas = meta.fichas || {};
  delete meta.photos; delete meta.fichas;
  return { meta, photos, fichas, blocks: parseBody(m[2]) };
}

// Text wrapping options travel as a few words: "derecha 40 fuera"
export function parseWrap(str) {
  const w = String(str || "").toLowerCase().split(/\s+/).filter(Boolean);
  const side = w.includes("izquierda") ? "left" : w.includes("derecha") ? "right" : "";
  if (!side) return undefined;
  const size = w.map(Number).find((x) => [33, 40, 50].includes(x)) || 40;
  const edge = w.includes("borde");
  return { side, size, hang: !edge && w.includes("fuera"), ...(edge ? { edge: true } : {}) };
}
export const wrapStr = (w) => (w && w.side ? `${w.side === "left" ? "izquierda" : "derecha"} ${w.size || 40}${w.edge ? " borde" : w.hang ? " fuera" : ""}` : "");
const withWrap = (b, str) => { const w = parseWrap(str); if (w) b.wrap = w; return b; };

// Shortcode arguments: "text" with \" escapes (what JSON.stringify writes and Nunjucks reads)
const args = (s) => [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => { try { return JSON.parse(`"${x[1]}"`); } catch { return x[1]; } });
const q = (v) => JSON.stringify(String(v ?? ""));

// {% fila "a", ["b", "c"], "completa" %}: strings are photos, an array is a vertical stack (and an array inside it a row again).
export const flatIds = (tree) => tree.flatMap((c) => (Array.isArray(c) ? flatIds(c) : [c]));
function parseFila(argText, raw) {
  let a; try { a = JSON.parse("[" + argText + "]"); } catch { return { type: "raw", text: raw }; }
  if (!a.every(function ok(x) { return typeof x === "string" || (Array.isArray(x) && x.every(ok)); })) return { type: "raw", text: raw };
  const full = a.includes("completa"), tree = a.filter((x) => x !== "completa");
  return { type: "fila", ids: flatIds(tree), ...(tree.some(Array.isArray) ? { tree } : {}), ...(full ? { full: true } : {}) };
}

// Blocks that wrap text and may contain blank lines: {% cita %}, {% recuadro %}, {% desplegable %}
const PAIRED = ["cita", "recuadro", "desplegable", "centrado", "caja"];

// Text box look, as words: background (gris | sin-fondo | amarillo | rojo | verde), "marco" (a frame) and
// "linea-rosa" (a thick line on the left: rosa | amarillo | verde | rojo). Older files used one word: gris | borde | acento | amarillo…
export const FONDOS = ["gris", "sin-fondo", "amarillo", "rojo", "verde"], LINEAS = ["rosa", "amarillo", "verde", "rojo"];
export function parseRecuadro(str) {
  const w = String(str || "gris").toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (w.length === 1 && w[0] === "borde") return { fondo: "sin-fondo", marco: true, linea: "" };
  if (w.length === 1 && w[0] === "acento") return { fondo: "gris", marco: false, linea: "rosa" };
  const l = (w.find((x) => x.startsWith("linea-")) || "").slice(6);
  return { fondo: w.find((x) => FONDOS.includes(x)) || (w.includes("sin") ? "sin-fondo" : "gris"), marco: w.includes("marco"), linea: LINEAS.includes(l) ? l : "" };
}
export const recuadroStr = (b) => [FONDOS.includes(b.fondo) ? b.fondo : "gris", b.marco ? "marco" : "", b.linea ? `linea-${b.linea}` : ""].filter(Boolean).join(" ");
// Free width for a text block: {% caja "12 70" %}…{% endcaja %} = from 12% to 70% of the content width (the photos' width)
const boxStr = (x) => `${Math.round(x.l * 10) / 10} ${Math.round(x.r * 10) / 10}`;
const BOXABLE = ["p", "h2", "h3", "ul", "ol", "callout", "details"];
const LIST_UL = /^[-*+]\s+/, LIST_OL = /^\d+[.)]\s+/;

export function parseBody(body) {
  const blocks = [];
  const lines = body.replace(/^\n+|\n+$/g, "").split("\n");
  let chunk = [];
  const flush = () => {
    if (!chunk.length) return;
    const t = chunk.join("\n").trim();
    chunk = [];
    if (!t) return;
    let m;
    if ((m = t.match(/^\{%\s*(foto|fotoancha)\s+(.*?)\s*%\}$/))) { const a = args(m[2]); blocks.push(withWrap({ type: "foto", id: a[0] }, a[1])); }
    else if ((m = t.match(/^\{%\s*ficha\s+(.*?)\s*%\}$/))) { const a = args(m[1]); blocks.push(withWrap({ type: "ficha", id: a[0] }, a[1])); }
    else if ((m = t.match(/^\{%\s*fila\s+(.*?)\s*%\}$/))) blocks.push(parseFila(m[1], t));
    else if ((m = t.match(/^\{%\s*pano\s+(.*?)\s*%\}$/))) {
      const a = args(m[1]);
      const b = { type: "pano", id: a[0], mode: ["alta", "completa"].includes(a[1]) ? a[1] : "" };
      if (Number(a[2]) > 0) b.h = Number(a[2]);
      if (b.mode === "alta") { b.mode = ""; b.h = b.h || 65; }
      blocks.push(b);
    }
    else if ((m = t.match(/^\{%\s*cita((?:\s*,?\s*"(?:[^"\\]|\\.)*")*)\s*%\}([\s\S]*?)\{%\s*endcita\s*%\}$/))) {
      const a = args(m[1]); const b = withWrap({ type: "quote", text: m[2].trim() }, a[0]); if (a[1]) b.by = a[1]; blocks.push(b);
    }
    else if ((m = t.match(/^\{%\s*recuadro((?:\s*,?\s*"(?:[^"\\]|\\.)*")*)\s*%\}([\s\S]*?)\{%\s*endrecuadro\s*%\}$/))) {
      const a = args(m[1]); blocks.push({ type: "callout", ...parseRecuadro(a[0]), text: m[2].trim() });
    }
    else if ((m = t.match(/^\{%\s*desplegable((?:\s*,?\s*"(?:[^"\\]|\\.)*")*)\s*%\}([\s\S]*?)\{%\s*enddesplegable\s*%\}$/))) {
      blocks.push({ type: "details", title: args(m[1])[0] || "", text: m[2].trim() });
    }
    else if ((m = t.match(/^\{%\s*centrado\s*%\}([\s\S]*?)\{%\s*endcentrado\s*%\}$/))) {
      const inner = parseBody(m[1]);
      if (inner.length === 1 && ["p", "h2", "h3"].includes(inner[0].type)) blocks.push({ ...inner[0], align: "center" }); else blocks.push({ type: "raw", text: t });
    }
    else if ((m = t.match(/^\{%\s*caja\s*"([\d.]+)\s+([\d.]+)"\s*%\}([\s\S]*?)\{%\s*endcaja\s*%\}$/))) {
      const inner = parseBody(m[3]), l = Number(m[1]), r = Number(m[2]);
      if (inner.length === 1 && BOXABLE.includes(inner[0].type) && r > l) blocks.push({ ...inner[0], box: { l, r } }); else blocks.push({ type: "raw", text: t });
    }
    else if (/^\{%\s*separador\s*%\}$/.test(t)) blocks.push({ type: "hr" });
    else if ((m = t.match(/^\{%\s*espacio\s*(.*?)\s*%\}$/))) { const a = args(m[1]); blocks.push({ type: "space", size: { s: 1.5, m: 3, l: 6 }[a[0]] ?? (Number(a[0]) || 3) }); }
    else if ((m = t.match(/^\{%\s*datos\s+(.*?)\s*%\}$/))) { const a = args(m[1]); const rows = []; for (let k = 0; k + 1 < a.length; k += 2) rows.push({ label: a[k], value: a[k + 1] }); blocks.push({ type: "datos", rows }); }
    else if ((m = t.match(/^\{%\s*boton\s+(.*?)\s*%\}$/))) { const a = args(m[1]); const bt = { type: "button", text: a[0] || "", url: a[1] || "", style: a[2] === "secundario" ? "secundario" : "primario" }; if (a[3] === "centro") bt.align = "center"; blocks.push(bt); }
    else if ((m = t.match(/^\{%\s*mapa\s+(.*?)\s*%\}$/))) { const a = args(m[1]); blocks.push({ type: "map", coords: a[0] || "", label: a[1] || "", zoom: a[2] || "11" }); }
    else if ((m = t.match(/^\{%\s*video\s+(.*?)\s*%\}$/))) { const a = args(m[1]); blocks.push({ type: "video", id: a[0] || "", caption: a[1] || "" }); }
    else if (/^###\s/.test(t) && !t.includes("\n")) blocks.push({ type: "h3", text: t.replace(/^###\s+/, "") });
    else if (/^##\s/.test(t) && !t.includes("\n")) blocks.push({ type: "h2", text: t.replace(/^##\s+/, "") });
    else if (t.split("\n").every((l) => LIST_UL.test(l))) blocks.push({ type: "ul", items: t.split("\n").map((l) => l.replace(LIST_UL, "").trim()) });
    else if (t.split("\n").every((l) => LIST_OL.test(l))) blocks.push({ type: "ol", items: t.split("\n").map((l) => l.replace(LIST_OL, "").trim()) });
    else if (/^\{%/.test(t) || /^(<|[-*+]\s|\d+\.\s|#|>)/.test(t)) blocks.push({ type: "raw", text: t });
    else blocks.push({ type: "p", text: t.replace(/\s*\n\s*/g, " ") });
  };
  let open = null;   // name of the paired block we are inside
  for (const line of lines) {
    if (!open) {
      const m = line.match(/^\{%\s*(\w+)/);
      if (m && PAIRED.includes(m[1]) && !new RegExp(`\\{%\\s*end${m[1]}\\s*%\\}\\s*$`).test(line)) { flush(); open = m[1]; chunk.push(line); continue; }
      if (line.trim() === "") flush(); else chunk.push(line);
    } else {
      chunk.push(line);
      if (new RegExp(`\\{%\\s*end${open}\\s*%\\}\\s*$`).test(line)) { open = null; flush(); }
    }
  }
  flush();
  if (!blocks.length) blocks.push({ type: "p", text: "" });
  return blocks;
}

export function serializeBlocks(blocks) {
  const isEmptyText = (b) => b.type === "p" && !b.text.trim();
  return blocks.filter((b) => !isEmptyText(b)).map((b) => {
    if (b.box && BOXABLE.includes(b.type)) return `{% caja "${boxStr(b.box)}" %}\n${serializeBlocks([{ ...b, box: undefined }])}\n{% endcaja %}`;
    if (b.align === "center" && ["p", "h2", "h3"].includes(b.type)) return `{% centrado %}\n${serializeBlocks([{ ...b, align: undefined }])}\n{% endcentrado %}`;
    switch (b.type) {
      case "p": return b.text.trim();
      case "h2": return `## ${b.text.trim()}`;
      case "h3": return `### ${b.text.trim()}`;
      case "quote": {
        const opts = b.wrap ? wrapStr(b.wrap) : "";
        const a = b.by ? ` ${q(opts)}, ${q(b.by)}` : opts ? ` ${q(opts)}` : "";
        return `{% cita${a} %}${b.text.trim()}{% endcita %}`;
      }
      case "foto": return `{% foto "${b.id}"${b.wrap ? `, "${wrapStr(b.wrap)}"` : ""} %}`;
      case "ficha": return `{% ficha "${b.id}"${b.wrap ? `, "${wrapStr(b.wrap)}"` : ""} %}`;
      case "fila": return `{% fila ${[...(b.tree || b.ids), ...(b.full ? ["completa"] : [])].map((i) => JSON.stringify(i)).join(", ")} %}`;
      case "pano": return `{% pano "${b.id}"${b.mode || b.h ? `, "${b.mode || ""}"` : ""}${b.h && b.mode !== "completa" ? `, "${Math.round(b.h)}"` : ""} %}`;
      case "ul": return (b.items || []).filter((x) => x.trim()).map((x) => `- ${x.trim()}`).join("\n") || "- ";
      case "ol": return (b.items || []).filter((x) => x.trim()).map((x, k) => `${k + 1}. ${x.trim()}`).join("\n") || "1. ";
      case "hr": return "{% separador %}";
      case "space": return `{% espacio "${Number(b.size) || 3}" %}`;
      case "datos": return `{% datos ${(b.rows || []).filter((r) => r.label || r.value).map((r) => `${q(r.label)}, ${q(r.value)}`).join(", ")} %}`;
      case "button": return `{% boton ${q(b.text)}, ${q(b.url)}${b.style === "secundario" || b.align === "center" ? `, "${b.style === "secundario" ? "secundario" : "primario"}"` : ""}${b.align === "center" ? ', "centro"' : ""} %}`;
      case "map": return `{% mapa ${q(b.coords)}, ${q(b.label)}, ${q(b.zoom || "11")} %}`;
      case "video": return `{% video ${q(b.id)}${b.caption ? `, ${q(b.caption)}` : ""} %}`;
      case "callout": return `{% recuadro "${recuadroStr(b)}" %}\n${(b.text || "").trim()}\n{% endrecuadro %}`;
      case "details": return `{% desplegable ${q(b.title)} %}\n${(b.text || "").trim()}\n{% enddesplegable %}`;
      default: return b.text;
    }
  }).join("\n\n");
}

export function serializeArticle({ meta, photos, fichas, blocks }) {
  const all = { ...meta, photos, fichas: fichas && Object.keys(fichas).length ? fichas : undefined };
  const ordered = {};
  for (const k of KEY_ORDER) if (all[k] !== undefined && all[k] !== "" && all[k] !== null) ordered[k] = all[k];
  for (const k of Object.keys(all)) if (!(k in ordered) && all[k] !== undefined && all[k] !== "" && all[k] !== null) ordered[k] = all[k];
  // Remove empty optional fields in photos
  for (const p of Object.values(ordered.photos || {})) for (const k of Object.keys(p)) if (p[k] === "" || p[k] === undefined) delete p[k];
  const fm = yaml.dump(ordered, { schema: yaml.CORE_SCHEMA, lineWidth: -1, noRefs: true, quotingType: '"' });
  return `---\n${fm}---\n${serializeBlocks(blocks)}\n`;
}

// What is missing before publishing (shown in the editor and checked again on publish)
export function problems(meta, photos, blocks, fichas = {}) {
  const list = [];
  if (!meta.title) list.push("Falta el título");
  if (!meta.description) list.push("Falta la descripción (aparece en Google)");
  if (!meta.hero) list.push("Falta la foto principal");
  else if (!meta.hero.alt) list.push("La foto principal no tiene texto alternativo");
  const used = new Set(blocks.flatMap((b) => (b.type === "foto" || b.type === "pano" ? [b.id] : b.type === "fila" ? b.ids : b.type === "ficha" && fichas[b.id]?.photo ? [fichas[b.id].photo] : [])));
  for (const b of blocks) if (b.type === "ficha" && !fichas[b.id]) list.push(`La ficha "${b.id}" no existe`);
  blocks.forEach((b, k) => {
    if (b.type === "button" && !b.url) list.push(`El botón "${b.text || k + 1}" no tiene dirección`);
    if (b.type === "video" && !b.id) list.push("Hay un video sin enlace de YouTube");
    if (b.type === "details" && !b.title) list.push("Hay un desplegable sin título");
    if (b.type === "map" && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(b.coords || "")) list.push("Hay un mapa sin lugar");
  });
  for (const id of used) {
    if (!photos[id]) list.push(`La foto "${id}" no existe`);
    else if (!photos[id].alt) list.push(`La foto "${id}" no tiene texto alternativo`);
  }
  return list;
}

// One line per article for the dashboard: words, photos, weight of its photos, things to review
const plainWords = (t) => { const w = String(t || "").replace(/<br>/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#>`]/g, " ").trim(); return w ? w.split(/\s+/).length : 0; };
export function articleStats(path, text, imgByDir = {}) {
  const { meta, photos, fichas, blocks } = parseArticle(text);
  let words = plainWords(meta.title) + plainWords(meta.subtitle);
  for (const b of blocks) { if (b.items) b.items.forEach((x) => (words += plainWords(x))); else { words += plainWords(b.text) + plainWords(b.title); } }
  const used = new Set(blocks.flatMap((b) => (b.type === "foto" || b.type === "pano" ? [b.id] : b.type === "fila" ? b.ids : b.type === "ficha" && fichas[b.id]?.photo ? [fichas[b.id].photo] : [])));
  const dir = (/\/assets\/img\/([^/]+)\//.exec(meta.imgBase || "") || [])[1];
  const issues = problems(meta, photos, blocks, fichas);
  const d = String(meta.description || "");
  if (d && d.length < 50) issues.push("La descripción para Google es muy corta (menos de 50 caracteres)");
  if (d.length > 165) issues.push("La descripción para Google es muy larga (más de 160 caracteres; Google la corta)");
  if (String(meta.title || "").length > 75) issues.push("El título es muy largo para Google (más de 70 caracteres)");
  if (meta.ai) issues.push("Tiene activado el aviso de texto escrito con IA");
  return {
    path, title: meta.title || path, section: meta.section || "", date: String(meta.date || ""), draft: !!meta.draft, ai: !!meta.ai, guia: !!meta.guia,
    words, minutes: Math.max(1, Math.round(words / 220)), photos: used.size + (meta.hero ? 1 : 0), imgBytes: dir ? imgByDir[dir] || 0 : 0, issues, permalink: meta.permalink || "",
  };
}
