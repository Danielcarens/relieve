/* site.js — language (ES/EN) and color mode (light/dark). Load in <head>,
   before the page paints, so there is no flash.
   Color mode is fixed to light (white background). */
(function () {
  var root = document.documentElement;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function syncButtons(lang) {
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      var on = btn.getAttribute("data-set-lang") === lang;
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("active", on);
    });
  }

  function setLang(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    write("mag-lang", lang);
    syncButtons(lang);
  }

  // Language: saved choice, otherwise the browser language (default Spanish)
  var saved = read("mag-lang");
  var initial = saved || ((navigator.language || "es").slice(0, 2) === "en" ? "en" : "es");
  root.setAttribute("data-lang", initial);
  root.setAttribute("lang", initial);

  // Color mode: always light (DESIGN.md: the page must have a white background).
  // The system dark mode is switched off on purpose. To bring it back, set
  // data-bs-theme from matchMedia("(prefers-color-scheme: dark)") here.
  root.setAttribute("data-bs-theme", "light");

  document.addEventListener("DOMContentLoaded", function () {
    syncButtons(root.getAttribute("data-lang"));
  });

  // Search: first click opens the box, a second click (or Enter) goes to buscar.html.
  // With an empty box the second click just closes it. Escape also closes it.
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-search]").forEach(function (form) {
      var input = form.querySelector("input");
      var button = form.querySelector("button");

      function setOpen(open) {
        form.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        input.tabIndex = open ? 0 : -1;
        if (open) input.focus();
      }

      form.addEventListener("submit", function (event) {
        var closed = !form.classList.contains("is-open");
        if (closed || !input.value.trim()) {
          event.preventDefault();
          setOpen(closed);
        }
      });

      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { setOpen(false); button.focus(); }
      });

      // On the results page, show the current query in the box
      var q = new URLSearchParams(location.search).get("q");
      if (q && /buscar\.html$/.test(location.pathname)) { input.value = q; setOpen(false); }
    });
  });

  document.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-set-lang]");
    if (btn) setLang(btn.getAttribute("data-set-lang"));
  });
})();
