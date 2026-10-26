// The mosaic layout (editor/public/js/mosaic.js): putting photos on each side of a photo or of the whole mosaic,
// taking them out, and writing the layout back in the file's format, always tidy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toNode, tidy, nodeToTree, insertNode, removeNode, findLeaf, flatT, rOfTree } from "../editor/public/js/mosaic.js";

const T = (arr) => tidy(toNode(arr));          // file format -> node
const F = (n) => nodeToTree(n);                // node -> file format
const add = (arr, ref, side, ids) => F(insertNode(T(arr), ref, side, ids));

test("una foto sola y otra al lado: una fila", () => {
  assert.deepEqual(F(insertNode("a", "root", "right", ["b"])), ["a", "b"]);
  assert.deepEqual(F(insertNode("a", "a", "left", ["b"])), ["b", "a"]);
});
test("arriba o abajo de una foto sola: una columna", () => {
  assert.deepEqual(F(insertNode("a", "a", "bottom", ["b"])), [["a", "b"]]);
});
test("en una fila: a la izquierda, entre dos, a la derecha", () => {
  assert.deepEqual(add(["a", "b"], "a", "left", ["n"]), ["n", "a", "b"]);
  assert.deepEqual(add(["a", "b"], "a", "right", ["n"]), ["a", "n", "b"]);
  assert.deepEqual(add(["a", "b"], "b", "left", ["n"]), ["a", "n", "b"]);
  assert.deepEqual(add(["a", "b"], "b", "right", ["n"]), ["a", "b", "n"]);
});
test("arriba o abajo de todas: una fila nueva", () => {
  assert.deepEqual(add(["a", "b"], "root", "top", ["n"]), [["n", ["a", "b"]]]);
  assert.deepEqual(add(["a", "b"], "root", "bottom", ["n"]), [[["a", "b"], "n"]]);
});
test("al lado de la foto sola de la segunda fila: 2 × 2", () => {
  assert.deepEqual(add([[["a", "b"], "n"]], "n", "right", ["m"]), [[["a", "b"], ["n", "m"]]]);
});
test("debajo de una foto de una fila: esa foto queda apilada", () => {
  assert.deepEqual(add(["a", "b"], "b", "bottom", ["n"]), ["a", ["b", "n"]]);
});
test("varias fotos a la vez conservan su orden", () => {
  assert.deepEqual(add(["a"], "a", "left", ["x", "y"]), ["x", "y", "a"]);
  assert.deepEqual(add(["a", "b"], "root", "top", ["x", "y"]), [[["x", "y"], ["a", "b"]]]);
});
test("sacar fotos ordena el resto: sin grupos de una ni filas dentro de filas", () => {
  assert.deepEqual(F(removeNode(T(["a", ["b", "n"]]), "n")), ["a", "b"]);
  assert.deepEqual(F(removeNode(T([[["a", "b"], ["n", "m"]]]), "n")), [[["a", "b"], "m"]]);
  assert.equal(removeNode(T(["a", "b"]), "a"), "b");
  assert.equal(removeNode("a", "a"), null);
});
test("dónde está una foto", () => {
  const n = T(["a", ["b", "c"]]); const f = findLeaf(n, "c");
  assert.equal(f.parent.d, "c"); assert.equal(f.j, 1);
  assert.equal(findLeaf(n, "z"), null);
});
test("el formato del archivo ida y vuelta", () => {
  for (const t of [["a", "b"], ["a", ["b", "c"]], [[["a", "b"], ["c", "d"]]], [["a", ["b", "c"]]]]) {
    assert.deepEqual(F(T(t)), t); assert.deepEqual(flatT(F(T(t))), flatT(t));
  }
});
test("proporción de un mosaico: suma en filas, inversa en columnas", () => {
  const r = { a: 1, b: 1, c: 2 };
  assert.equal(rOfTree(["a", "b"], (id) => r[id]), 2);
  assert.equal(rOfTree(["a", ["b", "c"]], (id) => r[id]), 1 + 1 / (1 / 1 + 1 / 2));
});
