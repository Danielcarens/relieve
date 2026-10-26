// The editor as it is published: every file with its version (so a browser never mixes two versions), and a notice
// when a newer one is online.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setup, editor } from "./harness.mjs";
import { ROOT } from "./server.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "editor-publicado-"));
let env;
before(async () => {
  fs.cpSync(path.join(ROOT, "editor/public"), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "lib"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "editor/lib/article.js"), path.join(dir, "lib/article.js"));
  execFileSync("node", [path.join(ROOT, ".github/scripts/version-editor.mjs"), dir, "abc1234"]);
  env = await setup({ editorDir: dir });
});
after(async () => { await env.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test("todos los archivos del editor publicado llevan su versión", async () => {
  const ed = await editor(env);
  await ed.open("src/es/guia/02-fotos.md");
  const own = env.server.requests.filter((u) => /\.(js|css)(\?|$)/.test(u) && !u.startsWith("/assets/vendor") && !u.startsWith("/vendor/bootstrap"));
  const without = own.filter((u) => !u.includes("?v=abc1234"));
  assert.deepEqual(without, [], "archivos pedidos sin versión");
  assert.ok(own.some((u) => u.startsWith("/js/store.js")) && own.some((u) => u.startsWith("/canvas/drag.js")) && own.some((u) => u.startsWith("/web.js")));
  assert.equal(await ed.page.getAttribute('meta[name="editor-version"]', "content"), "abc1234");
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("si hay una versión más nueva en línea, lo avisa", async () => {
  fs.writeFileSync(path.join(dir, "version.txt"), "def5678\n");
  const ed = await editor(env);
  await ed.page.waitForSelector("text=Hay una versión nueva del editor", { timeout: 10000 });
  fs.writeFileSync(path.join(dir, "version.txt"), "abc1234\n");
  await ed.close();
});
