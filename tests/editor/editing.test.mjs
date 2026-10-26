// Writing in the web editor: a new article, typing, Word-style keys, undo, the "+" menu, the ribbon, saving the draft,
// publishing to (the fake) GitHub and discarding changes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, editor } from "./harness.mjs";
import { parseArticle, serializeArticle } from "../../editor/lib/article.js";

let env;
before(async () => { env = await setup(); });
after(async () => { await env.close(); });

async function newArticle(ed, title = "Prueba de escritura") {
  await ed.page.click("#new");
  await ed.page.fill("#n-title", title);
  await ed.page.click("#n-ok");
  await ed.page.waitForFunction(() => window.ED.meta && document.querySelector("#canvas").contentDocument?.querySelector(".article-body .blk"));
  await ed.wait(300);
}
// put the cursor at the end of block i's text (as a click there would)
const caret = (ed, i) => ed.frame().evaluate((i) => {
  const el = document.querySelector(`.blk[data-i="${i}"] .ed-rich`); el.scrollIntoView({ block: "center", behavior: "instant" }); el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}, i);
// buttons of the top bar (it may have scrolled away with the page, as on the site)
const press = (ed, sel) => ed.page.evaluate((sel) => document.querySelector(sel).click(), sel);
const types = (ed) => ed.page.evaluate(() => window.ED.blocks.map((b) => b.type));
const texts = (ed) => ed.page.evaluate(() => window.ED.blocks.map((b) => b.text ?? (b.items || []).join("|")));

test("escribir, Enter, Backspace, autoformato y deshacer", async () => {
  const ed = await editor(env);
  await newArticle(ed);
  await caret(ed, 0);
  await ed.page.keyboard.type("Hola mundo");
  await ed.page.keyboard.press("Enter");
  await ed.page.keyboard.type("Segundo párrafo");
  assert.deepEqual(await texts(ed), ["Hola mundo", "Segundo párrafo"]);
  // Backspace at the start joins it to the paragraph above
  await ed.page.keyboard.press("Home");
  await ed.page.keyboard.press("Backspace");
  await ed.wait(200);
  assert.deepEqual(await texts(ed), ["Hola mundo Segundo párrafo"]);
  // "## " turns a new paragraph into a title, "- " into a list
  await ed.page.keyboard.press("End"); await ed.page.keyboard.press("Enter");
  await ed.page.keyboard.type("## Un título");
  await ed.page.keyboard.press("Enter");
  await ed.page.keyboard.type("- uno");
  await ed.wait(200);
  assert.deepEqual(await types(ed), ["p", "h2", "ul"]);
  assert.deepEqual(await texts(ed), ["Hola mundo Segundo párrafo", "Un título", "uno"]);
  // Ctrl+Z goes back step by step, Ctrl+Y forward
  const before = await ed.model();
  await ed.page.keyboard.press("Control+z"); await ed.wait(200);
  assert.notDeepEqual(await ed.model(), before);
  await ed.page.keyboard.press("Control+y"); await ed.wait(200);
  assert.deepEqual(await ed.model(), before);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("el menú + agrega cada tipo de bloque y el archivo se lee igual", async () => {
  const ed = await editor(env);
  await newArticle(ed, "Prueba de bloques");
  const menu = await ed.page.evaluate(() => window.INSERT_MENU.filter(([k]) => k && !["foto", "fila"].includes(k)).map(([k]) => k));
  for (const k of menu) {
    const n = (await types(ed)).length;
    await ed.frame().evaluate((n) => document.querySelector(`.article-body > .ins[data-at="${n}"] > button`).click(), n);
    await ed.frame().evaluate((k) => document.querySelector(`.ins-menu [data-add="${k}"]`).click(), k);
    await ed.wait(150);
    assert.equal((await types(ed))[n], k, `se agregó ${k}`);
  }
  const m = await ed.model();
  const again = parseArticle(serializeArticle(m));
  const empty = (b) => (["p", "h2", "h3"].includes(b.type) && !b.text.trim()) || (["ul", "ol"].includes(b.type) && !b.items.some((x) => x.trim()));
  assert.deepEqual(again.blocks.map((b) => b.type), m.blocks.filter((b) => !empty(b)).map((b) => b.type), "los bloques vacíos no se escriben; los demás vuelven iguales");
  assert.ok(!again.blocks.some((b) => b.type === "raw" && b.text !== "<!-- Escribe aquí el código HTML -->"), "ningún bloque vuelve como código");
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("la cinta: estilo, negrita, alineación, buscar y reemplazar", async () => {
  const ed = await editor(env);
  await newArticle(ed, "Prueba de cinta");
  await caret(ed, 0);
  await ed.page.keyboard.type("una palabra importante");
  await ed.page.selectOption("#rb-style", "h3"); await ed.wait(200);
  assert.deepEqual(await types(ed), ["h3"]);
  await ed.page.selectOption("#rb-style", "p"); await ed.wait(200);
  // select "importante" and make it bold with the ribbon
  await caret(ed, 0);
  for (let k = 0; k < "importante".length; k++) await ed.page.keyboard.press("Shift+ArrowLeft");
  await ed.page.click('[data-rb="bold"]'); await ed.wait(200);
  assert.deepEqual(await texts(ed), ["una palabra **importante**"]);
  await ed.page.click('[data-rb="center"]'); await ed.wait(200);
  assert.equal(await ed.page.evaluate(() => window.ED.blocks[0].align), "center");
  await ed.page.keyboard.press("Control+h"); await ed.wait(200);
  await ed.page.fill("#fr-a", "palabra"); await ed.page.fill("#fr-b", "idea"); await ed.page.click("#fr-ok"); await ed.wait(200);
  assert.deepEqual(await texts(ed), ["una idea **importante**"]);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("guardar el borrador, publicar en GitHub y descartar", async () => {
  const ed = await editor(env);
  const path = "src/es/guia/01-texto.md";
  await ed.open(path);
  await caret(ed, 0); await ed.page.keyboard.type(" Agregado por la prueba.");
  await ed.saved(); await ed.wait(1500);
  // the list says it has unpublished changes
  await press(ed, "#nav-list"); await ed.page.waitForSelector(`.art[data-path="${path}"] .ed-tag`);
  assert.match(await ed.page.textContent(`.art[data-path="${path}"]`), /Cambios sin publicar/);
  // publish: one commit with the article as the editor writes it
  await ed.open(path);
  const model = await ed.model();
  const head0 = env.server.git.head;
  await press(ed, "#publish"); await ed.page.click("#pub-ok");
  await ed.page.waitForFunction(() => document.getElementById("save-state").textContent === "Publicado", null, { timeout: 15000 });
  assert.notEqual(env.server.git.head, head0);
  assert.equal(env.server.git.read(path), serializeArticle(model));
  assert.match(env.server.git.read(path), /Agregado por la prueba\./);
  // another change, then discard it from the list: the published version comes back
  await caret(ed, 0); await ed.page.keyboard.type(" Esto se descarta.");
  await ed.saved(); await ed.wait(1500);
  await press(ed, "#nav-list"); await ed.page.waitForSelector(`.art[data-path="${path}"] [data-discard]`);
  await ed.page.click(`.art[data-path="${path}"] [data-discard]`); await ed.page.click("#dc-ok"); await ed.wait(800);
  await ed.open(path);
  const text = await ed.page.evaluate(() => window.ED.blocks[0].text);
  assert.match(text, /Agregado por la prueba\.$/);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("la barra de arriba se va con la página y vuelve arriba", async () => {
  const ed = await editor(env);
  await ed.open("src/es/guia/01-texto.md");
  const nav = () => ed.page.evaluate(() => document.querySelector(".navbar-ridge").style.marginTop);
  await ed.frame().evaluate(() => scrollTo({ top: 40, behavior: "instant" })); await ed.wait(200);
  assert.equal(await nav(), "-36px");
  await ed.frame().evaluate(() => scrollTo({ top: 1500, behavior: "instant" })); await ed.wait(200);
  assert.match(await nav(), /^-\d+px$/);
  await ed.frame().evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await ed.wait(200);
  assert.equal(await nav(), "");
  await ed.close();
});

test("vista previa y panel", async () => {
  const ed = await editor(env);
  await ed.open("src/es/guia/02-fotos.md");
  await press(ed, "#preview");
  const pv = await ed.page.waitForSelector("#pv iframe");
  const f = await pv.contentFrame(); await f.waitForSelector(".article-body .blk");
  assert.equal(await f.evaluate(() => [...document.querySelectorAll(".ins, .blk-tools, .divider, .item-grip")].filter((e) => e.offsetParent).length), 0, "sin ayudas de edición");
  await ed.page.click("#pv-x");
  await press(ed, "#nav-panel"); await ed.page.waitForSelector("#panel h1");
  assert.match(await ed.page.textContent("#panel"), /Artículos publicados/);
  assert.deepEqual(ed.errors, []);
  await ed.close();
});
