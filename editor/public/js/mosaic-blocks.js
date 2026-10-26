// Mosaics in the article: write a tree back into a block, swap photos, grid, height.
import { RMAX, RMIN, findLeaf, nodeOfBlock, nodeToTree, rOfTree, ratioOfP, setTree, tidy, treeOf } from "./mosaic.js";
import { mutate } from "./state.js";
import { ED } from "./store.js";
import { frame, toast } from "./util.js";
// Write a node back into block i: a mosaic, a single photo (one left) or nothing (none left). Returns false if removed.
export function putNode(i, node) {
  const b = ED.blocks[i], keep = { ...(b.box ? { box: b.box } : {}), ...(b.full ? { full: true } : {}) };
  node = tidy(node);
  if (node == null) { ED.blocks.splice(i, 1); return false; }
  if (typeof node === "string") { ED.blocks[i] = { type: "foto", id: node, ...(b.box ? { box: b.box } : {}), ...(b.type === "foto" && b.wrap ? { wrap: b.wrap } : {}) }; return true; }
  const nb = { type: "fila", ids: [], ...keep }; setTree(nb, nodeToTree(node)); ED.blocks[i] = nb; return true;
}
export const rowR = (b) => rOfTree(treeOf(b), (id) => ratioOfP(ED.photos[id]));
// Swap a photo with its neighbour in the same row (or column) of the mosaic: dir -1 = before, +1 = after
export function swapLeaf(i, id, dir) {
  const root = nodeOfBlock(ED.blocks[i]), f = findLeaf(root, id);
  if (!f || !f.parent || !f.parent.k[f.j + dir]) return toast(dir < 0 ? "Ya es la primera de su grupo." : "Ya es la última de su grupo.", true);
  const k = f.parent.k; [k[f.j], k[f.j + dir]] = [k[f.j + dir], k[f.j]];
  mutate(() => { putNode(i, root); ED.sel = { i, id }; });
}
export function makeGrid(b, cols) {
  const ids = b.ids.slice(); cols = Math.max(1, Math.min(6, Math.round(cols) || 2));
  if (ids.length <= cols) return mutate(() => { delete b.tree; });   // everything fits in one row
  const rows = []; for (let k = 0; k < ids.length; k += cols) rows.push(ids.slice(k, k + cols));
  mutate(() => setTree(b, [rows]));
}
export function setRowHeight(alto) {            // alto = height as a percentage of the row width
  const b = ED.blocks[ED.sel.i]; const sum = rowR(b);
  const target = 100 / alto, k = target / sum;
  mutate(() => { for (const id of b.ids) ED.photos[id].ratio = Math.round(Math.max(RMIN, Math.min(RMAX, ratioOfP(ED.photos[id]) * k)) * 1000) / 1000; }, { typing: true });
  frame().contentWindow.render && frame().contentWindow.render();
}
