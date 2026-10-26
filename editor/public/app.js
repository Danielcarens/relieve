// RELIEVE editor. The interface lives in js/: one module per part (see the first line of each). This file starts it.
// The canvas (canvas.js, inside the iframe) talks to it through window.ED (the article) and window.act (actions).
import "./js/state.js";
import "./js/ribbon.js";
import "./js/inspector.js";
import "./js/panel.js";
import { loginScreen } from "./js/access.js";
import { MODE, api, env } from "./js/env.js";
import { watchVersion } from "./js/publish.js";
import { ED } from "./js/store.js";
import { $, toast } from "./js/util.js";
import { showList } from "./js/views.js";

// ---- start -----------------------------------------------------------------------------------
(async () => {
  if (MODE === "web") {
    env.web = await import("./web.js");
    if (!document.getElementById("logo-lockup")) {
      try {
        const r = await fetch("logo-defs.svg");
        if (r.ok) document.body.insertAdjacentHTML("afterbegin", await r.text());
      } catch {}
    }
    if (!env.web.session.token) await loginScreen();
    await env.web.loadPending();
    $("#web-tools").hidden = false;
    $("#who").textContent = env.web.session.name;
    $("#sync").textContent = "Actualizar lista";
    watchVersion();
  }
  try {
    const st = await api("/api/status");
    ED.cfg = st.cfg;
    if (!st.ready) toast("El sitio no está preparado. Mira la ventana negra del editor.", true, 15000);
  } catch {}
  await showList().catch((e) => toast(e.message, true));
})();
