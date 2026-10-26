// The web editor's users: sign in, first user, add and remove users (web.js does the encryption).
import { env } from "./env.js";
import { save } from "./state.js";
import { $, closeModal, esc, modal, toast } from "./util.js";

// ---- access on the web: user + password (web.js decrypts the GitHub token) -------------------------------------
export const TOKEN_HELP = `<details class="small"><summary class="fw-semibold">Cómo crear la llave de GitHub</summary><ol class="mt-2 mb-0">
<li>En GitHub: tu foto → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
<li>Nombre: «Editor RELIEVE». Vencimiento: hasta 1 año.</li>
<li><b>Repository access</b>: <i>Only select repositories</i> → <b>relieve</b>.</li>
<li><b>Permissions</b> → Repository: <b>Contents: Read and write</b> y <b>Actions: Read-only</b>.</li>
<li>Copia la llave (empieza con <code>github_pat_</code>) y pégala aquí. No la mandes por chat ni la guardes en otro lado: aquí queda cifrada con tu contraseña.</li></ol></details>`;
export function loginScreen() {
  return new Promise(async (resolve) => {
    const box = $("#login");
    box.hidden = false;
    const users = await env.web.loadUsers();
    const shell = (inner) =>
      `<div class="login-card bg-body border border-2 border-strong p-4 p-md-5 d-grid gap-3"><svg class="wordmark" viewBox="-11 -11 3399 622" role="img" aria-label="RELIEVE"><use href="#logo-lockup"/></svg><span class="tape tape-secondary justify-self-start">Editor</span>${inner}</div>`;
    if (!users.length) {
      box.innerHTML =
        shell(`<h1 class="h2 mb-0">Primer acceso</h1><p class="mb-0">Todavía no hay usuarios. Crea el tuyo: el nombre de usuario y la contraseña sirven para entrar desde cualquier computadora.</p>
        <div><label class="form-label" for="su-name">Tu nombre (firma de los artículos)</label><input class="form-control" id="su-name" value="Daniel"></div>
        <div><label class="form-label" for="su-user">Usuario</label><input class="form-control" id="su-user" autocomplete="username"></div>
        <div><label class="form-label" for="su-pass">Contraseña (al menos 12 caracteres)</label><input class="form-control" type="password" id="su-pass" autocomplete="new-password"></div>
        <div><label class="form-label" for="su-pass2">Repite la contraseña</label><input class="form-control" type="password" id="su-pass2" autocomplete="new-password"></div>
        <div><label class="form-label" for="su-token">Llave de GitHub</label><input class="form-control" type="password" id="su-token" autocomplete="off" placeholder="github_pat_…"></div>${TOKEN_HELP}
        <p class="hint" id="su-msg"></p><button class="btn btn-primary" id="su-ok">Crear usuario y entrar</button>`);
      $("#su-ok").onclick = async () => {
        const name = $("#su-name").value,
          user = $("#su-user").value.trim(),
          pass = $("#su-pass").value,
          token = $("#su-token").value.trim(),
          msg = $("#su-msg");
        if (!user || pass.length < 12) {
          msg.textContent = "Escribe un usuario y una contraseña de 12 caracteres o más.";
          msg.classList.add("bad");
          return;
        }
        if (pass !== $("#su-pass2").value) {
          msg.textContent = "Las contraseñas no coinciden.";
          msg.classList.add("bad");
          return;
        }
        try {
          msg.classList.remove("bad");
          msg.textContent = "Comprobando la llave con GitHub…";
          await env.web.checkToken(token);
          msg.textContent = "Cifrando y guardando…";
          await env.web.saveUsers([await env.web.makeUser({ user, name, password: pass, token })], token);
          env.web.session.set(token, name.trim() || user);
          box.hidden = true;
          toast("Listo. El usuario se guardó cifrado en GitHub; en unos 2 minutos también funciona desde el sitio.");
          resolve();
        } catch (e) {
          msg.textContent = e.message;
          msg.classList.add("bad");
        }
      };
      return;
    }
    box.innerHTML = shell(`<h1 class="h2 mb-0">Entrar</h1>
      <div><label class="form-label" for="li-user">Usuario</label><input class="form-control" id="li-user" autocomplete="username"></div>
      <div><label class="form-label" for="li-pass">Contraseña</label><input class="form-control" type="password" id="li-pass" autocomplete="current-password"></div>
      <p class="hint" id="li-msg"></p><button class="btn btn-primary" id="li-ok">Entrar</button>`);
    const go = async () => {
      const msg = $("#li-msg");
      msg.classList.remove("bad");
      msg.textContent = "Comprobando…";
      $("#li-ok").disabled = true;
      try {
        await env.web.login($("#li-user").value, $("#li-pass").value);
        box.hidden = true;
        resolve();
      } catch (e) {
        msg.textContent = e.message;
        msg.classList.add("bad");
        $("#li-ok").disabled = false;
      }
    };
    $("#li-ok").onclick = go;
    $("#li-pass").onkeydown = (e) => {
      if (e.key === "Enter") go();
    };
    $("#li-user").focus();
  });
}
$("#logout-btn").onclick = async () => {
  await save();
  env.web.session.clear();
  location.reload();
};
$("#users-btn").onclick = async () => {
  let users = await env.web.loadUsers();
  const draw = () =>
    modal(
      `<div class="dlg"><h2>Usuarios</h2>
    <p class="hint mt-0">Cada persona entra con su usuario y contraseña. La contraseña descifra una llave de GitHub que solo puede tocar el repositorio de la revista.</p>
    <ul class="list-unstyled mb-0 d-grid gap-2">${users.map((u, k) => `<li class="d-flex justify-content-between align-items-center border-bottom pb-2"><span><b>${esc(u.name || u.user)}</b> <span class="text-secondary">· ${esc(u.user)}${u.created ? ` · desde ${esc(u.created)}` : ""}</span></span><button class="btn btn-outline-danger btn-sm" data-rm="${k}" ${users.length === 1 ? "disabled title='Debe quedar al menos un usuario'" : ""}>Quitar</button></li>`).join("")}</ul>
    <h3 class="h4 mb-0 mt-2">Agregar usuario</h3>
    <div><label class="form-label" for="nu-name">Nombre</label><input class="form-control" id="nu-name"></div>
    <div><label class="form-label" for="nu-user">Usuario</label><input class="form-control" id="nu-user"></div>
    <div><label class="form-label" for="nu-pass">Contraseña (12 caracteres o más; dísela en persona)</label><input class="form-control" type="password" id="nu-pass" autocomplete="new-password"></div>
    <div class="form-check"><input class="form-check-input" type="checkbox" id="nu-same" checked><label class="form-check-label" for="nu-same">Usar la misma llave de GitHub que yo</label></div>
    <div id="nu-tok-wrap" hidden><label class="form-label" for="nu-token">Su llave de GitHub</label><input class="form-control" type="password" id="nu-token" placeholder="github_pat_…">${TOKEN_HELP}</div>
    <p class="hint" id="nu-msg"></p>
    <div class="acts"><button class="btn btn-outline-dark" id="nu-c">Cerrar</button><button class="btn btn-primary" id="nu-ok">Agregar</button></div></div>`,
      () => {
        $("#nu-c").onclick = closeModal;
        $("#nu-same").onchange = () => {
          $("#nu-tok-wrap").hidden = $("#nu-same").checked;
        };
        document.querySelectorAll("[data-rm]").forEach(
          (b) =>
            (b.onclick = async () => {
              const next = users.filter((_, k) => k !== Number(b.dataset.rm));
              try {
                await env.web.saveUsers(next);
                users = next;
                draw();
                toast("Usuario quitado. Para cortarle el acceso del todo, borra también su llave en GitHub.");
              } catch (e) {
                toast(e.message, true);
              }
            }),
        );
        $("#nu-ok").onclick = async () => {
          const msg = $("#nu-msg"),
            user = $("#nu-user").value.trim(),
            pass = $("#nu-pass").value,
            token = $("#nu-same").checked ? env.web.session.token : $("#nu-token").value.trim();
          if (!user || pass.length < 12) {
            msg.textContent = "Escribe un usuario y una contraseña de 12 caracteres o más.";
            msg.classList.add("bad");
            return;
          }
          if (users.some((u) => u.user === user.toLowerCase())) {
            msg.textContent = "Ese usuario ya existe.";
            msg.classList.add("bad");
            return;
          }
          try {
            msg.classList.remove("bad");
            msg.textContent = "Guardando…";
            if (!$("#nu-same").checked) await env.web.checkToken(token);
            const next = [...users, await env.web.makeUser({ user, name: $("#nu-name").value, password: pass, token })];
            await env.web.saveUsers(next);
            users = next;
            draw();
            toast("Usuario agregado. Ya puede entrar con su usuario y contraseña.");
          } catch (e) {
            msg.textContent = e.message;
            msg.classList.add("bad");
          }
        };
      },
    );
  draw();
};
