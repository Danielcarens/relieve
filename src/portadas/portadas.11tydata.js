// Home, section pages, search and 404 (the "front pages"): Spanish, built from the published articles.
export default {
  lang: "es",
  layout: "layouts/base.njk",
  ogType: "website",
  eleventyExcludeFromCollections: true,
  eleventyComputed: {
    ui: (data) => data.i18n.es,
  },
};
