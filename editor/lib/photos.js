// Import photos: save the original (outside the repo) and make the web sizes.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

export function slugify(name) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "foto"
  );
}

const JPG = { quality: 82, mozjpeg: true, progressive: true };

export async function importPhoto({ buf, name, imgDir, origDir }) {
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(origDir, { recursive: true });
  let slug = slugify(name),
    n = 1;
  while (fs.existsSync(path.join(imgDir, `${slug}.jpg`)) || slug === "hero") slug = `${slugify(name)}-${++n}`;
  const ext = (path.extname(name) || ".jpg").toLowerCase();
  fs.writeFileSync(path.join(origDir, `${slug}${ext}`), buf);
  const rot = await sharp(buf).rotate().toBuffer(); // applies EXIF orientation, drops GPS and metadata
  const meta = await sharp(rot).metadata();
  const maxW = meta.width / meta.height > 2.2 ? 6000 : 3600; // panoramas keep more pixels
  const w = Math.min(maxW, meta.width);
  const main = await sharp(rot)
    .resize({ width: w, withoutEnlargement: true })
    .jpeg(JPG)
    .toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(imgDir, `${slug}.jpg`), main.data);
  const smW = Math.round(main.info.width / 2);
  await sharp(rot)
    .resize({ width: smW })
    .jpeg(JPG)
    .toFile(path.join(imgDir, `${slug}-sm.jpg`));
  return { file: slug, w: main.info.width, h: main.info.height };
}

function findOriginal(origDir, base) {
  return fs.readdirSync(origDir).find((f) => path.parse(f).name === base);
}

// The hero is always 16:9: crop it from the original around `pos` ("50% 40%"), `zoom` times closer.
// A copy of the uncropped photo (<name>-source.jpg, at most 2600 px wide) goes into the article's image folder, so the
// cover can be reframed later from any computer or from the web editor, not only where it was first chosen.
// `name` is the cover's file name ("hero", or "hero-<article>" when another article shares the folder);
// `prev` is the name it had before, whose original is used when the cover is only reframed under a new name.
export async function makeHero({ buf, imgDir, origDir, pos = "50% 50%", zoom = 1, name = "hero", prev = "hero" }) {
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(origDir, { recursive: true });
  const srcName = `${name}-source`,
    repoCopy = path.join(imgDir, `${srcName}.jpg`);
  if (buf) {
    for (const f of fs.readdirSync(origDir)) if (path.parse(f).name === srcName) fs.unlinkSync(path.join(origDir, f));
    fs.writeFileSync(path.join(origDir, `${srcName}.jpg`), buf); // same name whatever the format; sharp reads by content
  }
  const candidates = [
    [findOriginal(origDir, srcName), origDir],
    [fs.existsSync(repoCopy) ? `${srcName}.jpg` : null, imgDir],
    [findOriginal(origDir, `${prev}-source`), origDir],
    [fs.existsSync(path.join(imgDir, `${prev}-source.jpg`)) ? `${prev}-source.jpg` : null, imgDir],
  ];
  const hit = buf ? candidates[0] : candidates.find(([f]) => f);
  const from = hit && hit[0] ? path.join(hit[1], hit[0]) : null;
  if (!from) throw new Error("No hay foto original de la portada. Elígela otra vez con «Cambiar foto».");
  const rot = await sharp(from).rotate().toBuffer();
  const { width, height } = await sharp(rot).metadata();
  if (buf || !fs.existsSync(repoCopy))
    await sharp(rot)
      .resize({ width: Math.min(2600, width), withoutEnlargement: true })
      .jpeg({ ...JPG, quality: 80 })
      .toFile(repoCopy);
  const [px, py] = pos.split(" ").map((v) => Math.min(100, Math.max(0, parseFloat(v))) / 100);
  const target = 16 / 9,
    z = Math.min(4, Math.max(1, Number(zoom) || 1)); // zoom: 1 = the largest 16:9 crop, 2 = half as wide…
  const cw = Math.round((width / height > target ? height * target : width) / z),
    ch = Math.round(cw / target);
  const left = Math.round((width - cw) * px),
    top = Math.round((height - ch) * py);
  const crop = await sharp(rot).extract({ left, top, width: cw, height: ch }).toBuffer();
  for (const w of [1280, 1920, 2560]) {
    await sharp(crop)
      .resize({ width: w, withoutEnlargement: true })
      .jpeg(JPG)
      .toFile(path.join(imgDir, `${name}-${w}.jpg`));
  }
  return { file: name, w: 2560, h: 1440, srcW: width, srcH: height, pos, ...(z > 1 ? { zoom: z } : {}) };
}
