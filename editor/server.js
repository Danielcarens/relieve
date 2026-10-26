// RELIEVE editor: local server (only reachable from this computer).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync, spawn } from "node:child_process";
import { parseArticle, serializeArticle, problems, articleStats } from "./lib/article.js";
import { importPhoto, makeHero, slugify } from "./lib/photos.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(HERE, "config.json");
const DEFAULTS = {
  port: 4321,
  repo: "https://github.com/Danielcarens/relieve.git",
  sourceBranch: "source",          // Eleventy source
  liveBranch: "main",              // what GitHub Pages serves
  sitePath: "site",                // clone of the source branch
  author: "Daniel",
  credit: "Daniel Cárdenas",
};
const cfg = { ...DEFAULTS, ...(fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) : {}) };
const abs = (p) => (path.isAbsolute(p) ? p : path.join(HERE, p));
const SITE = abs(cfg.sitePath), ORIG = path.join(HERE, "originals");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain" };

// ---- helpers ---------------------------------------------------------------
const run = (cmd, args, cwd) => new Promise((res, rej) =>
  execFile(cmd, args, {
    cwd, maxBuffer: 50e6,
    shell: process.platform === "win32" && cmd === "npm",   // npm is a .cmd file on Windows; git and node are not (and shell would break messages with spaces)
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }, (e, out, err) =>
    e ? rej(new Error((err || out || e.message).toString().trim())) : res(out.toString())));
const git = (cwd, ...a) => run("git", a, cwd);
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
const readBody = (req, limit = 200e6) => new Promise((res, rej) => {
  const parts = []; let n = 0;
  req.on("data", (c) => { n += c.length; if (n > limit) { rej(new Error("Archivo demasiado grande")); req.destroy(); } else parts.push(c); });
  req.on("end", () => res(Buffer.concat(parts)));
  req.on("error", rej);
});
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };  // local date, not UTC

function articlePath(rel) {            // rel like "src/es/viajes/x.md"; refuse anything outside src
  const full = path.resolve(SITE, rel);
  if (!full.startsWith(path.join(SITE, "src") + path.sep) || !full.endsWith(".md")) throw new Error("Ruta no válida");
  return full;
}
const imgDirOf = (meta) => {
  const m = /^\/assets\/img\/([^/]+)\/$/.exec(meta.imgBase || "");
  if (!m) throw new Error("El artículo no tiene carpeta de imágenes (imgBase)");
  return m[1];
};

// The cover's file name. Normally "hero"; when another article uses the same image folder and the same name
// (guides copied from an article, for example), this one gets "hero-<file name>" so changing it does not change the other.
function heroNameFor(rel, meta) {
  const prev = (meta.hero && meta.hero.file) || "hero";
  const clash = listArticles().some((a) => a.path !== rel && a.hero === `${meta.imgBase}${prev}-1280.jpg`);
  return { prev, name: clash ? `hero-${slugify(path.basename(rel, ".md"))}` : prev };
}

function listArticles() {
  const out = [], root = path.join(SITE, "src");
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "assets" && e.name !== "_includes" && e.name !== "_data") walk(p); }
    else if (e.name.endsWith(".md")) {
      try { const { meta } = parseArticle(fs.readFileSync(p, "utf8"));
        out.push({ path: path.relative(SITE, p).replace(/\\/g, "/"), title: meta.title || e.name, section: meta.section, date: meta.date, draft: !!meta.draft, ai: !!meta.ai, guia: !!meta.guia, permalink: meta.permalink, hero: meta.hero ? `${meta.imgBase}${meta.hero.file}-1280.jpg` : null });
      } catch (err) {   // an article that cannot be read must not vanish from the list
        const raw = fs.readFileSync(p, "utf8");
        if (/layout:\s*layouts\/article/.test(raw)) out.push({ path: path.relative(SITE, p).replace(/\\/g, "/"), title: e.name, error: /^<<<<<<< /m.test(raw) ? "Tiene un conflicto de Git sin resolver" : "No se puede leer: " + err.message, date: "" });
      } } } };
  if (fs.existsSync(root)) walk(root);
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

let building = Promise.resolve();
function build() {
  building = building.then(() => run(process.execPath, [path.join("node_modules", "@11ty", "eleventy", "cmd.cjs"), "--quiet"], SITE));
  return building.catch((e) => { building = Promise.resolve(); throw e; });
}

// ---- API -------------------------------------------------------------------
const api = {
  async "GET /api/status"() {
    const ready = fs.existsSync(path.join(SITE, "src")) && fs.existsSync(path.join(SITE, "node_modules"));
    let branch = "", changes = 0;
    if (ready) { try { branch = (await git(SITE, "rev-parse", "--abbrev-ref", "HEAD")).trim(); changes = (await git(SITE, "status", "--porcelain")).split("\n").filter(Boolean).length; } catch {} }
    return { ready, branch, changes, site: SITE, cfg: { author: cfg.author, credit: cfg.credit } };
  },
  async "GET /api/articles"() { return listArticles(); },
  async "GET /api/article"(req, res, q) {
    const model = parseArticle(fs.readFileSync(articlePath(q.get("path")), "utf8"));
    return { ...model, problems: problems(model.meta, model.photos, model.blocks, model.fichas) };
  },
  async "POST /api/article"(req) {
    const b = JSON.parse((await readBody(req)).toString());
    const file = articlePath(b.path);
    fs.writeFileSync(file, serializeArticle(b));
    return { ok: true, problems: problems(b.meta, b.photos, b.blocks, b.fichas) };
  },
  async "POST /api/new"(req) {
    const { title, section } = JSON.parse((await readBody(req)).toString());
    const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "articulo";
    const dir = path.join(SITE, "src", "es", section);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug}.md`);
    if (fs.existsSync(file)) throw new Error("Ya existe un artículo con ese nombre");
    const model = { meta: { layout: "layouts/article.njk", permalink: `/es/${section}/${slug}/`, section, title, description: "", date: today(),
      author: cfg.author, credit: cfg.credit, draft: true, imgBase: `/assets/img/${slug}/` }, photos: {}, fichas: {}, blocks: [{ type: "p", text: "" }] };
    fs.writeFileSync(file, serializeArticle(model));
    return { path: path.relative(SITE, file).replace(/\\/g, "/") };
  },
  async "POST /api/photo"(req, res, q) {
    const rel = q.get("article");
    const { meta } = parseArticle(fs.readFileSync(articlePath(rel), "utf8"));
    const dirName = imgDirOf(meta);
    const buf = await readBody(req);
    const imgDir = path.join(SITE, "src", "assets", "img", dirName), origDir = path.join(ORIG, dirName);
    if (q.get("kind") === "hero") return await makeHero({ buf, imgDir, origDir, pos: q.get("pos") || "50% 50%", ...heroNameFor(rel, meta) });
    return await importPhoto({ buf, name: q.get("name") || "foto.jpg", imgDir, origDir });
  },
  async "POST /api/hero-pos"(req, res, q) {
    const rel = q.get("article");
    const { meta } = parseArticle(fs.readFileSync(articlePath(rel), "utf8"));
    const dirName = imgDirOf(meta);
    return await makeHero({ imgDir: path.join(SITE, "src", "assets", "img", dirName), origDir: path.join(ORIG, dirName), pos: q.get("pos"), zoom: q.get("zoom"), ...heroNameFor(rel, meta) });
  },
  async "GET /api/dashboard"() {
    const imgRoot = path.join(SITE, "src", "assets", "img"), imgByDir = {}; let images = 0, texts = 0;
    const walk = (d, fn) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, fn); else fn(p); } };
    walk(imgRoot, (p) => { const n = fs.statSync(p).size; images += n; const dir = path.relative(imgRoot, p).split(path.sep)[0]; imgByDir[dir] = (imgByDir[dir] || 0) + n; });
    const articles = [];
    walk(path.join(SITE, "src"), (p) => { if (!p.endsWith(".md") || p.includes(`${path.sep}assets${path.sep}`)) return; texts += fs.statSync(p).size;
      if (p.includes(`${path.sep}es${path.sep}`)) { try { articles.push(articleStats(path.relative(SITE, p).replace(/\\/g, "/"), fs.readFileSync(p, "utf8"), imgByDir)); } catch { } } });
    let commits = [];
    try { commits = (await git(SITE, "log", "-12", "--format=%h%x09%aI%x09%an%x09%s")).trim().split("\n").filter(Boolean).map((l) => { const [sha, date, author, message] = l.split("\t"); return { sha, date, author, message }; }); } catch { }
    let drafts = 0; try { drafts = (await git(SITE, "status", "--porcelain", "src")).split("\n").filter(Boolean).length; } catch { }
    return { articles, sizes: { images, texts, total: images + texts }, commits, drafts, mode: "local" };
  },
  // Visitor statistics: the browser asks through here so GoatCounter never blocks it (CORS)
  async "POST /api/gc"(req) {
    const { url, token } = JSON.parse((await readBody(req)).toString());
    if (!/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/api\/v0\//.test(url)) throw new Error("Dirección de estadísticas no válida");
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `GoatCounter respondió ${r.status}`); return j;
  },
  async "POST /api/goatcounter"(req) {
    const { code } = JSON.parse((await readBody(req)).toString()), f = path.join(SITE, "src", "_data", "site.js");
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/goatcounter:\s*"[^"]*"/, `goatcounter: ${JSON.stringify(code)}`));
    return { ok: true, note: "Se publicará con el próximo «Publicar»." };
  },
  async "POST /api/preview"() { await build(); return { ok: true }; },
  async "POST /api/sync"() {          // bring the latest changes from GitHub, keeping every unsaved draft safe
    // Local edits are committed first (nothing is stashed or overwritten). If GitHub changed the same lines, the merge is
    // cancelled and the drafts stay exactly as they were.
    if ((await git(SITE, "status", "--porcelain", "src")).trim()) {
      await git(SITE, "add", "-A", "src");
      await git(SITE, "commit", "-m", "Borrador guardado\n\nCo-Authored-By: Relieve Editor <noreply@relievemag.com>");
    }
    try { await git(SITE, "pull", "--rebase", "--autostash", "origin", cfg.sourceBranch); }
    catch (e) { try { await git(SITE, "rebase", "--abort"); } catch {} throw new Error("No se trajeron los cambios porque otra persona modificó el mismo artículo. Tus borradores están intactos. Pide ayuda antes de seguir: " + e.message); }
    return { ok: true };
  },
  // Save the source on its branch. GitHub Actions then builds the site with Eleventy and publishes it
  // (.github/workflows/publicar.yml in the relieve repo), so nobody has to copy files by hand.
  async "POST /api/publish"(req) {
    const { message } = JSON.parse((await readBody(req)).toString());
    const msg = (message || "Actualiza artículos").trim();
    const trailer = "\n\nCo-Authored-By: Relieve Editor <noreply@relievemag.com>";
    await build();                                    // fails here if the site would not build
    await git(SITE, "add", "-A", "src");
    if ((await git(SITE, "status", "--porcelain", "src")).trim()) await git(SITE, "commit", "-m", msg + trailer);
    try { await git(SITE, "pull", "--rebase", "--autostash", "origin", cfg.sourceBranch); }   // other editors may have published meanwhile
    catch (e) { try { await git(SITE, "rebase", "--abort"); } catch {} throw new Error("Otra persona cambió el mismo archivo. Pide ayuda antes de publicar: " + e.message); }
    await git(SITE, "push", "origin", cfg.sourceBranch);
    return { ok: true, pushed: true };
  },
};

// ---- static ----------------------------------------------------------------
function send(res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("No encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(file).pipe(res);
}
const safeJoin = (root, p) => { const f = path.resolve(root, "." + decodeURIComponent(p)); return f.startsWith(path.resolve(root)) ? f : null; };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const handler = api[`${req.method} ${url.pathname}`];
    if (handler) return json(res, 200, await handler(req, res, url.searchParams));
    if (url.pathname.startsWith("/assets/")) { const f = safeJoin(path.join(SITE, "src"), url.pathname); return f ? send(res, f) : (res.writeHead(403), res.end()); }
    if (url.pathname.startsWith("/originals/")) {   // the cover's original; if it was chosen on another computer, the copy in the repo
      let f = safeJoin(ORIG, url.pathname.slice("/originals".length)); if (!f) { res.writeHead(403); return res.end(); }
      const m = url.pathname.match(/^\/originals\/([^/]+)\/(hero[a-z0-9-]*-source)\.jpg$/);
      if (!fs.existsSync(f) && m) f = safeJoin(path.join(SITE, "src", "assets", "img"), `/${m[1]}/${m[2]}.jpg`);
      return send(res, f);
    }
    if (url.pathname.startsWith("/preview/")) {
      let f = safeJoin(path.join(SITE, "_site"), url.pathname.slice("/preview".length)); if (!f) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      return send(res, f);
    }
    // Links clicked inside the preview (menu, logo, other articles) open the built site, not the editor
    const ref = (() => { try { return new URL(req.headers.referer || "").pathname; } catch { return ""; } })();
    if ((ref.startsWith("/preview/") || /^\/(?!index\.html)[\w-]+\.html$/.test(ref) || ref.startsWith("/es/")) && (url.pathname === "/" || /^\/[\w-]+\.html$/.test(url.pathname) || /^\/(es|pagefind)\//.test(url.pathname))) {
      let f = safeJoin(path.join(SITE, "_site"), url.pathname === "/" ? "/index.html" : url.pathname);
      if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (f && fs.existsSync(f)) return send(res, f);
    }
    if (url.pathname === "/lib/article.js") return send(res, path.join(HERE, "lib", "article.js"));
    if (url.pathname === "/favicon.svg") return send(res, path.join(SITE, "src", "favicon.svg"));
    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    if (p === "/index.html") {   // the site's own logo (same SVG the site's navbar uses)
      const defs = path.join(SITE, "src", "_includes", "partials", "logo-defs.njk");
      const html = fs.readFileSync(path.join(HERE, "public", "index.html"), "utf8").replace("<!--LOGO-DEFS-->", fs.existsSync(defs) ? fs.readFileSync(defs, "utf8") : "");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" }); return res.end(html);
    }
    const f = safeJoin(path.join(HERE, "public"), p);
    return f ? send(res, f) : (res.writeHead(403), res.end());
  } catch (e) { json(res, 500, { error: e.message }); }
});

// ---- first run: get the site and install what it needs ---------------------------------
async function setup() {
  if (!fs.existsSync(path.join(SITE, ".git"))) {
    console.log("Primera vez: descargando el sitio desde GitHub…");
    await git(HERE, "clone", "--branch", cfg.sourceBranch, cfg.repo, SITE);
  }
  if (!fs.existsSync(path.join(SITE, "node_modules"))) {
    console.log("Primera vez: instalando Eleventy (un par de minutos)…");
    await run("npm", ["install", "--no-audit", "--no-fund"], SITE);
  }
}
try { await setup(); } catch (e) { console.error("No se pudo preparar el sitio:", e.message); }
const openBrowser = (url) => {
  if (process.env.NO_OPEN) return;
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
};
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`\nEl editor ya está abierto en otra ventana (puerto ${cfg.port}). Abro esa copia en el navegador.`);
    console.log("Si lo acabas de actualizar, cierra la otra ventana negra y abre este archivo otra vez.\n");
    openBrowser(`http://localhost:${cfg.port}`);
  } else console.error("No se pudo iniciar:", e.message);
});
server.listen(cfg.port, "127.0.0.1", () => {
  const url = `http://localhost:${cfg.port}`;
  console.log(`Editor de RELIEVE listo en ${url}  (cierra esta ventana para apagarlo)`);
  openBrowser(url);
});
