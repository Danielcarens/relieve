// Who can enter the web editor: the first user, signing in and out, adding and removing users, a key that no longer
// works. The users' list (editor/acceso.json) lives in the (fake) GitHub, encrypted as on the real site.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, editor } from "./harness.mjs";

let env;
before(async () => {
  env = await setup();
});
after(async () => {
  await env.close();
});

const ACCESS = "editor/acceso.json";
const users = () => JSON.parse(env.server.git.read(ACCESS) || '{"users":[]}').users;
// the users' list in GitHub, each user's GitHub key encrypted with their password by the editor itself
async function setUsers(list) {
  const ed = await editor(env);
  const made = await ed.page.evaluate(async (list) => {
    const web = await import("./web.js");
    return Promise.all(list.map((u) => web.makeUser(u)));
  }, list);
  await ed.close();
  env.server.git.write(ACCESS, JSON.stringify({ users: made }, null, 2) + "\n", "Editor: usuarios");
}
const signIn = async (ed, user, password) => {
  await ed.page.fill("#li-user", user);
  await ed.page.fill("#li-pass", password);
  await ed.page.click("#li-ok");
};
const message = (ed, sel) =>
  ed.page
    .waitForFunction(
      (sel) => {
        const t = document.querySelector(sel)?.textContent;
        return t && !/Comprobando|Guardando|Cifrando/.test(t) && t;
      },
      sel,
      { timeout: 20000 },
    )
    .then((h) => h.jsonValue());
const inList = (ed) => ed.page.waitForSelector("#articles .art", { timeout: 20000 });
const session = (ed) =>
  ed.page.evaluate(() => ({
    token: sessionStorage.getItem("relieve-token"),
    name: sessionStorage.getItem("relieve-name"),
  }));

test("primer acceso: sin usuarios se crea el primero con una llave que GitHub reconoce", async () => {
  env.server.git.write(ACCESS, '{"users":[]}\n');
  const ed = await editor(env, { login: false });
  assert.match(await ed.page.textContent("#login h1"), /Primer acceso/);
  await ed.page.fill("#su-name", "Daniel Prueba");
  await ed.page.fill("#su-user", "Daniel");
  await ed.page.fill("#su-pass", "corta");
  await ed.page.fill("#su-pass2", "corta");
  await ed.page.fill("#su-token", "test-token");
  await ed.page.click("#su-ok");
  assert.match(await message(ed, "#su-msg"), /12 caracteres/);
  await ed.page.fill("#su-pass", "una contraseña larga");
  await ed.page.fill("#su-pass2", "otra contraseña larga");
  await ed.page.click("#su-ok");
  assert.match(await message(ed, "#su-msg"), /no coinciden/);
  await ed.page.fill("#su-pass2", "una contraseña larga");
  await ed.page.fill("#su-token", "llave-falsa");
  await ed.page.click("#su-ok");
  assert.match(await message(ed, "#su-msg"), /GitHub no reconoce esa llave/);
  assert.deepEqual(users(), [], "nada se guarda con una llave mala");
  await ed.page.fill("#su-token", "test-token");
  await ed.page.click("#su-ok");
  await inList(ed);
  assert.deepEqual(
    users().map((u) => [u.user, u.name]),
    [["daniel", "Daniel Prueba"]],
  );
  assert.ok(!env.server.git.read(ACCESS).includes("test-token"), "la llave no queda escrita sin cifrar");
  assert.deepEqual(await session(ed), { token: "test-token", name: "Daniel Prueba" });
  assert.deepEqual(ed.errors, []);
  await ed.close();
});

test("entrar, contraseña equivocada, salir, agregar y quitar usuarios", async () => {
  await setUsers([{ user: "daniel", name: "Daniel Prueba", password: "una contraseña larga", token: "test-token" }]);
  const ed = await editor(env, { login: false });
  assert.match(await ed.page.textContent("#login h1"), /Entrar/);
  await signIn(ed, "daniel", "otra contraseña");
  assert.match(await message(ed, "#li-msg"), /Usuario o contraseña incorrectos/);
  await signIn(ed, "nadie", "una contraseña larga");
  assert.match(await message(ed, "#li-msg"), /Usuario o contraseña incorrectos/);
  await signIn(ed, " Daniel ", "una contraseña larga"); // the user name in any case, with spaces
  await inList(ed);
  assert.equal(await ed.page.textContent("#who"), "Daniel Prueba");
  // Usuarios: add one with the same key; a repeated name is refused
  await ed.page.click("#users-btn");
  await ed.page.waitForSelector("#nu-ok");
  await ed.page.fill("#nu-name", "Invitada");
  await ed.page.fill("#nu-user", "invitada");
  await ed.page.fill("#nu-pass", "la clave de invitada");
  await ed.page.click("#nu-ok");
  await ed.page.waitForFunction(() => document.querySelectorAll("[data-rm]").length === 2, null, { timeout: 20000 });
  assert.deepEqual(
    users().map((u) => u.user),
    ["daniel", "invitada"],
  );
  await ed.page.fill("#nu-user", "Invitada");
  await ed.page.fill("#nu-pass", "la clave de invitada");
  await ed.page.click("#nu-ok");
  assert.match(await message(ed, "#nu-msg"), /ya existe/);
  await ed.page.click("#nu-c");
  // sign out: the key leaves the tab and the sign-in screen comes back
  await ed.page.evaluate(() => document.querySelector("#logout-btn").click());
  await ed.page.waitForSelector("#login:not([hidden]) h1", { timeout: 20000 });
  assert.deepEqual(await session(ed), { token: null, name: null });
  // the new user enters, then is removed: she can no longer enter
  await signIn(ed, "invitada", "la clave de invitada");
  await inList(ed);
  assert.equal(await ed.page.textContent("#who"), "Invitada");
  await ed.page.click("#users-btn");
  await ed.page.waitForSelector("[data-rm]");
  await ed.page.click('[data-rm="1"]');
  await ed.page.waitForFunction(() => document.querySelectorAll("[data-rm]").length === 1, null, { timeout: 20000 });
  assert.ok(await ed.page.$eval("[data-rm]", (b) => b.disabled), "el último usuario no se puede quitar");
  assert.deepEqual(
    users().map((u) => u.user),
    ["daniel"],
  );
  await ed.close();
  const ed2 = await editor(env, { login: false });
  await signIn(ed2, "invitada", "la clave de invitada");
  assert.match(await message(ed2, "#li-msg"), /Usuario o contraseña incorrectos/);
  assert.deepEqual([...ed.errors, ...ed2.errors], []);
  await ed2.close();
});

test("una llave vencida no deja entrar, y una sesión que vence pide entrar otra vez", async () => {
  await setUsers([{ user: "vieja", name: "Vieja", password: "contraseña de la vieja", token: "llave-vencida" }]);
  const ed = await editor(env, { login: false });
  await signIn(ed, "vieja", "contraseña de la vieja");
  assert.match(await message(ed, "#li-msg"), /la llave de GitHub guardada para este usuario ya no sirve/);
  assert.deepEqual(await session(ed), { token: null, name: null });
  await ed.close();
  // a session whose key stops working while the editor is open
  const ed2 = await editor(env);
  await ed2.page.evaluate(() => sessionStorage.setItem("relieve-token", "llave-vencida"));
  const r = await ed2.page.evaluate(async () => {
    const web = await import("./web.js");
    try {
      await web.handle("POST", "/api/sync"); await web.handle("GET", "/api/articles");
      return "sin error";
    } catch (e) {
      return e.message;
    }
  });
  assert.match(r, /La sesión venció/);
  assert.equal(await ed2.page.evaluate(() => sessionStorage.getItem("relieve-token")), null);
  await ed2.close();
});
