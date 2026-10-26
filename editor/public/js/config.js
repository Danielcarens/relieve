// Fixed lists: sections, crops, the Insert menu, block kinds and their defaults.
export const SECTIONS = [["viajes", "Viajes"], ["bici", "Bici"], ["moto", "Moto"], ["reviews", "Reviews"], ["videos", "Videos"], ["opinion", "Opinión"]];
export const RATIOS = [["Original", 0], ["3:2", 1.5], ["4:3", 4 / 3], ["16:9", 16 / 9], ["2:1", 2], ["1:1", 1], ["4:5", 0.8], ["3:4", 0.75]];
// What can be inserted, grouped like Squarespace's block menu. [type, label] or ["", group title]
export const INSERT_MENU = window.INSERT_MENU = [
  ["", "Texto"], ["p", "Párrafo"], ["h2", "Título"], ["h3", "Subtítulo"], ["ul", "Lista con viñetas"], ["ol", "Lista numerada"],
  ["quote", "Cita destacada"], ["callout", "Recuadro de texto"], ["details", "Desplegable (pregunta y respuesta)"],
  ["", "Fotos y video"], ["foto", "Foto…"], ["fila", "Mosaico de fotos…"], ["video", "Video de YouTube"], ["map", "Mapa"],
  ["", "Diseño"], ["datos", "Datos en fila (lugar, distancia…)"], ["button", "Botón"], ["hr", "Línea separadora"], ["space", "Espacio en blanco"], ["ficha", "Ficha de datos"], ["raw", "Código HTML"],
];
window.SECTION_NAMES = Object.fromEntries(SECTIONS);
export const textTypes = ["p", "h2", "h3", "quote"];
export const NEEDS_CLEAR = ["p", "h3", "ul", "ol", "callout", "details", "button", "raw"];   // blocks that would sit beside a floating photo
export const TEXTY = ["p", "h2", "h3", "quote", "ul", "ol", "callout"];          // blocks the ribbon's "Estilo" can turn into each other
export const BLOCK_DEFAULTS = {
  ul: () => ({ type: "ul", items: [""] }), ol: () => ({ type: "ol", items: [""] }),
  callout: () => ({ type: "callout", fondo: "gris", marco: false, linea: "", text: "" }), details: () => ({ type: "details", title: "", text: "" }),
  hr: () => ({ type: "hr" }), space: () => ({ type: "space", size: 3 }),
  datos: () => ({ type: "datos", rows: [{ label: "Lugar", value: "" }, { label: "Distancia", value: "" }, { label: "Desnivel", value: "" }, { label: "Dificultad", value: "" }] }),
  button: () => ({ type: "button", text: "", url: "", style: "primario" }), video: () => ({ type: "video", id: "", caption: "" }),
  raw: () => ({ type: "raw", text: "<!-- Escribe aquí el código HTML -->" }),
  map: () => ({ type: "map", coords: "", label: "", zoom: "11" }),
};
export const textOf = (b) => (b.type === "ul" || b.type === "ol" ? (b.items || []).join("\n\n") : b.text || "");
