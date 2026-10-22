/* site.js — search box, article video and swipeable panoramas.
   Loaded with `defer` at the end of <head>. Color mode is fixed to light
   (DESIGN.md), set in the <html> tag. Language is decided by the page URL
   (/es/, /en/), so there is no language switching here. */
(function () {
  "use strict";

  /* ---- Search: first click opens the box, a second click (or Enter) goes to
          the results page. With an empty box the second click closes it.
          Escape also closes it. ------------------------------------------- */
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
  });

  /* ---- Article hero video: the photo stays until the reader clicks. Then
          the YouTube player replaces it in the same frame. Uses the
          privacy-enhanced domain, so YouTube gets nothing before the click. - */
  document.querySelectorAll("[data-hero]").forEach(function (hero) {
    var play = hero.querySelector("[data-video]");
    var frame = hero.querySelector("[data-hero-frame]");
    if (!play || !frame) return;

    play.hidden = false; // without JavaScript, the <noscript> link is shown instead

    play.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(play.getAttribute("data-video")) +
        "?autoplay=1&rel=0&playsinline=1";
      iframe.title = play.getAttribute("data-video-title") || "YouTube";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.setAttribute("allowfullscreen", "");
      hero.classList.add("is-playing");
      frame.classList.add("is-playing");
      frame.replaceChildren(iframe);
      iframe.focus();
    });
  });

  /* ---- Panoramas: full-bleed, limited height, swipeable. The photo fills the
          height; what does not fit in the width is reached by swiping (touch),
          dragging (mouse), Shift + wheel, or the arrow keys when focused. ----- */
  document.querySelectorAll("[data-pano]").forEach(function (pano) {
    var scroller = pano.querySelector(".pano-scroll");
    var img = scroller && scroller.querySelector("img");
    if (!scroller || !img) return;

    var focus = parseFloat(pano.getAttribute("data-focus"));
    if (isNaN(focus)) focus = 50;
    var touched = false;

    function layout() {
      var max = scroller.scrollWidth - scroller.clientWidth;
      pano.classList.toggle("has-overflow", max > 8);
      if (!touched) scroller.scrollLeft = max * (focus / 100);
    }

    function markTouched() {
      touched = true;
      pano.classList.add("is-touched");
    }

    layout();
    img.addEventListener("load", layout);
    window.addEventListener("resize", layout);

    ["touchstart", "wheel", "keydown"].forEach(function (name) {
      scroller.addEventListener(name, markTouched, { passive: true });
    });

    // Mouse drag (touch scrolls natively)
    var startX = 0, startLeft = 0, dragging = false;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startLeft = scroller.scrollLeft;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add("is-dragging");
      markTouched();
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      scroller.scrollLeft = startLeft - (event.clientX - startX);
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      scroller.classList.remove("is-dragging");
      if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
    }
    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);

    // Stop the browser from dragging the picture itself
    img.addEventListener("dragstart", function (event) { event.preventDefault(); });
  });
})();
