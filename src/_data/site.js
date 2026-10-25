// Site-wide settings.
// `liveBase`: where the menu links start (the home page and the section pages are built here too).
export default {
  name: "RELIEVE",
  url: "https://relievemag.com",
  liveBase: "/",
  // Visitor statistics (GoatCounter, open source, no cookies). Write the account code here, e.g. "relieve"
  // for relieve.goatcounter.com; empty = no counting.
  goatcounter: "",
  // Image shown when a page without its own photo is shared (1200 x 630, the alternative logo on dark green).
  shareImage: "/assets/img/og-relieve.png",
  // Social profiles in the footer. Empty = not shown; the whole "Síguenos" column disappears while all are empty.
  social: { instagram: "", youtube: "" },
  sections: [
    { id: "viajes", es: "Viajes", en: "Travel", href: "viajes.html", lead: "Rutas, lugares y lo que aprendimos en el camino, con mapas, datos y fotos propias." },
    { id: "bici", es: "Bici", en: "Bike", href: "bici.html", lead: "Pruebas, comparativas y mecánica para montar mejor y gastar menos." },
    { id: "moto", es: "Moto", en: "Moto", href: "moto.html", lead: "Enduro y aventura sobre dos ruedas con motor: pruebas, rutas y preparación." },
    { id: "reviews", es: "Reviews", en: "Reviews", href: "reviews.html", lead: "Equipo probado de verdad, con meses de uso y sin patrocinios que nos digan qué escribir." },
    { id: "videos", es: "Videos", en: "Videos", href: "videos.html", lead: "Bajadas completas, viajes y mecánica, grabados y editados por nosotros." },
    { id: "opinion", es: "Opinión", en: "Opinion", href: "opinion.html", lead: "Puntos de vista de quien monta: sin rodeos y con razones." },
  ],
};
