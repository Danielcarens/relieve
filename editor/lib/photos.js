// Import photos: save the original (outside the repo) and make the web sizes.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

export function slugify(name) {
  return name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "foto";
}

const JPG = { quality: 82, mozjpeg: true, progressive: true };

export async function importPhoto({ buf, name, imgDir, origDir }) {
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(origDir, { recursive: true });
  let slug = slugify(name), n = 1;
  while (fs.existsSync(path.join(imgDir, `${slug}.jpg`)) || slug === "hero") slug = `${slugify(name)}-${++n}`;
  const ext = (path.extname(name) || ".jpg").toLowerCase();
  fs.writeFileSync(path.join(origDir, `${slug}${ext}`), buf);
  const rot = await sharp(buf).rotate().toBuffer();      // applies EXIF orientation, drops GPS and metadata
  const meta = await sharp(rot).metadata();
  const maxW = meta.width / meta.height > 2.2 ? 6000 : 3600; // panoramas keep more pixels
  const w = Math.min(maxW, meta.width);
  const main = await sharp(rot).resize({ width: w, withoutEnlargement: true }).jpeg(JPG).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(imgDir, `${slug}.jpg`), main.data);
  const smW = Math.round(main.info.width / 2);
  await sharp(rot).resize({ width: smW }).jpeg(JPG).toFile(path.join(imgDir, `${slug}-sm.jpg`));
  return { file: slug, w: main.info.width, h: main.info.height };
}

function findOriginal(origDir, base) {
  return fs.readdirSync(origDir).find((f) => path.parse(f).name === base);
}

// The hero is always 16:9: crop it from the original around `pos` ("50% 40%").
export async function makeHero({ buf, imgDir, origDir, pos = "50% 50%" }) {
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(origDir, { recursive: true });
  if (buf) {
    for (const f of fs.readdirSync(origDir)) if (path.parse(f).name === "hero-source") fs.unlinkSync(path.join(origDir, f));
    fs.writeFileSync(path.join(origDir, "hero-source.jpg"), buf);   // same name whatever the format; sharp reads by content
  }
  const src = findOriginal(origDir, "hero-source");
  if (!src) throw new Error("No hay foto original de la portada");
  const rot = await sharp(path.join(origDir, src)).rotate().toBuffer();
  const { width, height } = await sharp(rot).metadata();
  const [px, py] = pos.split(" ").map((v) => Math.min(100, Math.max(0, parseFloat(v))) / 100);
  const target = 16 / 9;
  let cw = width, ch = height;
  if (width / height > target) cw = Math.round(height * target); else ch = Math.round(width / target);
  const left = Math.round((width - cw) * px), top = Math.round((height - ch) * py);
  const crop = await sharp(rot).extract({ left, top, width: cw, height: ch }).toBuffer();
  for (const w of [1280, 1920, 2560]) {
    await sharp(crop).resize({ width: w, withoutEnlargement: true }).jpeg(JPG).toFile(path.join(imgDir, `hero-${w}.jpg`));
  }
  return { file: "hero", w: 2560, h: 1440, srcW: width, srcH: height, pos };
}
