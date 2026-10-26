// Stamps the published web editor (relievemag.com/editor/) with the version it was built from, so a browser never mixes
// files of two versions (GitHub Pages lets browsers keep files for 10 minutes):
//   - every file the pages load gets ?v=<version> (scripts, styles, and each module through an import map);
//   - <meta name="editor-version"> tells the editor which version it is, and version.txt which one is online now:
//     when they differ, the editor says that there is a new version (publish.js, watchVersion).
// Usage: node version-editor.mjs <editor folder> <version>
import fs from "node:fs";
import path from "node:path";

const [dir, version] = process.argv.slice(2);
if (!dir || !version || !/^[\w.-]+$/.test(version)) throw new Error("Uso: node version-editor.mjs <carpeta del editor> <versión>");
const v = `?v=${version}`;
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(dir, f), s);
const modules = (sub) => (fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith(".js")).map((f) => `./${sub}/${f}`) : []);

// one import map per page: its own modules, each with the version
function stamp(html, files, extra = {}) {
  const imports = { ...extra };
  for (const f of files) imports[f] = f + v;
  const re = /<script type="importmap">([\s\S]*?)<\/script>/;
  const m = html.match(re);
  if (m) Object.assign(imports, JSON.parse(m[1]).imports || {}, extra);
  for (const [k, val] of Object.entries(imports)) if (!/\?v=/.test(val)) imports[k] = val + v;
  const map = `<script type="importmap">${JSON.stringify({ imports })}</script>`;
  html = m ? html.replace(re, map) : html.replace(/<\/head>/, `${map}\n</head>`);
  // the import map must come before any module; the version meta goes first in <head>
  return html.replace(/<head>/, `<head>\n<meta name="editor-version" content="${version}">`);
}
const local = (html, names) => names.reduce((s, n) => s.replaceAll(`"${n}"`, `"${n}${v}"`), html);

let index = read("index.html");
index = stamp(index, [...modules("js"), "./web.js", "./lib/article.js", "./app.js"]);
index = local(index, ["app.js", "ui.css", "/assets/css/theme.css", "/assets/js/ridge.js"]);
write("index.html", index);

let canvas = read("canvas.html");
canvas = stamp(canvas, modules("canvas"));
canvas = local(canvas, ["canvas.css", "/assets/css/theme.css", "canvas/main.js"]);
write("canvas.html", canvas);

write("version.txt", version + "\n");
console.log(`Editor ${version}: ${modules("js").length + modules("canvas").length + 3} archivos con versión`);
