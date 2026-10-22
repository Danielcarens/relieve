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

  /* ---- Mouse drag for scrolling containers (touch scrolls natively). Returns
          { moved() } so a click that ends a drag can be told apart from a tap. */
  function makeDraggable(scroller, onStart) {
    var startX = 0, startLeft = 0, dragging = false, travelled = 0;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      travelled = 0;
      startX = event.clientX;
      startLeft = scroller.scrollLeft;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add("is-dragging");
      if (onStart) onStart();
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      travelled = Math.max(travelled, Math.abs(event.clientX - startX));
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
    scroller.addEventListener("dragstart", function (event) { event.preventDefault(); });

    return { moved: function () { return travelled > 4; } };
  }

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

    makeDraggable(scroller, markTouched);
  });

  /* ---- Enlarge: wide photos and panoramas open in a lightbox (a native
          <dialog>) that covers the page, with the photo at up to 90% of the
          screen height, pannable sideways. Esc, the close button or a click on
          the dark area closes it. ------------------------------------------- */
  var box = null, boxScroll = null, boxImg = null, boxDrag = null, boxNatural = 0, boxFocus = 50;

  function fitLightbox() {
    if (!boxImg) return;
    var h = Math.min(window.innerHeight * 0.9, boxNatural || Infinity);
    boxImg.style.height = Math.round(h) + "px";
    boxImg.style.width = "auto";
  }

  function centerLightbox() {
    var max = boxScroll.scrollWidth - boxScroll.clientWidth;
    boxScroll.scrollLeft = max * (boxFocus / 100);
  }

  function buildLightbox(closeLabel) {
    box = document.createElement("dialog");
    box.className = "lightbox";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-light btn-icon lightbox-close";
    close.setAttribute("aria-label", closeLabel);
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';

    boxScroll = document.createElement("div");
    boxScroll.className = "lightbox-scroll";
    boxScroll.tabIndex = 0;
    boxImg = document.createElement("img");
    boxScroll.append(boxImg);
    box.append(close, boxScroll);
    document.body.append(box);

    boxDrag = makeDraggable(boxScroll);

    close.addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (event) {
      // A click on the dark area (not on the photo, and not the end of a drag) closes
      if ((event.target === box || event.target === boxScroll) && !boxDrag.moved()) box.close();
    });
    box.addEventListener("close", function () {
      document.documentElement.classList.remove("lightbox-open");
      boxImg.removeAttribute("src");
    });

    // Vertical wheel pans sideways when the photo is wider than the screen
    boxScroll.addEventListener("wheel", function (event) {
      if (boxScroll.scrollWidth <= boxScroll.clientWidth) return;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        boxScroll.scrollLeft += event.deltaY;
        event.preventDefault();
      }
    }, { passive: false });

    window.addEventListener("resize", function () {
      if (box.open) { fitLightbox(); }
    });
    boxImg.addEventListener("load", function () { fitLightbox(); centerLightbox(); });
  }

  document.querySelectorAll("[data-zoom]").forEach(function (fig) {
    var open = fig.querySelector("[data-zoom-open]");
    var source = fig.querySelector("img");
    if (!open || !source) return;

    open.hidden = false; // without JavaScript there is no button

    open.addEventListener("click", function () {
      if (!box) buildLightbox(open.getAttribute("data-close-label") || "Close");
      boxNatural = parseFloat(fig.getAttribute("data-fh")) || 0;
      boxFocus = parseFloat(fig.getAttribute("data-focus"));
      if (isNaN(boxFocus)) boxFocus = 50;
      boxImg.alt = source.alt;
      boxImg.src = fig.getAttribute("data-full");
      fitLightbox();
      document.documentElement.classList.add("lightbox-open");
      box.showModal();
      boxScroll.focus();
    });
  });
})();
