// Photo mosaics ("fila" in the file) as trees: pure functions, no page and no state (tested on their own).
// ---- photo mosaics ("fila" in the file): b.ids = every photo; b.tree (only when nested) = the layout --------------
// In the file the layout is nested arrays that alternate: the outer array is a row, an array inside it a column (photos
// stacked), an array inside that a row again… To edit it, the tree is turned into explicit nodes { d: "r" | "c", k: [...] }
// (leaves are photo ids), changed, tidied (no group of one, no row inside a row) and turned back.
export const treeOf = (b) => JSON.parse(JSON.stringify(b.tree || b.ids));
export const flatT = (t) => t.flatMap((c) => (Array.isArray(c) ? flatT(c) : [c]));
export const toNode = (arr, depth = 0) => ({
  d: depth % 2 === 0 ? "r" : "c",
  k: arr.map((c) => (Array.isArray(c) ? toNode(c, depth + 1) : c)),
});
export function tidy(n) {
  if (typeof n === "string") return n;
  const out = [];
  for (const c of n.k.map(tidy)) {
    if (c == null) continue;
    if (typeof c !== "string" && c.d === n.d) out.push(...c.k);
    else out.push(c);
  }
  return !out.length ? null : out.length === 1 ? out[0] : { d: n.d, k: out };
}
export const fromNode = (n) => n.k.map((c) => (typeof c === "string" ? c : fromNode(c)));
export function nodeToTree(n) {
  // explicit node -> the file's nested arrays (the outer array is always a row)
  n = tidy(n);
  if (n == null) return [];
  if (typeof n === "string") return [n];
  return n.d === "r" ? fromNode(n) : [fromNode(n)];
}
export function setTree(b, t) {
  t = nodeToTree(toNode(t));
  b.ids = flatT(t);
  if (t.some(Array.isArray)) b.tree = t;
  else delete b.tree;
}
// Where a photo is: its group and its place in it ({ parent: null } when the photo is the whole mosaic)
export function findLeaf(n, id, parent = null, j = -1) {
  if (n === id) return { parent, j };
  if (typeof n === "string") return null;
  for (let k = 0; k < n.k.length; k++) {
    const r = findLeaf(n.k[k], id, n, k);
    if (r) return r;
  }
  return null;
}
// Put new photos on one side of a photo (ref = its id) or of the whole mosaic (ref = "root").
// side: left | right | top | bottom. Several new photos go together, side by side (above or below: one new row).
export function insertNode(root, ref, side, ids) {
  const dir = side === "left" || side === "right" ? "r" : "c",
    before = side === "left" || side === "top";
  const item = ids.length === 1 ? ids[0] : { d: "r", k: ids.slice() };
  const f = ref === "root" ? null : findLeaf(root, ref);
  if (!f || !f.parent) {
    if (root && typeof root !== "string" && root.d === dir) {
      if (before) root.k.unshift(item);
      else root.k.push(item);
    } else root = { d: dir, k: before ? [item, root] : [root, item] };
  } else if (f.parent.d === dir) f.parent.k.splice(before ? f.j : f.j + 1, 0, item);
  else f.parent.k[f.j] = { d: dir, k: before ? [item, ref] : [ref, item] };
  return tidy(root);
}
export function removeNode(root, id) {
  const f = findLeaf(root, id);
  if (!f) return root;
  if (!f.parent) return null;
  f.parent.k.splice(f.j, 1);
  return tidy(root);
}
// A mosaic block's layout as a node (a single photo block counts as a mosaic of one)
export const nodeOfBlock = (b) => (b.type === "foto" ? b.id : tidy(toNode(treeOf(b))));
export function rOfTree(n, r, depth = 0) {
  if (!Array.isArray(n)) return r(n);
  const rs = n.map((c) => rOfTree(c, r, depth + 1));
  return depth % 2 === 0 ? rs.reduce((a, x) => a + x, 0) : 1 / rs.reduce((a, x) => a + 1 / x, 0);
}
export const RMIN = 0.2,
  RMAX = 8; // the narrowest and the widest crop a photo of a mosaic can get
export const ratioOfP = (p) => (Number(p.ratio) > 0 ? Number(p.ratio) : p.w / p.h);
