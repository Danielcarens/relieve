// Test server for the editor: serves the editor and the site's assets as the real site does, plus two fakes:
//   /api/…  the local editor's server (local mode, ?modo=local)
//   /gh/…   a small GitHub (git objects, refs, contents) holding the repository's src/ and editor/acceso.json,
//           for the web editor (?modo=web&api=http://127.0.0.1:PORT/gh), which is the one in real use.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArticle, serializeArticle, problems, articleStats } from "../../editor/lib/article.js";

export const ROOT = path.resolve(import.meta.dirname, "../..");
const FIX = path.join(import.meta.dirname, "fixtures");
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon" };
export const OWNER = "Danielcarens", REPO = "relieve", BRANCH = "source";

// ---- a tiny git: blobs, trees (flat: path -> blob sha), commits, one branch -------------------------------------
function makeGit() {
  const blobs = new Map(), trees = new Map(), commits = new Map();
  const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");
  const putBlob = (buf) => { const s = sha(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])); blobs.set(s, buf); return s; };
  const putTree = (entries) => { const s = sha("tree " + JSON.stringify([...entries].sort())); trees.set(s, new Map(entries)); return s; };
  const putCommit = (tree, parents, message) => { const s = sha(`commit ${tree} ${parents.join(",")} ${message} ${Math.random()}`); commits.set(s, { tree, parents, message, date: new Date().toISOString() }); return s; };
  // the starting point: every file of src/ and editor/acceso.json, as they are in the working copy
  const entries = new Map();
  const add = (rel) => entries.set(rel, putBlob(fs.readFileSync(path.join(ROOT, rel))));
  for (const f of fs.readdirSync(path.join(ROOT, "src"), { recursive: true })) { const rel = path.join("src", f); if (fs.statSync(path.join(ROOT, rel)).isFile()) add(rel); }
  if (fs.existsSync(path.join(ROOT, "editor/acceso.json"))) add("editor/acceso.json");
  const git = { blobs, trees, commits, head: putCommit(putTree(entries), [], "inicio"), log: [] };
  git.putBlob = putBlob; git.putTree = putTree; git.putCommit = putCommit;
  git.files = (commit = git.head) => trees.get(commits.get(commit).tree);
  git.read = (p, commit = git.head) => { const s = git.files(commit).get(p); return s ? blobs.get(s).toString("utf8") : null; };
  // a commit that writes one file (as someone else changing the repository)
  git.write = (p, text, message = "prueba") => { const t = new Map(git.files()); t.set(p, putBlob(Buffer.from(text))); git.head = putCommit(putTree(t), [git.head], message); };
  return git;
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });

function github(git, req, res, u, body) {
  const p = u.pathname.replace(/^\/gh/, ""), R = `/repos/${OWNER}/${REPO}`;
  const j = () => JSON.parse(body.toString() || "{}");
  let m;
  if (req.headers.authorization !== "Bearer test-token" && !(req.method === "GET" && p.startsWith(`${R}/contents/editor/acceso.json`))) return send(res, 401, { message: "Bad credentials" });
  // for tests: refuse the next N tree writes with 401 although the key is fine
  if (git.fail401 > 0 && req.method === "POST" && p === `${R}/git/trees`) { git.fail401--; return send(res, 401, { message: "Bad credentials" }); }
  if (p === R) return send(res, 200, { full_name: `${OWNER}/${REPO}` });
  if (p === `${R}/git/ref/heads/${BRANCH}`) return send(res, 200, { object: { sha: git.head } });
  if ((m = p.match(new RegExp(`^${R}/git/commits/(\\w+)$`))) && req.method === "GET") { const c = git.commits.get(m[1]); return c ? send(res, 200, { sha: m[1], tree: { sha: c.tree } }) : send(res, 404, {}); }
  if ((m = p.match(new RegExp(`^${R}/git/trees/(\\w+)$`))) && req.method === "GET") {
    const t = git.trees.get(m[1]); if (!t) return send(res, 404, {});
    return send(res, 200, { sha: m[1], tree: [...t].map(([path, sha]) => ({ path, type: "blob", mode: "100644", sha, size: git.blobs.get(sha).length })) });
  }
  if ((m = p.match(new RegExp(`^${R}/git/blobs/(\\w+)$`)))) { const b = git.blobs.get(m[1]); return b ? send(res, 200, { sha: m[1], content: b.toString("base64"), encoding: "base64" }) : send(res, 404, {}); }
  if (p === `${R}/git/blobs` && req.method === "POST") { const b = j(); return send(res, 201, { sha: git.putBlob(Buffer.from(b.content, b.encoding === "base64" ? "base64" : "utf8")) }); }
  if (p === `${R}/git/trees` && req.method === "POST") {
    const b = j(), base = git.trees.get(b.base_tree); if (!base) return send(res, 422, { message: "bad base" });
    const t = new Map(base); for (const it of b.tree) { if (it.sha === null) t.delete(it.path); else t.set(it.path, it.sha); }
    return send(res, 201, { sha: git.putTree(t) });
  }
  if (p === `${R}/git/commits` && req.method === "POST") { const b = j(); return send(res, 201, { sha: git.putCommit(b.tree, b.parents, b.message) }); }
  if (p === `${R}/git/refs/heads/${BRANCH}` && req.method === "PATCH") {
    const b = j(), c = git.commits.get(b.sha); if (!c) return send(res, 422, { message: "no commit" });
    if (!b.force && !c.parents.includes(git.head)) return send(res, 422, { message: "Update is not a fast forward" });
    git.head = b.sha; git.log.push(c.message); return send(res, 200, { object: { sha: b.sha } });
  }
  if (p === `${R}/commits`) return send(res, 200, [...git.log].reverse().map((message, k) => ({ sha: "c" + k + "0000000", commit: { message, author: { name: "Prueba", date: new Date().toISOString() } } })));
  if ((m = p.match(new RegExp(`^${R}/contents/(.+)$`)))) {
    const file = decodeURIComponent(m[1]), s = git.files().get(file);
    if (req.method === "GET") {
      if (!s) return send(res, 404, { message: "Not Found" });
      if ((req.headers.accept || "").includes("raw")) return send(res, 200, git.blobs.get(s), "application/json");
      return send(res, 200, { sha: s, content: git.blobs.get(s).toString("base64"), encoding: "base64" });
    }
    if (req.method === "PUT") {
      const b = j(), t = new Map(git.files()); t.set(file, git.putBlob(Buffer.from(b.content, "base64")));
      const c = git.putCommit(git.putTree(t), [git.head], b.message); git.head = c; git.log.push(b.message); return send(res, 200, { content: { sha: t.get(file) } });
    }
  }
  return send(res, 404, { message: `fake GitHub: ${req.method} ${p}` });
}

// ---- the local editor's server, enough of it for the editor's local mode -----------------------------------------
function localApi(state, req, res, u, body) {
  const route = `${req.method} ${u.pathname}`, q = u.searchParams;
  const file = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const list = () => fs.readdirSync(path.join(ROOT, "src/es"), { recursive: true }).filter((f) => f.endsWith(".md")).map((f) => path.join("src/es", f));
  switch (route) {
    case "GET /api/status": return send(res, 200, { ready: true, branch: BRANCH, changes: 0, cfg: { author: "Daniel" } });
    case "GET /api/articles": return send(res, 200, list().map((p) => { const { meta } = parseArticle(state.saved[p] || file(p)); return { path: p, title: meta.title, section: meta.section, date: String(meta.date || ""), draft: !!meta.draft, ai: !!meta.ai, guia: !!meta.guia, hero: null }; }));
    case "GET /api/article": { const p = q.get("path"), m = parseArticle(state.saved[p] || file(p)); return send(res, 200, { ...m, problems: problems(m.meta, m.photos, m.blocks, m.fichas) }); }
    case "POST /api/article": { const b = JSON.parse(body); state.saved[b.path] = serializeArticle(b); state.saves++; return send(res, 200, { ok: true, problems: problems(b.meta, b.photos, b.blocks, b.fichas) }); }
    case "POST /api/photo": { state.photos++; const tall = state.photos % 2 === 1; return send(res, 200, { file: `test-${state.photos}`, w: tall ? 337 : 800, h: tall ? 600 : 522 }); }
    case "GET /api/dashboard": return send(res, 200, { articles: list().map((p) => articleStats(p, file(p), {})), sizes: { images: 1, texts: 1, total: 2 }, commits: [], drafts: 0, mode: "local" });
    default: return send(res, 200, { ok: true });
  }
}

export async function start({ editorDir = path.join(ROOT, "editor/public") } = {}) {
  const git = makeGit(), state = { saved: {}, saves: 0, photos: 0 }, requests = [];
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x"), p = decodeURIComponent(u.pathname), body = await readBody(req);
    requests.push(req.url);
    try {
      if (p.startsWith("/gh/")) return github(git, req, res, u, body);
      if (p.startsWith("/api/")) return localApi(state, req, res, u, body);
      if (p === "/" || p === "/index.html") {
        const html = fs.readFileSync(path.join(editorDir, "index.html"), "utf8").replace("<!--LOGO-DEFS-->", fs.readFileSync(path.join(ROOT, "src/_includes/partials/logo-defs.njk"), "utf8"));
        return send(res, 200, html, "text/html");
      }
      let f;
      if (/\/test-\d+(-sm)?\.jpg$/.test(p)) f = path.join(FIX, Number(p.match(/test-(\d+)/)[1]) % 2 ? "alta.jpg" : "ancha.jpg");   // photos the fake local server "made"
      else if (p.startsWith("/assets/")) f = path.join(ROOT, "src", p);
      else if (p.startsWith("/originals/")) { const m = p.match(/^\/originals\/([^/]+)\/(.+)$/); f = m && path.join(ROOT, "src/assets/img", m[1], m[2]); }
      else if (p.startsWith("/lib/")) f = fs.existsSync(path.join(editorDir, p)) ? path.join(editorDir, p) : path.join(ROOT, "editor", p);
      else if (p.startsWith("/fixtures/")) f = path.join(FIX, p.slice(10));
      else if (p === "/logo-defs.svg") f = path.join(ROOT, "src/_includes/partials/logo-defs.njk");
      else f = path.join(editorDir, p);
      if (!f || !(f.startsWith(ROOT) || f.startsWith(editorDir)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, "no: " + p, "text/plain");
      return send(res, 200, fs.readFileSync(f), TYPES[path.extname(f)] || "application/octet-stream");
    } catch (e) { return send(res, 500, { error: e.message }); }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const port = server.address().port;
  return { port, url: `http://127.0.0.1:${port}`, git, state, requests, close: () => new Promise((ok) => server.close(ok)) };
}
