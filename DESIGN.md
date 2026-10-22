# RELIEVE design rules

Read this file before building or changing any page. Every page must look like the same magazine. When a decision changes, update this file and `style-guide.html` in the same session.

## Project

- Online magazine about mountain biking, enduro, travel and outdoor living: trips, bikes, motorcycles, gear reviews, videos and opinion. It must look professional even though one person writes and edits it.
- Name: **RELIEVE** (formerly "Enduro"). Slogan: "Viajes, bicis, reviews y vida al aire libre" / "Travel, bikes, reviews and outdoor life".
- Bilingual, Spanish by default and English through the ES/EN switch in the menu bar. Only Spanish is written for real; English strings are placeholders for now.
- Static site: plain HTML, **Bootstrap 5.3.8** hosted in the repository (`assets/vendor/bootstrap/`), one theme file and one small script. Articles are built with Eleventy (`src/`). The site makes no requests to third parties. Served by GitHub Pages.
- All content on the pages today is sample content, and every photo is a `.ph` placeholder.

## Files

```
index.html            Home
viajes.html bici.html moto.html reviews.html videos.html opinion.html   Section pages (same template)
buscar.html           Search results (Pagefind)
style-guide.html      Living reference with every component
css/theme.css         Our brand on top of Bootstrap: variable overrides + "Magazine-only additions". The only custom CSS.
css/style-guide.css   Only for style-guide.html
js/site.js            Language switch (ES/EN), search box behavior. Color mode is fixed to light.
logo/                 relieve-logo-dark.svg, relieve-logo-white.svg, relieve-mark.svg, relieve-mark-white.svg, relieve-wordmark.svg
favicon.svg favicon.ico apple-touch-icon.png
```

Obsolete, delete by hand when convenient: `logo/enduro-wordmark.svg`, `logo/enduro-wordmark-white.svg`, folder `enduro-fit/`, `untitled.af`.

Bootstrap docs: https://getbootstrap.com/docs/5.3/ (check the docs before inventing anything).

Every page loads, in this order: preloads for Archivo and the icon font (`/assets/fonts/`), `/assets/vendor/bootstrap/bootstrap.min.css` (5.3.8), `css/theme.css` (which declares the `@font-face` rules), `js/site.js` in the head, and `/assets/vendor/bootstrap/bootstrap.bundle.min.js` at the end of the body. If we upgrade Bootstrap, replace both files and change the version here.

## The rule: Bootstrap first

1. **Use Bootstrap's own components and classes.** Grid (`container`, `row`, `col-*`), `navbar`, `card`, `btn`, `form-control`, `ratio`, `figure`, `list-inline`, and its utilities for spacing, borders, text and display. Don't rewrite what Bootstrap already provides.
2. **Brand changes go through Bootstrap's CSS variables** (`--bs-primary`, `--bs-body-bg`, `--bs-btn-*`, `--bs-navbar-*` and so on) in `theme.css`. Never hardcode a color in a page.
3. **No inline styles** and no page-specific CSS. If something is missing, add it to `theme.css` in the "Magazine-only additions" section and show it in `style-guide.html`.
4. **Use Bootstrap's spacing scale** (`1` to `5`) for `m-*`, `p-*`, `g-*`. Rows inside a `.container` use `gy-5 gx-lg-5`, not `g-5`, which overflows on phones.
5. **Use theme-aware classes** (`bg-body`, `text-body-secondary`, `border-strong`) rather than fixed ones (`bg-white`, `text-dark`), so dark mode can come back later.

## Brand decisions (apply on top of stock Bootstrap)

- **White background always.** Color mode is forced to light in `site.js`. There is no dark mode for now (the `[data-bs-theme="dark"]` variables stay in `theme.css` for later).
- **Visual reference:** the Harmony Studio site: huge headline, lots of air, full-width hero, big two-column cards.
- **Narrow containers:** 864px from 992, 1026px from 1200, 1188px from 1400.
- **Sentence case everywhere.** Never uppercase text, and no tracked-out labels above headings.
- **Tape marks every section and category.** `.tape` (on an `h2` for section titles). Pink by default, `.tape tape-secondary` (moss) for secondary labels and the featured article.
- **Square corners.** Radius is 0 everywhere except images and placeholders (2px). No shadows.
- **Strong rules are 2px:** `border-2 border-strong`. No hairlines.
- **No lines between list items.** Article lists (Latest articles, Opinion, section pages) are separated by space only. Keep the 2px rule under a section title, the rule above a section, and the one above the featured article.
- **Pink is for fills** (`btn-primary`, `.tape`). Pink text must use the link color, which passes contrast. Don't use `.text-primary` on small text.
- **One control height: 44px** (`--control-height: 2.75rem` in `theme.css`) for `.btn`, `.btn-sm`, button groups, `.form-control` and the menu toggler. Consistency is the owner's priority. Change the variable, never a single control.
- **Fonts:** body text uses the system font stack. **Archivo** condensed for headlines, Archivo normal width for UI (`.font-ui`, set automatically on navbar, buttons, forms, captions). **DM Serif Display** for the logo and the biggest titles: `h1`, `.display-1` and the `.font-serif-display` class (works on any `h2`). No other font.
- **Fonts and other assets:** host them in this repository (`src/assets/fonts/`), downloaded only when needed and limited to the weights, widths and characters used. No faux or simulated styles (bold, italic, small caps): if a style is needed, download the real one. Today: Archivo (latin, wght 400–800, wdth 68–100) and DM Serif Display regular.
- **Icons:** Google Material Symbols Outlined (`<span class="material-symbols-outlined" aria-hidden="true">name</span>`). The icon font is a subset hosted in `assets/fonts/material-symbols-outlined-subset.woff2` with only the icons we use (today `search`, `play_arrow`, `swap_horiz`), fixed at FILL 0, weight 400, size 24. To add an icon, rebuild the subset from the `material-symbols` npm package (fontTools: pin the axes, then subset by the icon names as ligature text). Icon-only buttons use `.btn.btn-outline-dark.btn-icon` with a bilingual `aria-label`.
- **Headlines:** use `h1`–`h4`. `.display-1` only for the biggest headline on a page (article title, landing hero).
- **Reading text** in a `.measure` block (66ch) or a `col-lg-8 col-xl-7` column.
- **Motion is none.** No entrance animations, no hover lifts, no transitions on the search box. Hover changes color or underline only.
- **No subscribe or newsletter anywhere for now:** no menu button, no cover button, no band, no forms, no emails.
- **No "Read" or "Watch" buttons on cards.** The whole card is the link.

## Logo

- Arrowhead with four contour lines + RELIEVE in DM Serif Display, as SVG outlines (viewBox `-11 -11 3399 622`).
- Defined once per page as `<g id="logo-lockup">` inside a hidden `<svg>` at the top of `<body>`, and reused with `<use href="#logo-lockup"/>` in the navbar (`.wordmark`) and the footer (`.wordmark.wordmark-lg`). It takes `currentColor`.
- On phones and tablets (below 992px) the navbar logo is 1.75rem tall instead of 2.25rem.
- Favicon: arrowhead with contour lines, pink `#d4205f`.

## Components

| Need | Use |
|---|---|
| Page shell | `.navbar` (copy from `index.html`), `<main id="main">`, `footer.bg-dark` with `data-bs-theme="dark"` |
| Menu | Logo, Viajes, Bici, Moto, Reviews, Videos, Opinión, search, ES/EN. Active link: `active` + `aria-current="page"`. Navbar classes `py-2 py-lg-3`. |
| Search | `form.search-form[data-search]` with `input.form-control.search-input` and `button.btn.btn-outline-dark.btn-icon` (magnifier). See "Search" below. |
| Section title | `h2.tape` inside `div.d-flex.justify-content-between.align-items-end.border-bottom.border-2.border-strong` |
| Category label | `span.tape` or `span.font-ui.small.fw-bold.text-secondary` |
| Slogan / big serif heading | `h2.font-serif-display` |
| Hero (home) | `figure` outside the container, `.ratio.ratio-21x9.ph.figure-img.rounded-0`, `h2.font-serif-display.text-white` over it in `.hero-overlay`, caption in a `.container` |
| Latest articles | `ul.list-unstyled` > `li.py-4` > `article.row.gx-3.gx-md-4.gy-3.gy-md-0` with `col-12 col-md-4 col-lg-3` photo and `col-12 col-md-8 col-lg-9` text. No lines between items. |
| Story card | `.card.h-100` with `.ratio.ratio-3x2.ph.card-img-top` and `.card-body` (category, title, `.small-meta`). No excerpt, no button. |
| Short text-only item | `article.position-relative.h-100` (no border), category, title, one line |
| Featured article (section pages) | `article.row.gy-4.gx-lg-5.align-items-center.position-relative.border-top.border-2.border-strong.pt-4` with `col-lg-7` photo and `col-lg-5` text: `tape-secondary` label, `h2.font-serif-display.fs-1`, excerpt, `.small-meta` |
| Trail or event facts | `dl.row` with `row-cols-2 row-cols-md-4` (stage sheet) |
| Article | `h1.display-1`, `.lead`, `col-lg-8 col-xl-7` text columns, `figure.figure.w-100`, `blockquote.blockquote.pullquote` |
| Image next to text | `.row.align-items-center` with two `.col-lg-6` (add `order-lg-2` to alternate) |
| Buttons | `.btn.btn-primary`, `.btn.btn-outline-dark` (theme-aware ghost) |
| Language switch | `.btn-group` with two `.btn-outline-dark` buttons carrying `data-set-lang` |

## Page templates

**Home (`index.html`):** menu → slogan `h2.font-serif-display` + lead (a hidden `h1` "RELIEVE" for SEO and accessibility) → full-width hero "Artículo destacado" → "Últimos artículos" (5 items) → sections Viajes, Bici, Moto, Reviews, Videos (2 cards each) → Opinión (3 text items, no rules) → dark footer with large logo. Each "Ver todo" links to its section page.

**Section pages (Viajes, Bici, Moto, Reviews, Videos, Opinión):** same template for all six. `h1` (serif) with a lead → featured article (two columns) → "Más artículos" with 5 cards in two columns. No rule under the featured article. Videos show "Video · duration" as details. Opinion uses the same structure, with the category "Opinión".

**Search (`buscar.html`):** `h1` "Buscar", a status line and a results list.

**Article page** (built with Eleventy, `src/_includes/layouts/article.njk`):
- **Hero:** always the photo, full bleed, **16:9** (shoot hero photos in 16:9; export 2560×1440). On phones it is cropped to 4:3. Height is capped at 85vh. From 992px the title sits over the photo on a dark gradient; below that it goes under the photo. The credit and caption go under the photo.
- **Hero video:** the hero is never the video thumbnail. If the article has `youtube` in its front matter, a small button "Click para ver video" sits at the bottom right of the photo. Click replaces the photo with the YouTube player in the same frame (`youtube-nocookie.com`, loads nothing before the click). Without JavaScript, the button becomes a link to YouTube.
- **Date:** every article has a date. It is shown only in: Latest articles on the home, featured articles (home hero and section featured) and the article page. Not on section cards, "Más artículos" cards or Opinion items.
- **Reading column:** 46rem wide, body text 1.125rem. Headings (`h2`, `h3`) and lists use it.
- **Photos:** a single photo (`foto`) is always the full `.container` width, the same width for all of them. Each photo can be cropped freely in front matter: `ratio` (width / height; default is the photo's own) and `pos` (what stays centered, e.g. `"50% 30%"`). Two or more photos together go in `{% fila "a", "b" %}`: same height, together exactly the width of a single photo, 1rem between them; each item grows in proportion to its ratio (`--g`), so changing a crop never breaks the alignment. Spacing above and below (`my-5`) is the same for single photos and rows. On phones every photo is full bleed and rows stack. The inline `--g` and `--bs-aspect-ratio` values are generated by the shortcodes (the editor will write the front matter), never typed in markup. Text wrapping around a photo (like Word) is not implemented yet.
- **Panoramas** (`pano` shortcode): full bleed, height `clamp(15rem, 50vh, 34rem)`, swipeable left and right (touch, mouse drag, Shift + wheel, arrow keys). Each has a `focus` (0 to 100) that sets which part shows first. A small hint "Desliza para ver más" disappears on first touch.
- **Panorama options** (second argument of `pano`): none = limited height `clamp(15rem, 50vh, 34rem)`, swipeable. `"alta"` = taller limit `clamp(20rem, 65vh, 44rem)`, swipeable. `"completa"` = the whole photo at full width in its natural proportions, no swiping, no hint. In the swipeable modes the photo is never cropped at the bottom: if the screen is wider than the limit allows, the height grows (`--pano-min`, set in `site.js`) so the whole height always shows. Use `"completa"` when the whole photo must be seen at once; the other modes when it is acceptable to swipe.
- **Pull quote** (`cita`), photo credit under every photo ("Foto: name. Caption").
- **Drafts:** `draft: true` adds `noindex` (hidden from Google). `ai: true` shows a "Versión de prueba" notice under the hero. Remove both to publish.
- Article text sits in `data-pagefind-body`.

## Search

- The magnifier opens a text box that grows to its left and puts the cursor inside. Enter, or a second click with text typed, goes to `buscar.html?q=…`. With an empty box the second click closes it. Escape closes it. No animation.
- The text box has no focus glow (the owner asked for this); its 2px dark border stays. The caret is the focus signal.
- Results use **Pagefind**, built when publishing: Netlify build command `npx pagefind --site .`, publish directory `.`. Until it runs, `buscar.html` shows a "available once the site is published" message.
- Article pages will need `data-pagefind-body` around their text. Before launch, split languages into `/es/` and `/en/` so the index doesn't mix both languages.

## Phones (below 768px)

- **Rule: on phones every photo is full-bleed**, with no exceptions: hero, lists, cards, section featured and every photo inside articles (including normal, wide and panorama). Only captions and text keep their margins. Any new photo component must follow this.
- Story photos inside a container are **full-bleed**: edge to edge, no rounded corners, text keeps its margins (`main .container .ratio.ph` in `theme.css`). The hero is already full width.
- Latest articles stack: photo on top, text below.
- Navbar is shorter: `py-2`, logo 1.75rem. Menu toggler stays 44px.
- Space above each page title: `pt-4` (desktop `pt-md-5`).
- Always check 360px, 390px and 1440px with no horizontal scrolling.

## Bilingual content

- Every visible string is written twice: `<span lang="es">…</span><span lang="en">…</span>`. For paragraphs, two `<p>` elements with `lang="es"` and `lang="en"`.
- `html[data-lang]` decides which shows. `site.js` sets it from the saved choice, or from the browser language.
- Attributes that carry text (`alt`, `placeholder`, `aria-label`) need both languages, written as `Español / English`, until we move to separate URLs.
- **Before launch:** switch to separate URLs (`/es/…` and `/en/…`) with `hreflang` (`es-419`) so Google indexes both languages. The components don't change. Favicon paths become `/favicon.svg`.
- Voice: plain, active, specific. Buttons say what happens. Spanish is neutral Latin American, no voseo.

## Images

- Frame with Bootstrap's `.ratio` (`ratio-3x2` for cards and thumbnails, `ratio-21x9` for the hero, `ratio-2x1` for wide figures) and put the `<img class="object-fit-cover">` inside. `.ph` is only the placeholder.
- Every image has `alt` text in both languages and a caption with the photographer's credit.

## Accessibility floor

- Keep Bootstrap's focus styles, except the search box glow described above. Don't remove outlines or box-shadows elsewhere.
- One `h1` per page. Use `aria-current="page"` on the active nav link.
- Text contrast of at least 4.5:1: use only the theme colors.
- Layout works at 360px wide.

## When we add a new page

1. Copy the head, logo definition, navbar and footer from `index.html` (not from the style guide).
2. Build the content from the components above, using Bootstrap classes. Section pages copy `viajes.html`.
3. If something new is needed, add it to `theme.css` and `style-guide.html` first, then to this file.

## Open items

- SEO: title, description, Open Graph, JSON-LD, canonical, sitemap, robots, `hreflang` (needs the domain).
- Separate language URLs `/es/` and `/en/` before launch.
- Article page: built; Pagefind index and `/es/` `/en/` split still to do.
- Check the availability of the name RELIEVE (domain, Instagram/YouTube, trademarks per country; an academic journal called "Relieve" exists).
- Licenses: CC BY-NC-ND or BY-NC-SA for content; Bootstrap is MIT, fonts are OFL. Review data protection per country.
- Possible: DM Serif Display on card titles; white footer instead of dark; real title and link on the hero once the article exists.
