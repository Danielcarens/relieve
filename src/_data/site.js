// Site-wide settings.
// `liveBase`: until the section pages move into this build, the menu links
// point at the pages that are live today.
export default {
  name: "RELIEVE",
  url: "https://relievemag.com",
  liveBase: "https://relievemag.com/",
  // Visitor statistics (GoatCounter, open source, no cookies). Write the account code here, e.g. "relieve"
  // for relieve.goatcounter.com; empty = no counting.
  goatcounter: "",
  sections: [
    { id: "viajes", es: "Viajes", en: "Travel", href: "viajes.html" },
    { id: "bici", es: "Bici", en: "Bike", href: "bici.html" },
    { id: "moto", es: "Moto", en: "Moto", href: "moto.html" },
    { id: "reviews", es: "Reviews", en: "Reviews", href: "reviews.html" },
    { id: "videos", es: "Videos", en: "Videos", href: "videos.html" },
    { id: "opinion", es: "Opinión", en: "Opinion", href: "opinion.html" },
  ],
};
