// Where the editor runs (local server or web, with GitHub) and the small API client both use.
// ---- where the editor runs -------------------------------------------------------------------
// local: started with "Iniciar editor.bat" (Node server on this computer, git, Eleventy preview)
// web:   opened from the website (relievemag.com/editor/): GitHub API + the browser (web.js)
export const MODE =
  new URLSearchParams(location.search).get("modo") ||
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "local" : "web");
export const env = { web: null }; // web.js (GitHub) once the web editor has loaded it
window.EDITOR_MODE = MODE;

// ---- tiny API client -------------------------------------------------------------------
export async function api(path, opts = {}) {
  if (MODE === "web") return env.web.handle(opts.method || "GET", path, opts.body);
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Error ${r.status}`), { conflict: !!j.conflict });
  return j;
}
export const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
