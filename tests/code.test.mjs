// The editor's code stays in order: formatted with Prettier, and each module uses only what it declares or imports
// (nothing from another module by accident, no imports left over, no names that exist nowhere).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const req = createRequire(path.join(ROOT, "package.json"));   // acorn comes with Eleventy
const acorn = req("acorn"), walk = req("acorn-walk");
const FOLDERS = ["editor/public/js", "editor/public/canvas"];
const FILES = ["editor/public/app.js", "editor/public/web.js", "editor/lib/article.js", ...FOLDERS.flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".js")).map((f) => `${d}/${f}`))];
// what the browser gives every script
const BROWSER = new Set(["window", "document", "location", "navigator", "getSelection", "getComputedStyle", "innerWidth", "innerHeight", "scrollY", "scrollTo", "addEventListener", "parent", "sessionStorage", "localStorage", "crypto", "fetch", "URL", "URLSearchParams", "Blob", "File", "DataTransfer", "DragEvent", "Event", "MouseEvent", "HTMLTextAreaElement", "HTMLInputElement", "NodeFilter", "DOMParser", "MutationObserver", "CSS", "createImageBitmap", "indexedDB", "atob", "btoa", "TextEncoder", "TextDecoder", "setTimeout", "clearTimeout", "setInterval", "Intl", "console", "performance", "requestAnimationFrame", "undefined", ...Object.getOwnPropertyNames(globalThis)]);

function scan(file) {
  const ast = acorn.parse(fs.readFileSync(path.join(ROOT, file), "utf8"), { ecmaVersion: "latest", sourceType: "module" });
  const declared = new Set(), imported = new Map(), used = new Set();
  const ids = (node, set) => walk.full(node, (m) => { if (m.type === "Identifier") set.add(m.name); });
  walk.full(ast, (n) => {
    if (n.type === "ImportSpecifier" || n.type === "ImportDefaultSpecifier") imported.set(n.local.name, n.source?.value);
    if (n.type === "VariableDeclarator") ids(n.id, declared);
    if (/Function/.test(n.type)) { if (n.id) declared.add(n.id.name); n.params.forEach((p) => ids(p, declared)); }
    if (n.type === "CatchClause" && n.param) ids(n.param, declared);
  });
  walk.ancestor(ast, { Identifier(n, _, anc) {
    const p = anc[anc.length - 2];
    if (p.type === "MemberExpression" && p.property === n && !p.computed) return;
    if (p.type === "Property" && p.key === n && !p.computed && !p.shorthand) return;
    if (p.type === "ImportSpecifier" || p.type === "ImportDefaultSpecifier") return;
    used.add(n.name);
  } });
  return { declared, imported, used };
}

test("cada módulo usa solo lo que declara o importa, y no importa de más", () => {
  const problems = [];
  for (const f of FILES) {
    const { declared, imported, used } = scan(f);
    for (const name of imported.keys()) if (!used.has(name)) problems.push(`${f}: importa «${name}» y no lo usa`);
    for (const name of used) if (!declared.has(name) && !imported.has(name) && !BROWSER.has(name)) problems.push(`${f}: usa «${name}», que no declara ni importa`);
  }
  assert.deepEqual(problems, []);
});

test("el código del editor tiene el formato de Prettier", () => {
  const bin = path.join(import.meta.dirname, "node_modules/.bin/prettier");
  const cmd = fs.existsSync(bin) ? [bin, []] : ["npx", ["--yes", "prettier@3.3.3"]];
  try { execFileSync(cmd[0], [...cmd[1], "--check", ...FILES], { cwd: ROOT, stdio: "pipe" }); }
  catch (e) { assert.fail("Archivos sin formato (npx prettier --write …):\n" + e.stdout.toString() + e.stderr.toString()); }
});
