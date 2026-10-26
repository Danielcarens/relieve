// The article being edited (ED) and the editor's own state (S). No imports but env.js, so every module can use them from the start.
import { MODE, env } from "./env.js";
export const ED = window.ED = { path: null, meta: null, photos: {}, fichas: {}, blocks: [], sel: null, tab: "article", problems: [], heroV: 0, cfg: {} };
export const S = { hist: [], fut: [], lastType: 0, saveTimer: null, saving: false, dirty: false, device: "desktop", lastCaret: null, heroTimer: null };   // the editor's own state (history, saving, view)
export const imgSrc = window.imgSrc = (base, file, suf) => (MODE === "web" && env.web && env.web.pendingUrl(`src${base}${file}${suf}`)) || `${base}${file}${suf}`;
export const heroSrc = window.heroSrc = (m) => {
  const h = m.hero, dir = (/\/assets\/img\/([^/]+)\//.exec(m.imgBase || "") || [])[1];
  if (MODE === "web") return (env.web && env.web.heroSourceUrl(m)) || window.imgSrc(m.imgBase, h.file, "-1280.jpg");
  return h.srcW && dir ? `/originals/${dir}/${h.file || "hero"}-source.jpg?v=${ED.heroV || 0}` : `${m.imgBase}${h.file}-1280.jpg?v=${ED.heroV || 0}`;
};
