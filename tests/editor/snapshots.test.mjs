// What the editor draws, kept as reference files: the page (canvas) of every article and the panel of every block.
// A change in the code that changes them fails here; if the change is wanted, write the files again with
//   UPDATE_SNAPSHOTS=1 npm test
// and look at the difference in Git before keeping it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setup, editor } from "./harness.mjs";
import { ROOT } from "./server.mjs";

const DIR = path.join(import.meta.dirname, "snapshots");
const UPDATE = !!process.env.UPDATE_SNAPSHOTS;
const files = fs.readdirSync(path.join(ROOT, "src/es"), { recursive: true }).filter((f) => f.endsWith(".md")).map((f) => path.join("src/es", f));
let env;
before(async () => { env = await setup(); fs.mkdirSync(DIR, { recursive: true }); });
after(async () => { await env.close(); });

// things that depend on timing or on the size of loaded images, not on the code
const clean = (html) => html
  .replace(/<div class="divider[^"]*"[^>]*><\/div>/g, "")
  .replace(/\?v=\d+/g, "")
  .replace(/--pano-min: ?[\d.]+px;?/g, "")
  .replace(/ style="height: [\d.]+px;?"/g, "")
  .replace(/blob:[^"')\s]+/g, "blob:")
  .replace(/></g, ">\n<");

function check(name, html) {
  const f = path.join(DIR, name.replace(/[^\w.-]+/g, "_") + ".html");
  if (UPDATE || !fs.existsSync(f)) { fs.writeFileSync(f, html); return; }
  const want = fs.readFileSync(f, "utf8");
  if (html !== want) {
    const a = html.split("\n"), b = want.split("\n"); let k = 0; while (k < a.length && a[k] === b[k]) k++;
    assert.fail(`${name} cambió (línea ${k + 1}):\n  ahora: ${a[k]}\n  antes: ${b[k]}`);
  }
}

for (const f of files) {
  test(`dibujo y panel: ${f}`, async () => {
    const ed = await editor(env);
    await ed.open(f);
    check(`${path.basename(f, ".md")}.pagina`, clean(await ed.frame().evaluate(() => document.getElementById("root").innerHTML)));
    const n = (await ed.blocks()).length, panels = [];
    for (let i = 0; i < n; i++) {
      await ed.page.evaluate((i) => window.act.select(i, null), i);
      panels.push(`<!-- bloque ${i} -->\n` + clean(await ed.page.evaluate(() => document.getElementById("insp").innerHTML)));
    }
    for (const tab of ["article", "photos"]) { await ed.page.evaluate((t) => { window.ED.tab = t; document.querySelector(`[data-tab="${t}"]`)?.click(); }, tab); panels.push(`<!-- ${tab} -->\n` + clean(await ed.page.evaluate(() => document.getElementById("insp").innerHTML))); }
    check(`${path.basename(f, ".md")}.panel`, panels.join("\n"));
    assert.deepEqual(ed.errors, []);
    await ed.close();
  });
}

test("lista de artículos y barras", async () => {
  const ed = await editor(env);
  check("lista", clean(await ed.page.evaluate(() => document.getElementById("view-list").innerHTML + document.querySelector("nav").outerHTML + document.getElementById("ribbon").outerHTML)));
  await ed.close();
});
