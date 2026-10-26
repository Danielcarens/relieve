// Drives the editor in a real browser (Chromium through Playwright) against the test server (server.mjs).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { start } from "./server.mjs";

async function chromium() {
  try { return (await import("playwright")).chromium; } catch {
    const root = execSync("npm root -g").toString().trim();   // on a computer with Playwright installed globally
    return createRequire(root + "/")("playwright").chromium;
  }
}

// One server and one browser for a test file; each editor() gets its own clean browser context (empty storage).
export async function setup() {
  const server = await start();
  const browser = await (await chromium()).launch();
  return { server, browser, close: async () => { await browser.close(); await server.close(); } };
}

export async function editor(env, { mode = "web", width = 1440, height = 900 } = {}) {
  const ctx = await env.browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com|www\.openstreetmap\.org|i\.ytimg\.com|gc\.zgo\.at)\//, (r) => r.fulfill({ status: 404, body: "" }));
  if (mode === "web") await page.addInitScript(() => { sessionStorage.setItem("relieve-token", "test-token"); sessionStorage.setItem("relieve-name", "Prueba"); });
  const q = mode === "web" ? `?modo=web&api=${encodeURIComponent(env.server.url + "/gh")}` : "?modo=local";
  await page.goto(env.server.url + "/" + q);
  await page.waitForSelector("#articles .art, #articles .empty", { timeout: 20000 });
  const ed = {
    page, ctx, errors,
    frame: () => page.frames().find((f) => f.url().includes("canvas.html") && !f.url().includes("preview")),
    wait: (ms = 400) => page.waitForTimeout(ms),
    async open(path) {
      await page.click(`.art[data-path="${path}"]`);
      await page.waitForFunction(() => window.ED && window.ED.meta && document.querySelector("#canvas").contentDocument?.querySelector(".article-body .blk"), null, { timeout: 20000 });
      await ed.wait(300);
    },
    blocks: () => page.evaluate(() => window.ED.blocks.map((b) => b.type + (b.id ? ":" + b.id : "") + (b.tree ? " " + JSON.stringify(b.tree) : b.ids ? " " + JSON.stringify(b.ids) : "") + (b.wrap ? " wrap=" + JSON.stringify(b.wrap) : ""))),
    model: () => page.evaluate(() => JSON.parse(JSON.stringify({ meta: window.ED.meta, photos: window.ED.photos, fichas: window.ED.fichas, blocks: window.ED.blocks }))),
    // the canvas, scrolled so that `sel` is in the middle; returns its box in canvas coordinates
    async box(sel) {
      await ed.frame().evaluate((sel) => { const e = document.querySelector(sel); if (!e) throw new Error("no element " + sel); e.scrollIntoView({ block: "center", behavior: "instant" }); }, sel);
      await ed.wait(200);   // the top bar follows the scroll and the page moves with it: measure after that
      return ed.frame().evaluate((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      }, sel);
    },
    // a point of the canvas -> a point of the page (the editor draws the canvas at 90 %)
    async toPage(x, y) {
      const c = await page.evaluate(() => document.getElementById("canvas").getBoundingClientRect().toJSON());
      const k = c.width / (await ed.frame().evaluate(() => innerWidth));
      return [c.left + x * k, c.top + y * k];
    },
    async mouseDrag(x1, y1, x2, y2, steps = 8) {
      const [a, b] = await ed.toPage(x1, y1), [c, d] = await ed.toPage(x2, y2);
      await page.mouse.move(a, b); await page.mouse.down();
      for (let s = 1; s <= steps; s++) await page.mouse.move(a + ((c - a) * s) / steps, b + ((d - b) * s) / steps);
      await page.mouse.up(); await ed.wait(300);
    },
    async click(x, y) { const [a, b] = await ed.toPage(x, y); await page.mouse.click(a, b); await ed.wait(250); },
    // photos "dragged from the computer" and dropped on a point of the canvas; returns what the pink mark said
    async dropFiles(x, y, names = ["alta.jpg"], { onlyOver = false } = {}) {
      const info = await ed.frame().evaluate(async ({ x, y, names, onlyOver }) => {
        const dt = new DataTransfer();
        for (const n of names) { const b = await (await fetch("/fixtures/" + n)).blob(); dt.items.add(new File([b], n, { type: "image/jpeg" })); }
        const el = document.elementFromPoint(x, y) || document.body;
        const ev = (type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
        ev("dragenter"); ev("dragover");
        const ind = document.querySelector(".drop-ind"); const tag = ind && !ind.hidden ? ind.textContent : document.querySelector(".is-drop") ? "barra" : null;
        if (!onlyOver) ev("drop");
        return tag;
      }, { x, y, names, onlyOver });
      if (!onlyOver) await ed.settle();
      return info;
    },
    // a handle of the page (block grip, photo ✥) dragged to a point of the canvas
    async dragHandle(sel, x, y, { onlyOver = false } = {}) {
      const info = await ed.frame().evaluate(({ sel, x, y, onlyOver }) => {
        const h = document.querySelector(sel); if (!h) throw new Error("no handle " + sel);
        const dt = new DataTransfer();
        h.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
        const el = document.elementFromPoint(x, y) || document.body;
        el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
        const ind = document.querySelector(".drop-ind"); const tag = ind && !ind.hidden ? ind.textContent : document.querySelector(".is-drop") ? "barra" : null;
        if (!onlyOver) { el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt })); if (h.isConnected) h.dispatchEvent(new DragEvent("dragend", { bubbles: true })); }
        return tag;
      }, { sel, x, y, onlyOver });
      await ed.wait(300);
      return info;
    },
    // wait until photo processing and saving are done
    async settle() { await page.waitForFunction(() => !document.querySelector("#toast")?.textContent.includes("Procesando"), null, { timeout: 15000 }).catch(() => {}); await ed.wait(1500); },
    async saved() { await page.evaluate(() => window.act.saveNow()); await ed.wait(400); },
    close: () => ctx.close(),
  };
  return ed;
}

// the article file the web editor would publish now: the draft in this browser, written as text
export async function draftText(ed, path) {
  return ed.page.evaluate(async (path) => { const web = await import("./web.js"); const r = await web.handle("GET", "/api/article?path=" + encodeURIComponent(path)); return r; }, path);
}
