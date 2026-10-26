// Preview, publishing, and the notice when a new version of the editor is out.
import { MODE, api, post } from "./env.js";
import { save, setState } from "./state.js";
import { ED, S } from "./store.js";
import { $, closeModal, esc, modal, toast } from "./util.js";

// ---- preview and publish -------------------------------------------------------------------
export function canvasPreview() {
  // the page exactly as the canvas draws it, without the editing aids
  modal(
    `<div class="dlg wide"><div class="d-flex flex-wrap gap-2 align-items-center"><h2 class="flex-grow-1 mb-0">Vista previa</h2><div class="btn-group"><button class="btn btn-outline-dark active" id="pv-d">Computadora</button><button class="btn btn-outline-dark" id="pv-p">Celular</button></div><button class="btn btn-outline-dark" id="pv-x">Cerrar</button></div><div class="pv" id="pv"><iframe src="canvas.html?preview=1" title="Vista previa"></iframe></div></div>`,
    () => {
      $("#pv-x").onclick = closeModal;
      $("#pv-d").onclick = () => {
        $("#pv").classList.remove("is-phone");
        $("#pv-d").classList.add("active");
        $("#pv-p").classList.remove("active");
      };
      $("#pv-p").onclick = () => {
        $("#pv").classList.add("is-phone");
        $("#pv-p").classList.add("active");
        $("#pv-d").classList.remove("active");
      };
    },
  );
}
$("#preview").onclick = async () => {
  await save();
  // The web editor, the writing guides (they have no address on the site) and articles without a cover show the page as
  // the editor draws it; otherwise the local editor builds the real page with Eleventy.
  if (MODE === "web" || !ED.meta.permalink || !ED.meta.hero) return canvasPreview();
  toast("Preparando la vista previa…", false, 2000);
  try {
    await post("/api/preview", {});
  } catch (e) {
    toast(
      "No se pudo construir la página con Eleventy; te muestro la vista del editor. (" + e.message + ")",
      true,
      9000,
    );
    return canvasPreview();
  }
  const url = "/preview" + ED.meta.permalink + "?t=" + Date.now();
  modal(
    `<div class="dlg wide"><div class="d-flex flex-wrap gap-2 align-items-center"><h2 class="flex-grow-1 mb-0">Vista previa</h2><div class="btn-group"><button class="btn btn-outline-dark active" id="pv-d">Computadora</button><button class="btn btn-outline-dark" id="pv-p">Celular</button></div><button class="btn btn-outline-dark rounded-0" id="pv-x">Cerrar</button></div><div class="pv" id="pv"><iframe src="${url}" title="Vista previa"></iframe></div></div>`,
    () => {
      $("#pv-x").onclick = closeModal;
      $("#pv-d").onclick = () => {
        $("#pv").classList.remove("is-phone");
        $("#pv-d").classList.add("active");
        $("#pv-p").classList.remove("active");
      };
      $("#pv-p").onclick = () => {
        $("#pv").classList.add("is-phone");
        $("#pv-p").classList.add("active");
        $("#pv-d").classList.remove("active");
      };
    },
  );
};
$("#publish").onclick = async () => {
  await save();
  const probs = ED.problems || [];
  const blocking = probs.filter(
    (p) => /foto principal|título/i.test(p) && /Falta (el|la) /.test(p) && !/alternativo/.test(p),
  );
  modal(
    `<div class="dlg"><h2>Publicar</h2>
    ${probs.length ? `<div><strong>Antes de publicar, revisa:</strong><ul>${probs.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : "<p>Todo en orden.</p>"}
    ${ED.meta.guia ? '<p class="hint bad">Esto es una guía de ejemplo: se guarda en GitHub, pero no se publica en el sitio.</p>' : ED.meta.draft ? '<p class="hint bad">Está marcado como <b>borrador</b>: se publicará en su dirección, pero no aparecerá en el inicio, en su sección ni en el buscador, y Google no lo indexará. Para que salga en todo el sitio, quita la marca «Borrador» en la pestaña Artículo.</p>' : '<p class="hint">Aparecerá en el inicio, en su sección y en el buscador.</p>'}
    <p class="hint">Se guardará en GitHub y, en un par de minutos, el sitio se reconstruye solo con Eleventy.</p>
    <div><label class="form-label" for="pub-msg">Nota del cambio</label><input class="form-control" type="text" id="pub-msg" value="${esc("Publica: " + (ED.meta.title || ""))}"></div>
    <div class="acts"><button class="btn btn-outline-dark rounded-0" id="pub-c">Cancelar</button><button class="btn btn-primary rounded-0" id="pub-ok" ${blocking.length ? "disabled" : ""}>Publicar ahora</button></div></div>`,
    () => {
      $("#pub-c").onclick = closeModal;
      $("#pub-ok").onclick = async () => {
        const b = $("#pub-ok");
        b.disabled = true;
        b.textContent = "Publicando…";
        const go = async (force) => {
          try {
            await post("/api/publish", { message: $("#pub-msg") ? $("#pub-msg").value : "", path: ED.path, force });
            closeModal();
            toast("Enviado a GitHub. En unos 2 minutos el sitio se actualiza solo.", false, 9000);
            if (MODE === "web") {
              S.dirty = false;
              setState("Publicado");
            }
          } catch (e) {
            if (e.conflict)
              return modal(
                `<div class="dlg"><h2>Alguien más cambió este artículo</h2><p>${esc(e.message)}</p><p>Si publicas igual, tu versión reemplaza la otra. Si no estás seguro, cancela y habla con esa persona.</p><div class="acts"><button class="btn btn-outline-dark" id="cf-c">Cancelar</button><button class="btn btn-danger" id="cf-ok">Publicar mi versión</button></div></div>`,
                () => {
                  $("#cf-c").onclick = closeModal;
                  $("#cf-ok").onclick = () => go(true);
                },
              );
            b.disabled = false;
            b.textContent = "Publicar ahora";
            toast("No se pudo publicar: " + e.message, true, 15000);
          }
        };
        go(false);
      };
    },
  );
};

// When a new version of the editor is published while someone is writing, say so (their draft is safe in the browser)
export function watchVersion() {
  // The published editor says which version it is (<meta name="editor-version">) and which one is online now
  // (version.txt), both written when it is published (.github/scripts/version-editor.mjs). Without them (the local
  // editor), the date of app.js says it.
  const mine = document.querySelector('meta[name="editor-version"]')?.content;
  const stamp = async () => {
    try {
      if (mine) {
        const r = await fetch("version.txt?t=" + Date.now(), { cache: "no-store" });
        return r.ok ? (await r.text()).trim() : "";
      }
      const r = await fetch("app.js", { method: "HEAD", cache: "no-store" });
      return r.headers.get("etag") || r.headers.get("last-modified") || "";
    } catch {
      return "";
    }
  };
  let first = null,
    told = false;
  const check = async () => {
    const s = await stamp();
    if (!s) return;
    if (first === null) {
      first = mine || s;
      if (first === s) return;
    }
    if (s !== first && !told) {
      told = true;
      const t = document.createElement("div");
      t.className = "alert rounded-0 border-2 mb-0 bg-body border-strong d-flex flex-wrap gap-2 align-items-center";
      t.innerHTML =
        '<span class="flex-grow-1">Hay una versión nueva del editor. Tus cambios están guardados: recarga cuando quieras para usarla.</span><button class="btn btn-primary btn-sm">Recargar</button>';
      t.querySelector("button").onclick = async () => {
        await save();
        location.reload();
      };
      $("#toast").appendChild(t);
    }
  };
  check();
  setInterval(check, 5 * 60 * 1000);
}
