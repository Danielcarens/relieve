/* ridge.js — the navbar's bottom line (theme.css, ".navbar-ridge"): a straight 2px line that, near the logo, turns
   into a hand-drawn one with a low mountain range right under the arrow and RELIEVE. This script measures the logo and
   gives the CSS the position and width of each piece, in px from the left edge of the navbar. Shared by the site and
   the editor. Without JavaScript the line is simply straight all the way. */
(function () {
  "use strict";
  var nav = document.querySelector(".navbar-ridge");
  var logo = nav && nav.querySelector(".navbar-brand .wordmark");
  if (!logo) return;

  // The editor shrinks and re-enlarges parts of the page with CSS zoom; a hidden 100px probe tells how many screen
  // pixels one CSS pixel inside the navbar takes, so every value below is in the navbar's own units.
  var probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:0";
  nav.appendChild(probe);

  function set(name, px) { nav.style.setProperty(name, Math.max(0, Math.round(px)) + "px"); }

  function place() {
    var k = probe.getBoundingClientRect().width / 100 || 1;
    var box = nav.getBoundingClientRect();
    var r = logo.getBoundingClientRect();
    var width = box.width / k;
    var x1 = (r.left - box.left) / k, x2 = (r.right - box.left) / k;
    var h = parseFloat(getComputedStyle(nav, "::after").height) || 28;
    var natural = 880 * (h / 56);                       // the side pieces are 880 units wide for a 56 unit tall tile
    var left = Math.min(natural, x1), right = Math.min(natural, width - x2);
    set("--rl-s", x1 - left);  set("--rl-x", x1 - left);  set("--rl-w", left);        // straight line, then the left piece
    set("--rc-x", x1);         set("--rc-w", x2 - x1);                                 // the range under the logo
    set("--rr-x", x2);         set("--rr-w", right);                                   // the right piece
    set("--rs-x", x2 + right); set("--rs-w", width - x2 - right);                      // straight line again to the edge
  }

  place();
  window.addEventListener("resize", place);
  window.addEventListener("load", place);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
})();
