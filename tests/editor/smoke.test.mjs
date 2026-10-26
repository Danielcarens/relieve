// Every article and guide opens in the web editor without errors, in both views (computer and phone).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setup, editor } from "./harness.mjs";
import { ROOT } from "./server.mjs";

const files = fs.readdirSync(path.join(ROOT, "src/es"), { recursive: true }).filter((f) => f.endsWith(".md")).map((f) => path.join("src/es", f));
let env;
before(async () => { env = await setup(); });
after(async () => { await env.close(); });

test("la lista muestra artículos y guías", async () => {
  const ed = await editor(env);
  const paths = await ed.page.$$eval(".art", (els) => els.map((e) => e.dataset.path));
  assert.deepEqual([...paths].sort(), [...files].sort());
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

for (const f of files) {
  test(`abre sin errores: ${f}`, async () => {
    const ed = await editor(env);
    await ed.open(f);
    const n = await ed.frame().evaluate(() => document.querySelectorAll(".article-body > .blk").length);
    assert.equal(n, (await ed.blocks()).length, "un bloque en la página por cada bloque del artículo");
    // select every block: the panel draws for each kind
    for (let i = 0; i < n; i++) await ed.page.evaluate((i) => window.act.select(i, null), i);
    await ed.page.evaluate(() => document.getElementById("dev-phone").click()); await ed.wait(500);
    await ed.page.evaluate(() => document.getElementById("dev-desktop").click()); await ed.wait(300);
    assert.deepEqual(ed.errors, []);
    await ed.close();
  });
}
