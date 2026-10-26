// Every article and guide survives the editor: reading it into blocks and writing it back loses nothing, and doing it
// twice gives the same file (the editor never rewrites an article just because it was opened).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArticle, serializeArticle, problems } from "../editor/lib/article.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const files = fs.readdirSync(path.join(ROOT, "src/es"), { recursive: true }).filter((f) => f.endsWith(".md")).map((f) => path.join("src/es", f));

test("hay artículos que probar", () => assert.ok(files.length >= 6, files.join(", ")));

for (const f of files) {
  test(`ida y vuelta: ${f}`, () => {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    const a = parseArticle(text);
    const once = serializeArticle(a);
    const b = parseArticle(once);
    assert.deepEqual(b, a, "leer lo escrito da el mismo artículo");
    assert.equal(serializeArticle(b), once, "escribirlo dos veces da el mismo archivo");
    assert.ok(!a.blocks.some((x) => x.type === "raw" && /\{%\s*(foto|fila|pano|cita|recuadro|desplegable|datos|boton|mapa|video|espacio|separador|ficha|caja|centrado)\b/.test(x.text)), "ningún bloque conocido queda como código suelto");
    assert.ok(Array.isArray(problems(a.meta, a.photos, a.blocks, a.fichas)));
  });
}
