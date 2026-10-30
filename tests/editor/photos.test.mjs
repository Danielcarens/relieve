// Photos in the web editor: dropping files, mosaics (by dragging, by the bars between photos, by the panel), floating
// photos dragged beside the text, the "+" under a floating photo, resizing and cropping, and publishing the files.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, editor } from "./harness.mjs";

let env;
before(async () => { env = await setup(); });
after(async () => { await env.close(); });

const press = (ed, sel) => ed.page.evaluate((sel) => document.querySelector(sel).click(), sel);
// a new article with a few paragraphs of text
async function article(ed, title) {
  await ed.page.click("#new"); await ed.page.fill("#n-title", title); await ed.page.click("#n-ok");
  await ed.page.waitForFunction(() => window.ED.meta && document.querySelector("#canvas").contentDocument?.querySelector(".article-body .blk"));
  await ed.frame().evaluate(() => { const el = document.querySelector(".ed-rich"); el.focus(); });
  for (let k = 1; k <= 6; k++) { await ed.page.keyboard.type(`Párrafo ${k}. ` + "Texto de prueba para que haya algo que rodear. ".repeat(6)); if (k < 6) await ed.page.keyboard.press("Enter"); }
  await ed.wait(300);
}
const kinds = (ed) => ed.page.evaluate(() => window.ED.blocks.map((b) => b.type));
const block = (ed, i) => ed.page.evaluate((i) => window.ED.blocks[i], i);
const ratios = (ed) => ed.page.evaluate(() => Object.fromEntries(Object.entries(window.ED.photos).map(([id, p]) => [id, p.ratio || p.w / p.h])));

test("soltar fotos: foto sola, mosaico por lados, fila nueva arriba, 2×2 y entre dos fotos", async () => {
  const ed = await editor(env);
  await article(ed, "Prueba de mosaicos");
  // between paragraphs 2 and 3: a normal photo
  let p = await ed.box('.blk[data-i="2"]');
  assert.equal(await ed.dropFiles(p.cx, p.t - 2, ["alta.jpg"], { onlyOver: true }), "Aquí, en su propia fila");
  await ed.dropFiles(p.cx, p.t - 2, ["alta.jpg"]);
  assert.deepEqual(await kinds(ed), ["p", "p", "foto", "p", "p", "p", "p"]);
  const id1 = (await block(ed, 2)).id;
  assert.ok(await ed.frame().evaluate(() => { const i = document.querySelector('.blk[data-i="2"] img'); return i.complete && i.naturalWidth > 0; }), "la foto se ve");
  // on its right side: a mosaic of two, side by side
  p = await ed.box('.blk[data-i="2"] .ratio');
  assert.equal(await ed.dropFiles(p.r - 20, p.cy, ["ancha.jpg"], { onlyOver: true }), "Mosaico: a la derecha de esta foto");
  await ed.dropFiles(p.r - 20, p.cy, ["ancha.jpg"]);
  let b = await block(ed, 2); const id2 = b.ids[1];
  assert.deepEqual(b.ids, [id1, id2]); assert.equal(b.tree, undefined);
  // on the band along the top of the mosaic: a new row above both
  p = await ed.box('.blk[data-i="2"] [data-row]');
  assert.equal(await ed.dropFiles(p.cx, p.t + 6, ["ancha.jpg"], { onlyOver: true }), "Arriba de todas las fotos");
  await ed.dropFiles(p.cx, p.t + 6, ["ancha.jpg"]);
  b = await block(ed, 2); const id3 = b.ids.find((x) => ![id1, id2].includes(x));
  assert.deepEqual(b.tree, [[id3, [id1, id2]]]);
  // beside the lone photo of the top row: two rows of two
  p = await ed.box(`.blk[data-i="2"] [data-item="${id3}"] .ratio`);
  await ed.dropFiles(p.r - 30, p.cy, ["alta.jpg"]);
  b = await block(ed, 2); const id4 = b.ids.find((x) => ![id1, id2, id3].includes(x));
  assert.deepEqual(b.tree, [[[id3, id4], [id1, id2]]]);
  // in the gap between the two photos of the bottom row: in the middle
  p = await ed.box(`.blk[data-i="2"] [data-item="${id2}"] .ratio`);
  assert.equal(await ed.dropFiles(p.l + 8, p.cy, ["alta.jpg"], { onlyOver: true }), "Entre estas fotos");
  await ed.dropFiles(p.l + 8, p.cy, ["alta.jpg"]);
  b = await block(ed, 2); const id5 = b.ids.find((x) => ![id1, id2, id3, id4].includes(x));
  assert.deepEqual(b.tree, [[[id3, id4], [id1, id5, id2]]]);
  // under one photo of a row (not on the edge of the mosaic): stacked under that photo only
  p = await ed.box(`.blk[data-i="2"] [data-item="${id4}"] .ratio`);
  assert.equal(await ed.dropFiles(p.cx, p.b - p.h * 0.2, ["ancha.jpg"], { onlyOver: true }), "Debajo de esta foto");
  // Ctrl+Z takes back the last photo
  await ed.page.keyboard.press("Control+z"); await ed.wait(300);
  assert.deepEqual((await block(ed, 2)).tree, [[[id3, id4], [id1, id2]]]);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("las barras entre fotos reparten el espacio sin mover lo demás", async () => {
  const ed = await editor(env);
  await ed.open("src/es/guia/02-fotos.md");
  const i = (await ed.blocks()).findIndex((x) => x.startsWith("fila [[["));   // the 2 × 2 grid
  await ed.page.evaluate((i) => window.act.select(i, null), i);
  const cells = () => ed.frame().evaluate((i) => [...document.querySelectorAll(`.blk[data-i="${i}"] .fila-item .ratio`)].map((r) => { const b = r.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }), i);
  // the bar between the two rows, 60 px down: the top row grows by 60, the bottom one shrinks by 60
  let d = await ed.box(`.blk[data-i="${i}"] .divider.dv-h`); const c0 = await cells();
  await ed.mouseDrag(d.cx, d.cy, d.cx, d.cy + 60);
  let c1 = await cells();
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 4, `${msg}: ${a} ≈ ${b}`);
  near(c1[0][3] - c0[0][3], 60, "la fila de arriba crece"); near(c0[2][3] - c1[2][3], 60, "la de abajo se achica");
  near(c1[2][1] + c1[2][3] - c1[0][1], c0[2][1] + c0[2][3] - c0[0][1], "la altura total no cambia");
  // the bar between the two photos of the top row, 80 px to the left
  d = await ed.box(`.blk[data-i="${i}"] .divider.dv-v`); const c2 = await cells();
  await ed.mouseDrag(d.cx, d.cy, d.cx - 80, d.cy);
  const c3 = await cells();
  near(c2[0][2] - c3[0][2], 80, "la de la izquierda se angosta"); near(c3[1][2] - c2[1][2], 80, "la de la derecha se ensancha");
  near(c3[0][3], c2[0][3], "el alto de la fila no cambia"); near(c3[2][2], c2[2][2], "la otra fila no cambia");
  // the handle under the mosaic: everything taller
  const r0 = await ratios(ed); const h = await ed.box(`.blk[data-i="${i}"] .row-handle`);
  await ed.mouseDrag(h.cx, h.cy, h.cx, h.cy + 50);
  const r1 = await ratios(ed);
  assert.ok(["agujas", "noche", "capas", "autor"].every((id) => r1[id] < r0[id]), "todas las fotos más altas (recorte más angosto)");
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("arrastrar fotos de la página: flotar, volver al centro, salir del mosaico, moverse dentro de él", async () => {
  const ed = await editor(env);
  await article(ed, "Prueba de arrastre");
  let p = await ed.box('.blk[data-i="1"]');
  await ed.dropFiles(p.cx, p.t - 2, ["alta.jpg"]);   // photo at 1
  p = await ed.box('.blk[data-i="1"] .ratio');
  await ed.dropFiles(p.r - 20, p.cy, ["ancha.jpg"]);   // mosaic at 1
  p = await ed.box('.blk[data-i="4"]');
  await ed.dropFiles(p.cx, p.t - 2, ["ancha.jpg"]);   // single photo at 4 (before paragraph 4)
  assert.deepEqual(await kinds(ed), ["p", "fila", "p", "p", "foto", "p", "p", "p"]);
  const single = (await block(ed, 4)).id;
  // its ✥ to the left part of paragraph 2: it floats on the left of the text
  p = await ed.box('.blk[data-i="2"]');
  assert.match(await ed.dragHandle('.blk[data-i="4"] > .blk-handle', p.l + 30, p.t + 4, { onlyOver: true }), /^Flota a la izquierda/);
  await ed.dragHandle('.blk[data-i="4"] > .blk-handle', p.l + 30, p.t + 4);
  let b = await block(ed, 2);
  assert.equal(b.id, single); assert.equal(b.wrap.side, "left");
  // back to the middle, between two paragraphs further down: its own row again
  p = await ed.box('.blk[data-i="6"]');
  await ed.dragHandle('.blk[data-i="2"] > .blk-handle', p.cx, p.t - 2);
  assert.deepEqual(await kinds(ed), ["p", "fila", "p", "p", "p", "foto", "p", "p"]);
  assert.equal((await block(ed, 5)).wrap, undefined);
  // a photo of the mosaic, by its own ✥, to the right part of a paragraph: it leaves the mosaic and floats
  const [m1, m2] = (await block(ed, 1)).ids;
  p = await ed.box('.blk[data-i="3"]');
  await ed.dragHandle(`.blk[data-i="1"] [data-item="${m2}"] .item-grip`, p.r - 30, p.t + 4);
  assert.deepEqual((await block(ed, 1)), { type: "foto", id: m1 });
  b = await block(ed, 3); assert.equal(b.id, m2); assert.equal(b.wrap.side, "right");
  // and onto the single photo, on its left: a mosaic again
  p = await ed.box('.blk[data-i="1"] .ratio');
  await ed.dragHandle('.blk[data-i="3"] > .blk-handle', p.l + 20, p.cy);
  assert.deepEqual((await block(ed, 1)).ids, [m2, m1]);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("el + debajo de una foto flotante agrega debajo de ella", async () => {
  const ed = await editor(env);
  await ed.open("src/es/guia/02-fotos.md");
  const bl = await ed.blocks(), f = bl.findIndex((x) => x.startsWith("foto:autor wrap"));
  assert.deepEqual(bl.slice(f + 1, f + 4).map((x) => x.split(" ")[0]), ["p", "p", "h2"]);
  await ed.box(`.blk[data-i="${f}"]`);
  await ed.frame().evaluate((f) => document.querySelector(`.blk[data-i="${f}"] .ins-under > button`).click(), f);
  await ed.frame().evaluate(() => document.querySelector('.ins-under.is-open [data-add="p"]').click());
  await ed.wait(300);
  assert.deepEqual((await ed.blocks()).slice(f + 1, f + 6).map((x) => x.split(" ")[0]), ["p", "p", "space", "p", "h2"]);
  // and it really is below the photo
  const [photoBottom, newTop] = await ed.frame().evaluate((f) => [document.querySelector(`.blk[data-i="${f}"]`).getBoundingClientRect().bottom, document.querySelector(`.blk[data-i="${f + 4}"]`).getBoundingClientRect().top], f);
  assert.ok(newTop >= photoBottom, `${newTop} >= ${photoBottom}`);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("el panel: unir, cambiar de lugar, cuadrícula, fila, sacar y separar", async () => {
  const ed = await editor(env);
  await article(ed, "Prueba del panel");
  let p = await ed.box('.blk[data-i="1"]');
  await ed.dropFiles(p.cx, p.t - 2, ["alta.jpg", "ancha.jpg", "alta.jpg", "ancha.jpg"]);   // four single photos at 1-4
  assert.deepEqual((await kinds(ed)).slice(1, 5), ["foto", "foto", "foto", "foto"]);
  const ids = await ed.page.evaluate(() => window.ED.blocks.slice(1, 5).map((b) => b.id));
  const act = async (a, data = {}) => { await ed.page.evaluate(({ a, data }) => { const b = document.createElement("button"); b.dataset.do = a; Object.assign(b.dataset, data); document.getElementById("insp").appendChild(b); b.click(); b.remove(); }, { a, data }); await ed.wait(250); };
  const sel = (i, id = null) => ed.page.evaluate(({ i, id }) => window.act.select(i, id), { i, id });
  await sel(1); await act("join"); await act("join"); await act("join");
  assert.deepEqual((await block(ed, 1)).ids, ids);
  await sel(1, ids[0]); await act("swap", { id: ids[0], dir: "1" });
  assert.deepEqual((await block(ed, 1)).ids, [ids[1], ids[0], ids[2], ids[3]]);
  await ed.page.fill("#grid-cols", "2"); await act("grid");
  assert.deepEqual((await block(ed, 1)).tree, [[[ids[1], ids[0]], [ids[2], ids[3]]]]);
  await act("ungrid");
  assert.equal((await block(ed, 1)).tree, undefined);
  await sel(1, ids[2]); await act("out-row", { id: ids[2] });
  assert.deepEqual((await block(ed, 1)).ids, [ids[1], ids[0], ids[3]]); assert.equal((await block(ed, 2)).id, ids[2]);
  await sel(1); await act("split-row");
  assert.deepEqual((await kinds(ed)).slice(1, 5), ["foto", "foto", "foto", "foto"]);
  // a floating photo: side, size, back to its own row
  await sel(1); await act("wrap-side", { side: "right" }); assert.equal((await block(ed, 1)).wrap.side, "right");
  await act("wrap-size", { v: "50" }); assert.equal((await block(ed, 1)).wrap.size, 50);
  await act("wrap-none"); assert.equal((await block(ed, 1)).wrap, undefined);
  // the three ways to show a photo
  await act("present", { v: "pantalla" }); assert.deepEqual(await block(ed, 1), { type: "pano", id: ids[1], mode: "completa" });
  await act("present", { v: "deslizable" }); assert.equal((await block(ed, 1)).mode, "");
  await act("present", { v: "normal" }); assert.equal((await block(ed, 1)).type, "foto");
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("cuadritos de una foto, encuadre y publicar con sus archivos", async () => {
  const ed = await editor(env);
  await article(ed, "Prueba de recorte");
  let p = await ed.box('.blk[data-i="1"]');
  await ed.dropFiles(p.cx, p.t - 2, ["ancha.jpg"]);
  const id = (await block(ed, 1)).id;
  await ed.page.evaluate(() => window.act.select(1, null)); await ed.wait(200);
  // the bottom handle: taller (a narrower crop)
  let h = await ed.box('.blk[data-i="1"] .rz-b');
  await ed.mouseDrag(h.cx, h.cy, h.cx, h.cy + 80);
  const r = (await ratios(ed))[id];
  assert.ok(r < 800 / 522 - 0.05, `recorte más alto: ${r}`);
  // the right handle: narrower, with a free width
  h = await ed.box('.blk[data-i="1"] .rz-r');
  await ed.mouseDrag(h.cx, h.cy, h.cx - 150, h.cy);
  assert.ok((await block(ed, 1)).box, "ancho libre");
  // drag inside the photo: move the crop
  const f = await ed.box('.blk[data-i="1"] .ratio');
  await ed.mouseDrag(f.cx, f.cy, f.cx + 120, f.cy);
  assert.match(await ed.page.evaluate((id) => window.ED.photos[id].pos || "", id), /^\d+% \d+%$/);
  // a cover, dropped on the empty cover of the page
  const hero = await ed.box(".ed-hero-img");
  await ed.dropFiles(hero.cx, hero.cy, ["ancha.jpg"]);
  assert.equal(await ed.page.evaluate(() => window.ED.meta.hero.file), "hero");
  // publish: the article, its photo and its cover go to GitHub in one commit
  await ed.page.evaluate(() => { window.act.setPhoto(Object.keys(window.ED.photos)[0], { alt: "Una plaza" }, false, true); window.act.setMeta("hero.alt", "Una plaza"); window.act.setMeta("description", "Prueba"); });
  await ed.saved(); await ed.wait(1200);
  await press(ed, "#publish"); await ed.page.click("#pub-ok");
  await ed.page.waitForFunction(() => document.getElementById("save-state").textContent === "Publicado", null, { timeout: 15000 });
  const files = [...env.server.git.files().keys()].filter((k) => k.includes("prueba-de-recorte"));
  assert.deepEqual(files.sort(), ["ancha-sm.jpg", "ancha.jpg", "hero-1280.jpg", "hero-1920.jpg", "hero-2560.jpg", "hero-source.jpg"].map((f) => "src/assets/img/prueba-de-recorte/" + f).concat("src/es/viajes/prueba-de-recorte.md"));
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("foto a pantalla completa: se recorta con la barra de abajo y arrastrando; clic en mapa o video no falla", async () => {
  const ed = await editor(env);
  await article(ed, "Prueba de pantalla completa");
  let p = await ed.box('.blk[data-i="1"]');
  await ed.dropFiles(p.cx, p.t - 2, ["ancha.jpg"]);
  const id = (await block(ed, 1)).id;
  await ed.page.evaluate(() => window.act.select(1, null)); await ed.wait(200);
  await press(ed, "[data-do=present][data-v=pantalla]"); await ed.wait(300);
  assert.equal((await block(ed, 1)).mode, "completa");
  const before = (await ratios(ed))[id];
  // the bar at the bottom of the photo: a lower, wider crop
  const h = await ed.box('.blk[data-i="1"] .crop-handle');
  await ed.mouseDrag(h.cx, h.cy, h.cx, h.cy - 60);
  const after = (await ratios(ed))[id];
  assert.ok(after > before + 0.1, `recorte más ancho: ${before} → ${after}`);
  // dragging the photo itself moves the crop
  const f = await ed.box('.blk[data-i="1"] .ratio');
  await ed.mouseDrag(f.cx, f.cy, f.cx + 100, f.cy + 10);
  assert.match(await ed.page.evaluate((id) => window.ED.photos[id].pos || "", id), /^\d+% \d+%$/);
  // the ratio buttons of the panel apply to it too, and the page keeps the crop
  const ar = await ed.frame().evaluate(() => getComputedStyle(document.querySelector('.blk[data-i="1"] .ratio')).getPropertyValue("--bs-aspect-ratio"));
  assert.match(ar, /%$/);
  // a click inside a map frame (it has no photo to crop) is not an error
  await ed.page.evaluate(() => window.act.add("map", window.ED.blocks.length));
  await ed.wait(300);
  const m = await ed.box(".blk-map .map-frame");
  await ed.click(m.cx, m.cy);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});
