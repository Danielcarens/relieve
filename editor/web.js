// web.js — what the editor's local server does, done in the browser when the editor runs on the website.
// Articles and photos are read from and written to the GitHub repository with the GitHub API. Photos are resized
// here (canvas). Work in progress is kept in this browser (IndexedDB) until "Publicar", which makes ONE commit
// on the source branch; GitHub Actions then builds and publishes the site, exactly like the local editor.
//
// Access: each person has a user name and a password. The password decrypts (AES-GCM, key from PBKDF2-SHA256,
// 600 000 rounds; the same scheme as the open-source StatiCrypt) a fine-grained GitHub token stored in
// editor/acceso.json. Nothing secret is stored in clear anywhere; the decrypted token only lives in this tab.
import { parseArticle, serializeArticle, problems, articleStats } from "./lib/article.js";

export const REPO = { owner: "Danielcarens", repo: "relieve", branch: "source" };
// For tests on this computer only: ?api=http://127.0.0.1:… (ignored on the real site, so nobody can redirect the token)
const API = () =>
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("api")) ||
  "https://api.github.com";
const R = `/repos/${REPO.owner}/${REPO.repo}`;
const enc = new TextEncoder(),
  dec = new TextDecoder();

// ---- session --------------------------------------------------------------------------------------------
export const session = {
  get token() {
    try {
      return sessionStorage.getItem("relieve-token");
    } catch {
      return null;
    }
  },
  get name() {
    try {
      return sessionStorage.getItem("relieve-name") || "";
    } catch {
      return "";
    }
  },
  set(token, name) {
    sessionStorage.setItem("relieve-token", token);
    sessionStorage.setItem("relieve-name", name);
  },
  clear() {
    sessionStorage.removeItem("relieve-token");
    sessionStorage.removeItem("relieve-name");
  },
};

// ---- small IndexedDB key-value store --------------------------------------------------------------------
let dbp = null;
function db() {
  return (
    dbp ||
    (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("relieve-editor", 1);
      r.onupgradeneeded = () => {
        for (const s of ["drafts", "blobs", "cache"]) r.result.createObjectStore(s);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }))
  );
}
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const q = fn(t.objectStore(store));
    t.oncomplete = () => res(q && q.result);
    t.onerror = () => rej(t.error);
  });
};
const kv = {
  get: (s, k) => tx(s, "readonly", (o) => o.get(k)),
  set: (s, k, v) => tx(s, "readwrite", (o) => o.put(v, k)),
  del: (s, k) => tx(s, "readwrite", (o) => o.delete(k)),
  keys: (s) => tx(s, "readonly", (o) => o.getAllKeys()),
};

// ---- GitHub ---------------------------------------------------------------------------------------------
async function gh(method, path, body, { auth = true } = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(API() + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (r.status === 401 && auth) {
    session.clear();
    throw new Error("La sesión venció o la llave de GitHub ya no sirve. Vuelve a entrar.");
  }
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok)
    throw Object.assign(new Error(j.message ? `GitHub: ${j.message}` : `GitHub respondió ${r.status}`), {
      status: r.status,
    });
  return j;
}
const b64ToBytes = (b64) => {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
const bytesToB64 = (u8) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};

let treeCache = null,
  treeAt = 0;
async function tree(force = false) {
  if (!force && treeCache && Date.now() - treeAt < 20000) return treeCache;
  const ref = await gh("GET", `${R}/git/ref/heads/${REPO.branch}`);
  const commit = await gh("GET", `${R}/git/commits/${ref.object.sha}`);
  const t = await gh("GET", `${R}/git/trees/${commit.tree.sha}?recursive=1`);
  treeCache = {
    commit: ref.object.sha,
    treeSha: commit.tree.sha,
    entries: new Map(t.tree.filter((e) => e.type === "blob").map((e) => [e.path, e])),
  };
  treeAt = Date.now();
  return treeCache;
}
async function readText(path) {
  const e = (await tree()).entries.get(path);
  if (!e) throw new Error(`No existe ${path}`);
  const c = await kv.get("cache", e.sha);
  if (typeof c === "string") return c;
  const b = await gh("GET", `${R}/git/blobs/${e.sha}`);
  const txt = dec.decode(b64ToBytes(b.content));
  await kv.set("cache", e.sha, txt);
  return txt;
}

// ---- photos (resized in the browser; the canvas re-encodes, so EXIF and GPS are gone) ----------------------
const urls = new Map(); // repo path -> object URL of a photo not published yet
export const pendingUrl = (p) => urls.get(p);
// Photo files an unpublished article uses (its photos and its cover), as repo paths, plus the cover's full original.
function draftFiles(model) {
  const out = new Set();
  let dir;
  try {
    dir = dirOf(model.meta);
  } catch {
    return out;
  }
  const base = `src/assets/img/${dir}/`;
  for (const ph of Object.values(model.photos || {}))
    if (ph && ph.file) {
      out.add(`${base}${ph.file}.jpg`);
      out.add(`${base}${ph.file}-sm.jpg`);
    }
  const h = model.meta.hero;
  if (h && h.file) {
    for (const w of [1280, 1920, 2560]) out.add(`${base}${h.file}-${w}.jpg`);
    out.add(`${base}${h.file}-source.jpg`);
    out.add(`orig/${dir}/${h.file}-source`);
  }
  return out;
}
async function usedByDrafts(except) {
  const used = new Set();
  for (const p of await kv.keys("drafts"))
    if (p !== except) {
      const d = await kv.get("drafts", p);
      if (d && d.model) for (const k of draftFiles(d.model)) used.add(k);
    }
  return used;
}
async function dropBlob(k) {
  await kv.del("blobs", k);
  const u = urls.get(k);
  if (u) {
    URL.revokeObjectURL(u);
    urls.delete(k);
  }
}
export async function loadPending() {
  // Photos that no unpublished article uses any more (replaced, or left by a discarded article) are deleted, so they
  // cannot show up in, or be published with, another article that uses the same folder.
  const used = await usedByDrafts(null);
  for (const k of await kv.keys("blobs")) {
    if (!used.has(k)) {
      await kv.del("blobs", k);
      continue;
    }
    if (!urls.has(k)) {
      const v = await kv.get("blobs", k);
      if (v && v.blob) urls.set(k, URL.createObjectURL(v.blob));
    }
  }
}
async function putBlob(path, blob) {
  await kv.set("blobs", path, { blob, at: Date.now() });
  const old = urls.get(path);
  if (old) URL.revokeObjectURL(old);
  urls.set(path, URL.createObjectURL(blob));
}
export function slugify(name) {
  return (
    String(name)
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "foto"
  );
}
const dirOf = (meta) => {
  const m = /^\/assets\/img\/([^/]+)\/$/.exec(meta.imgBase || "");
  if (!m) throw new Error("El artículo no tiene carpeta de imágenes (imgBase)");
  return m[1];
};
async function jpeg(bmp, w, h, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
}
const decode = (file) => createImageBitmap(file, { imageOrientation: "from-image" });

async function importPhoto(articlePath, file, name) {
  const { meta } = await getArticle(articlePath);
  const dir = dirOf(meta),
    base = `src/assets/img/${dir}/`;
  const t = await tree();
  let slug = slugify(name),
    n = 1;
  const taken = (s) => t.entries.has(`${base}${s}.jpg`) || urls.has(`${base}${s}.jpg`) || s === "hero";
  while (taken(slug)) slug = `${slugify(name)}-${++n}`;
  const bmp = await decode(file);
  const maxW = bmp.width / bmp.height > 2.2 ? 6000 : 3600;
  const w = Math.min(maxW, bmp.width),
    h = Math.round((w * bmp.height) / bmp.width);
  await putBlob(`${base}${slug}.jpg`, await jpeg(bmp, w, h));
  const sw = Math.round(w / 2);
  await putBlob(`${base}${slug}-sm.jpg`, await jpeg(bmp, sw, Math.round((sw * h) / w)));
  return { file: slug, w, h };
}
// The cover is always 16:9, cropped from the original around `pos`. A copy of the uncropped photo (hero-source.jpg,
// at most 2600 px wide) is published with the article, so the cover can be reframed later from any computer.
async function repoBlob(path) {
  const e = (await tree()).entries.get(path);
  if (!e) return null;
  const b = await gh("GET", `${R}/git/blobs/${e.sha}`);
  return new Blob([b64ToBytes(b.content)], { type: "image/jpeg" });
}
// The cover's file name: "hero", or "hero-<file name>" when another article uses the same folder and name (see server.js).
async function heroNameFor(articlePath, meta) {
  const prev = (meta.hero && meta.hero.file) || "hero";
  const t = await tree(),
    drafts = await kv.keys("drafts");
  const paths = new Set(
    [...[...t.entries.keys()], ...drafts].filter((p) => /^src\/es\/.+\.md$/.test(p) && p !== articlePath),
  );
  let clash = false;
  for (const p of paths) {
    try {
      const m = (await getArticle(p)).meta;
      if (m.imgBase === meta.imgBase && ((m.hero && m.hero.file) || "") === prev) {
        clash = true;
        break;
      }
    } catch {}
  }
  return { prev, name: clash ? `hero-${slugify(articlePath.split("/").pop())}` : prev };
}
async function makeHero(articlePath, file, pos = "50% 50%", zoom = 1) {
  const { meta } = await getArticle(articlePath);
  const dir = dirOf(meta),
    base = `src/assets/img/${dir}/`;
  const { name, prev } = await heroNameFor(articlePath, meta);
  if (file) await putBlob(`orig/${dir}/${name}-source`, file);
  const find = async (n) =>
    (await kv.get("blobs", `orig/${dir}/${n}-source`))?.blob ||
    (await kv.get("blobs", `${base}${n}-source.jpg`))?.blob ||
    (await repoBlob(`${base}${n}-source.jpg`));
  let src = await find(name);
  if (!src && !file && prev !== name) src = await find(prev);
  if (!src)
    throw new Error(
      "Esta portada se eligió antes de que el editor guardara la foto completa. Para encuadrarla, vuelve a elegirla con «Cambiar foto».",
    );
  if (!(await kv.get("blobs", `orig/${dir}/${name}-source`))) await putBlob(`orig/${dir}/${name}-source`, src);
  const bmp = await decode(src),
    W = bmp.width,
    H = bmp.height;
  if (
    file ||
    (!(await kv.get("blobs", `${base}${name}-source.jpg`)) && !(await tree()).entries.has(`${base}${name}-source.jpg`))
  ) {
    const cw0 = Math.min(2600, W);
    await putBlob(`${base}${name}-source.jpg`, await jpeg(bmp, cw0, Math.round((cw0 * H) / W)));
  }
  const [px, py] = pos.split(" ").map((v) => Math.min(100, Math.max(0, parseFloat(v))) / 100);
  const z = Math.min(4, Math.max(1, Number(zoom) || 1)); // zoom: 1 = the largest 16:9 crop, 2 = half as wide…
  const cw = Math.round((W / H > 16 / 9 ? (H * 16) / 9 : W) / z),
    ch = Math.round((cw * 9) / 16);
  const left = Math.round((W - cw) * px),
    top = Math.round((H - ch) * py);
  for (const w of [1280, 1920, 2560]) {
    const ow = Math.min(w, cw);
    await putBlob(`${base}${name}-${w}.jpg`, await jpeg(bmp, ow, Math.round((ow * 9) / 16), left, top, cw, ch));
  }
  return { file: name, w: 2560, h: 1440, srcW: W, srcH: H, pos, ...(z > 1 ? { zoom: z } : {}) };
}
export const heroSourceUrl = (meta) => {
  try {
    const dir = dirOf(meta),
      n = (meta.hero && meta.hero.file) || "hero";
    return (
      urls.get(`orig/${dir}/${n}-source`) ||
      urls.get(`src${meta.imgBase}${n}-source.jpg`) ||
      (meta.hero && meta.hero.srcW ? `${meta.imgBase}${n}-source.jpg` : null)
    );
  } catch {
    return null;
  }
};

// ---- articles -------------------------------------------------------------------------------------------
async function getArticle(path) {
  const d = await kv.get("drafts", path);
  if (d) return { ...d.model, local: true };
  return parseArticle(await readText(path));
}
async function listArticles() {
  const t = await tree(),
    drafts = new Set(await kv.keys("drafts")),
    out = [];
  const paths = [...t.entries.keys()].filter((p) => /^src\/es\/.+\.md$/.test(p));
  for (const p of new Set([...paths, ...[...drafts].filter((d) => /^src\/es\/.+\.md$/.test(d))])) {
    try {
      const { meta } = await getArticle(p);
      const heroPath = meta.hero ? `src${meta.imgBase}${meta.hero.file}-1280.jpg` : null;
      out.push({
        path: p,
        title: meta.title || p,
        section: meta.section,
        date: meta.date,
        draft: !!meta.draft,
        ai: !!meta.ai,
        guia: !!meta.guia,
        permalink: meta.permalink,
        hero: heroPath ? urls.get(heroPath) || `${meta.imgBase}${meta.hero.file}-1280.jpg` : null,
        local: drafts.has(p),
        isNew: !t.entries.has(p),
      });
    } catch (e) {
      out.push({ path: p, title: p.split("/").pop(), error: "No se puede leer: " + e.message, date: "" });
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function publish({ message, path, force }) {
  const d = await kv.get("drafts", path);
  if (!d) throw new Error("Este artículo no tiene cambios sin publicar.");
  const dir = dirOf(d.model.meta),
    items = [];
  const text = serializeArticle(d.model);
  const mdBlob = await gh("POST", `${R}/git/blobs`, { content: text, encoding: "utf-8" });
  items.push({ path, mode: "100644", type: "blob", sha: mdBlob.sha });
  const mine = draftFiles(d.model),
    others = await usedByDrafts(path); // only this article's own photos and cover
  const imgKeys = (await kv.keys("blobs")).filter((k) => k.startsWith(`src/assets/img/${dir}/`) && mine.has(k));
  for (const k of imgKeys) {
    const v = await kv.get("blobs", k);
    const b64 = bytesToB64(new Uint8Array(await v.blob.arrayBuffer()));
    const r = await gh("POST", `${R}/git/blobs`, { content: b64, encoding: "base64" });
    items.push({ path: k, mode: "100644", type: "blob", sha: r.sha });
  }
  // Only this article and its photos change, on top of the newest version of everything else. If someone else
  // (another writer, or a change to the site) lands in the same second, GitHub refuses the update: start again
  // from the newest version, a few times.
  const who = session.name ? ` (${session.name}, editor web)` : " (editor web)";
  for (let attempt = 1; ; attempt++) {
    const t = await tree(true),
      cur = t.entries.get(path);
    if (!force && d.baseSha && cur && cur.sha !== d.baseSha)
      throw Object.assign(new Error("Otra persona publicó cambios en este mismo artículo después de que lo abriste."), {
        conflict: true,
      });
    const newTree = await gh("POST", `${R}/git/trees`, { base_tree: t.treeSha, tree: items });
    const commit = await gh("POST", `${R}/git/commits`, {
      message: `${(message || "Actualiza artículo").trim()}${who}`,
      tree: newTree.sha,
      parents: [t.commit],
    });
    try {
      await gh("PATCH", `${R}/git/refs/heads/${REPO.branch}`, { sha: commit.sha, force: false });
    } catch (e) {
      if ((e.status === 422 || e.status === 409) && attempt < 4) {
        treeCache = null;
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      throw e;
    }
    await kv.del("drafts", path);
    for (const k of mine) if (!others.has(k)) await dropBlob(k);
    treeCache = null;
    return { ok: true, sha: commit.sha, files: items.length };
  }
}

// ---- dashboard data (same shape as the local server's) ------------------------------------------------------
async function dashboard() {
  const t = await tree(true),
    arts = [];
  let images = 0,
    texts = 0;
  const imgByDir = {};
  for (const [p, e] of t.entries) {
    if (p.startsWith("src/assets/img/")) {
      images += e.size || 0;
      const dir = p.split("/")[3];
      imgByDir[dir] = (imgByDir[dir] || 0) + (e.size || 0);
    } else if (/^src\/.+\.md$/.test(p)) texts += e.size || 0;
  }
  for (const p of [...t.entries.keys()].filter((x) => /^src\/es\/.+\.md$/.test(x))) {
    try {
      arts.push(articleStats(p, await readText(p), imgByDir));
    } catch {
      /* unreadable: listed elsewhere */
    }
  }
  let commits = [];
  try {
    commits = (await gh("GET", `${R}/commits?sha=${REPO.branch}&per_page=12`)).map((c) => ({
      sha: c.sha.slice(0, 7),
      date: c.commit.author.date,
      author: c.commit.author.name,
      message: c.commit.message.split("\n")[0],
    }));
  } catch {}
  return {
    articles: arts,
    sizes: { images, texts, total: images + texts },
    commits,
    drafts: (await kv.keys("drafts")).length,
    mode: "web",
  };
}

// Site settings: the visitor-statistics code (GoatCounter) lives in src/_data/site.js
async function setGoatcounter(code) {
  const path = "src/_data/site.js",
    cur = await gh("GET", `${R}/contents/${path}?ref=${REPO.branch}`);
  const txt = dec
    .decode(b64ToBytes(cur.content))
    .replace(/goatcounter:\s*"[^"]*"/, `goatcounter: ${JSON.stringify(code)}`);
  await gh("PUT", `${R}/contents/${path}`, {
    message: `Estadísticas: GoatCounter "${code}"`,
    content: bytesToB64(enc.encode(txt)),
    sha: cur.sha,
    branch: REPO.branch,
  });
  return { ok: true };
}

// ---- the same routes as server.js -------------------------------------------------------------------------
export async function handle(method, url, body) {
  const u = new URL(url, location.href),
    q = u.searchParams,
    route = `${method} ${u.pathname.replace(/^.*\/api\//, "/api/")}`;
  switch (route) {
    case "GET /api/status":
      return {
        ready: true,
        branch: REPO.branch,
        changes: (await kv.keys("drafts")).length,
        cfg: { author: session.name || "Daniel", credit: "Daniel Cárdenas" },
        mode: "web",
        user: session.name,
      };
    case "GET /api/articles":
      return listArticles();
    case "GET /api/article": {
      const p = q.get("path");
      const m = await getArticle(p);
      return { ...m, problems: problems(m.meta, m.photos, m.blocks, m.fichas) };
    }
    case "POST /api/article": {
      const b = typeof body === "string" ? JSON.parse(body) : body,
        prev = await kv.get("drafts", b.path);
      let baseSha = prev ? prev.baseSha : null;
      if (!prev) {
        try {
          baseSha = (await tree()).entries.get(b.path)?.sha || null;
        } catch {}
      }
      await kv.set("drafts", b.path, {
        model: { meta: b.meta, photos: b.photos, fichas: b.fichas, blocks: b.blocks },
        baseSha,
        savedAt: Date.now(),
      });
      return { ok: true, problems: problems(b.meta, b.photos, b.blocks, b.fichas), local: true };
    }
    case "POST /api/new": {
      const { title, section } = JSON.parse(body);
      const slug = slugify(title).slice(0, 60) || "articulo";
      const path = `src/es/${section}/${slug}.md`;
      if ((await tree(true)).entries.has(path) || (await kv.get("drafts", path)))
        throw new Error("Ya existe un artículo con ese nombre");
      const model = {
        meta: {
          layout: "layouts/article.njk",
          permalink: `/es/${section}/${slug}/`,
          section,
          title,
          description: "",
          date: today(),
          author: session.name || "Daniel",
          credit: "Daniel Cárdenas",
          draft: true,
          imgBase: `/assets/img/${slug}/`,
        },
        photos: {},
        fichas: {},
        blocks: [{ type: "p", text: "" }],
      };
      await kv.set("drafts", path, { model, baseSha: null, savedAt: Date.now() });
      return { path };
    }
    case "POST /api/photo":
      return q.get("kind") === "hero"
        ? makeHero(q.get("article"), body, q.get("pos") || "50% 50%")
        : importPhoto(q.get("article"), body, q.get("name") || "foto.jpg");
    case "POST /api/hero-pos":
      return makeHero(q.get("article"), null, q.get("pos") || "50% 50%", q.get("zoom") || 1);
    case "POST /api/sync":
      treeCache = null;
      return { ok: true };
    case "POST /api/publish":
      return publish(JSON.parse(body));
    case "POST /api/discard": {
      // the article's unpublished changes and the photos only it uses
      const { path } = JSON.parse(body),
        d = await kv.get("drafts", path);
      await kv.del("drafts", path);
      if (d && d.model) {
        const others = await usedByDrafts(path);
        for (const k of draftFiles(d.model)) if (!others.has(k)) await dropBlob(k);
      }
      return { ok: true };
    }
    case "GET /api/dashboard":
      return dashboard();
    case "POST /api/goatcounter":
      return setGoatcounter(JSON.parse(body).code);
    default:
      throw new Error(`El editor web no sabe hacer: ${route}`);
  }
}

// ---- access: users with a password that unlocks a GitHub token ------------------------------------------------
const ITER = 600000;
async function keyFrom(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function loadUsers() {
  for (const src of [
    "acceso.json",
    `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/editor/acceso.json`,
  ]) {
    try {
      const r = await fetch(src + (src.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        return Array.isArray(j.users) ? j.users : [];
      }
    } catch {}
  }
  return [];
}
// The newest list straight from GitHub (public repo, no key needed): a user added a minute ago is not on the site yet
async function freshUsers() {
  try {
    const r = await fetch(`${API()}${R}/contents/editor/acceso.json?ref=${REPO.branch}&t=${Date.now()}`, {
      headers: { Accept: "application/vnd.github.raw+json" },
      cache: "no-store",
    });
    if (r.ok) {
      const j = await r.json();
      return Array.isArray(j.users) ? j.users : [];
    }
  } catch {}
  return [];
}
export async function login(user, password) {
  const name = String(user).trim().toLowerCase(),
    find = (list) => list.find((x) => x.user.toLowerCase() === name);
  const bad = new Error("Usuario o contraseña incorrectos.");
  const open = async (u) => {
    try {
      const key = await keyFrom(password, b64ToBytes(u.salt), u.iter || ITER);
      return dec.decode(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(u.iv) }, key, b64ToBytes(u.data)),
      );
    } catch {
      return null;
    }
  };
  let u = find(await loadUsers()),
    token = u ? await open(u) : null;
  if (!token) {
    // not on the site yet, or its password was just changed: try the newest list in GitHub
    const f = find(await freshUsers());
    if (f && (!u || f.data !== u.data)) {
      u = f;
      token = await open(f);
    }
  }
  if (!u || !token) throw bad;
  session.set(token, u.name || u.user);
  try {
    await gh("GET", R);
  } catch (e) {
    session.clear();
    throw new Error(
      "La contraseña es correcta, pero la llave de GitHub guardada para este usuario ya no sirve (venció o se borró). Pide que la renueven en «Usuarios».",
    );
  }
  return { name: u.name || u.user };
}
export async function makeUser({ user, name, password, token }) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token)));
  return {
    user: user.trim().toLowerCase(),
    name: name.trim() || user.trim(),
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    iter: ITER,
    data: bytesToB64(data),
    created: today(),
  };
}
export async function checkToken(token) {
  const r = await fetch(`${API()}${R}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "GitHub no reconoce esa llave."
        : r.status === 404
          ? "Esa llave no tiene acceso al repositorio relieve."
          : `GitHub respondió ${r.status}`,
    );
  return true;
}
// acceso.json is committed with the token in use (the new user's own token the first time)
export async function saveUsers(users, token = session.token) {
  const path = "editor/acceso.json",
    headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
  const cur = await fetch(`${API()}${R}/contents/${path}?ref=${REPO.branch}`, { headers, cache: "no-store" });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const content = bytesToB64(
    enc.encode(
      JSON.stringify(
        {
          about:
            "Usuarios del editor de RELIEVE. Cada contraseña descifra una llave de GitHub; no hay secretos sin cifrar en este archivo.",
          users,
        },
        null,
        2,
      ) + "\n",
    ),
  );
  const r = await fetch(`${API()}${R}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ message: "Editor: usuarios", content, sha, branch: REPO.branch }),
  });
  if (!r.ok) throw new Error(`No se pudo guardar la lista de usuarios (GitHub ${r.status}).`);
  return true;
}
